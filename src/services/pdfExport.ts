import {
  BlendMode,
  PDFDocument,
  StandardFonts,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  degrees,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import * as fontkitNamespace from "@pdf-lib/fontkit";
import type {
  ImageElement,
  PaperDocument,
  PaperElement,
  PaperPage,
  PdfMetadata,
  ShapeElement,
  StoredPdfAsset,
  TableElement,
  TextElement,
} from "@/types/document";
import { hexToRgb } from "@/utils/color";
import {
  elementLocalToVisual,
  getVisualPageGeometry,
  multiplyAffine,
  normalizeRotation,
  type Affine,
} from "@/utils/pdfGeometry";
import { PAGE_PRESETS, type PageSizePreset } from "@/utils/pageSizes";
import { getPdfAssetMap } from "@/db/database";

export interface PdfExportOptions {
  /** Keep each page at the imported/original page size. */
  sizeMode: "original" | "preset";
  preset: PageSizePreset;
  orientation: "auto" | "portrait" | "landscape";
  margin: number;
  /** 0-based page indices in output order. Omit for every page. */
  pageIndices?: number[];
  metadata: PdfMetadata;
}

export interface PdfExportProgress {
  current: number;
  total: number;
  label: string;
}

export class PdfExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExportError";
  }
}

type FontStyle = {
  family: TextElement["fontFamily"];
  weight: number;
  italic: boolean;
};

/**
 * The published types describe named exports, but the ES bundle ships a default
 * export. Normalise both shapes so fontkit registration works under Vite.
 */
const fontkit = (() => {
  const module = fontkitNamespace as unknown as {
    default?: typeof fontkitNamespace;
  };
  return (module.default ?? fontkitNamespace) as unknown as Parameters<
    PDFDocument["registerFontkit"]
  >[0];
})();

const FONT_BASE = `${import.meta.env.BASE_URL}fonts/`;
const fontFileCache = new Map<string, Promise<Uint8Array>>();
const imageElementCache = new Map<string, Promise<HTMLImageElement>>();
const assetDocumentCache = new Map<string, Promise<PDFDocument>>();

function interFileName(weight: number, italic: boolean): string {
  const stem =
    weight >= 700 ? "Bold" : weight >= 600 ? "SemiBold" : weight >= 500 ? "Medium" : "Regular";
  if (!italic) return `Inter-${stem}.ttf`;
  if (stem === "Regular") return "Inter-Italic.ttf";
  return `Inter-${stem}Italic.ttf`;
}

function loadInterBytes(weight: number, italic: boolean): Promise<Uint8Array> {
  const file = interFileName(weight, italic);
  const cached = fontFileCache.get(file);
  if (cached) return cached;
  const loading = fetch(`${FONT_BASE}${file}`).then(async (response) => {
    if (!response.ok) {
      throw new PdfExportError(`The ${file} typeface could not be loaded for export.`);
    }
    return new Uint8Array(await response.arrayBuffer());
  });
  fontFileCache.set(file, loading);
  loading.catch(() => fontFileCache.delete(file));
  return loading;
}

function sanitizeForStandardFont(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function standardFontName(style: FontStyle): StandardFonts {
  const bold = style.weight >= 600;
  if (style.family === "Times New Roman") {
    if (bold && style.italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (style.italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (style.family === "Courier New") {
    if (bold && style.italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (style.italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && style.italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (style.italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

class FontResolver {
  private cache = new Map<string, Promise<PDFFont>>();

  constructor(private pdf: PDFDocument) {
    pdf.registerFontkit(fontkit);
  }

  resolve(style: FontStyle): Promise<PDFFont> {
    const cleanWeight = Math.min(900, Math.max(100, Math.round(style.weight / 100) * 100));
    const key = `${style.family}:${cleanWeight}:${style.italic}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const loading = (async () => {
      if (style.family === "Inter") {
        const bytes = await loadInterBytes(cleanWeight, style.italic);
        // Subset fonts produced by this fontkit version have misaligned glyf
        // tables (table offsets not padded to 4 bytes), which corrupts glyph
        // outlines in strict PDF viewers. Embed the full, well-formed font.
        return this.pdf.embedFont(bytes, { subset: false });
      }
      return this.pdf.embedFont(standardFontName(style), { subset: false });
    })();
    this.cache.set(key, loading);
    return loading;
  }

}

function isStandardFamily(family: TextElement["fontFamily"]): boolean {
  return family !== "Inter";
}

function measureLine(
  font: PDFFont,
  text: string,
  size: number,
  letterSpacing: number,
): number {
  if (!text) return 0;
  const base = font.widthOfTextAtSize(text, size);
  return base + Math.max(0, text.length - 1) * letterSpacing;
}

function breakWord(
  font: PDFFont,
  word: string,
  size: number,
  width: number,
  letterSpacing: number,
): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const char of Array.from(word)) {
    const candidate = chunk + char;
    if (chunk && measureLine(font, candidate, size, letterSpacing) > width) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.length > 0 ? chunks : [""];
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  letterSpacing: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureLine(font, candidate, size, letterSpacing) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      if (measureLine(font, word, size, letterSpacing) <= maxWidth) {
        current = word;
      } else {
        const chunks = breakWord(font, word, size, maxWidth, letterSpacing);
        for (let index = 0; index < chunks.length - 1; index += 1) {
          lines.push(chunks[index]);
        }
        current = chunks[chunks.length - 1];
      }
    }
    lines.push(current);
  }
  return lines;
}

function roundedRectOperators(width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0.01) {
    return [
      moveTo(0, 0),
      lineTo(width, 0),
      lineTo(width, height),
      lineTo(0, height),
      closePath(),
    ];
  }
  const k = 0.5522847498307936 * r;
  return [
    moveTo(r, 0),
    lineTo(width - r, 0),
    appendBezierCurve(width - r + k, 0, width, r - k, width, r),
    lineTo(width, height - r),
    appendBezierCurve(width, height - r + k, width - r + k, height, width - r, height),
    lineTo(r, height),
    appendBezierCurve(r - k, height, 0, height - r + k, 0, height - r),
    lineTo(0, r),
    appendBezierCurve(0, r - k, r - k, 0, r, 0),
    closePath(),
  ];
}

function svgRoundedRect(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r <= 0.01) {
    return `M 0 0 H ${width} V ${height} H 0 Z`;
  }
  return [
    `M ${r} 0`,
    `H ${width - r}`,
    `C ${width - r + 0.5523 * r} 0 ${width} ${r - 0.5523 * r} ${width} ${r}`,
    `V ${height - r}`,
    `C ${width} ${height - r + 0.5523 * r} ${width - r + 0.5523 * r} ${height} ${width - r} ${height}`,
    `H ${r}`,
    `C ${r - 0.5523 * r} ${height} 0 ${height - r + 0.5523 * r} 0 ${height - r}`,
    `V ${r}`,
    `C 0 ${r - 0.5523 * r} ${r - 0.5523 * r} 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function withTransform(page: PDFPage, transform: Affine, draw: () => void): void {
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    ),
  );
  draw();
  page.pushOperators(popGraphicsState());
}

function clipElement(page: PDFPage, width: number, height: number, radius = 0): void {
  page.pushOperators(...roundedRectOperators(width, height, radius), clip(), endPath());
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageElementCache.get(src);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new PdfExportError("An embedded image could not be decoded."));
    image.src = src;
  });
  imageElementCache.set(src, loading);
  loading.catch(() => imageElementCache.delete(src));
  return loading;
}

class ImageResolver {
  private cache = new Map<string, Promise<PDFImage>>();

  constructor(private pdf: PDFDocument) {}

  resolve(src: string): Promise<PDFImage> {
    const cached = this.cache.get(src);
    if (cached) return cached;
    const loading = (async () => {
      const image = await loadImage(src);
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new PdfExportError("An embedded image has invalid dimensions.");
      }
      const isPng = src.startsWith("data:image/png") || /\.png($|\?)/i.test(src);
      const isJpeg =
        src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg");
      if (isJpeg) {
        const bytes = dataUrlBytes(src);
        if (bytes) return this.pdf.embedJpg(bytes);
      }
      if (isPng) {
        const bytes = dataUrlBytes(src);
        if (bytes) {
          try {
            return await this.pdf.embedPng(bytes);
          } catch {
            // Some PNGs use features pdf-lib cannot parse; normalize below.
          }
        }
      }
      const canvas = document.createElement("canvas");
      const maxSide = 4096;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new PdfExportError("The browser could not prepare an image for export.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return this.pdf.embedPng(canvas.toDataURL("image/png"));
    })();
    this.cache.set(src, loading);
    loading.catch(() => this.cache.delete(src));
    return loading;
  }
}

function dataUrlBytes(src: string): Uint8Array | null {
  if (!src.startsWith("data:")) return null;
  const comma = src.indexOf(",");
  if (comma < 0) return null;
  const meta = src.slice(5, comma);
  if (!meta.includes("base64")) return null;
  try {
    const binary = atob(src.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function drawTextElement(
  page: PDFPage,
  element: TextElement,
  font: PDFFont,
  standardFont: boolean,
): void {
  const color = hexToRgb(element.color);
  const padding = Math.max(0, element.padding);
  const innerWidth = Math.max(1, element.width - padding * 2);
  const safe = (value: string) =>
    standardFont ? sanitizeForStandardFont(value) : value;
  const text = safe(element.text || " ");
  const lines = wrapText(
    text,
    font,
    element.fontSize,
    innerWidth,
    element.letterSpacing,
  );
  const lineHeight = element.fontSize * element.lineHeight;
  const ascent = element.fontSize * 0.8;

  if (element.backgroundColor && element.backgroundColor !== "transparent") {
    const background = hexToRgb(element.backgroundColor);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      color: rgb(background.r, background.g, background.b),
      opacity: element.opacity,
    });
  }

  page.pushOperators(pushGraphicsState());
  clipElement(page, element.width, element.height);
  page.setFont(font);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineWidth = measureLine(font, line, element.fontSize, element.letterSpacing);
    let cursor = padding;
    if (element.align === "center") cursor += (innerWidth - lineWidth) / 2;
    if (element.align === "right") cursor += innerWidth - lineWidth;
    const baseline =
      element.height - padding - ascent - index * lineHeight;
    if (baseline + ascent < -lineHeight) break;
    if (element.letterSpacing === 0) {
      page.drawText(line || " ", {
        x: cursor,
        y: baseline,
        size: element.fontSize,
        color: rgb(color.r, color.g, color.b),
        opacity: element.opacity,
      });
    } else {
      let x = cursor;
      for (const char of Array.from(line || " ")) {
        page.drawText(char, {
          x,
          y: baseline,
          size: element.fontSize,
          color: rgb(color.r, color.g, color.b),
          opacity: element.opacity,
        });
        x += font.widthOfTextAtSize(char, element.fontSize) + element.letterSpacing;
      }
    }
    if (element.underline) {
      page.drawLine({
        start: { x: cursor, y: baseline - element.fontSize * 0.14 },
        end: { x: cursor + lineWidth, y: baseline - element.fontSize * 0.14 },
        thickness: Math.max(0.4, element.fontSize * 0.055),
        color: rgb(color.r, color.g, color.b),
        opacity: element.opacity,
      });
    }
  }
  page.pushOperators(popGraphicsState());
}

function drawImageElement(
  page: PDFPage,
  element: ImageElement,
  image: PDFImage,
): void {
  const radius = Math.max(0, element.cornerRadius);
  const needsClip = radius > 0 || element.fit === "cover";
  page.pushOperators(pushGraphicsState());
  if (needsClip) clipElement(page, element.width, element.height, radius);

  if (element.fit === "fill") {
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      opacity: element.opacity,
    });
  } else {
    const imageRatio = image.width / image.height;
    const boxRatio = element.width / element.height;
    let drawWidth: number;
    let drawHeight: number;
    if (element.fit === "contain") {
      if (imageRatio >= boxRatio) {
        drawWidth = element.width;
        drawHeight = element.width / imageRatio;
      } else {
        drawHeight = element.height;
        drawWidth = element.height * imageRatio;
      }
    } else {
      if (imageRatio >= boxRatio) {
        drawHeight = element.height;
        drawWidth = element.height * imageRatio;
      } else {
        drawWidth = element.width;
        drawHeight = element.width / imageRatio;
      }
    }
    page.drawImage(image, {
      x: (element.width - drawWidth) / 2,
      y: (element.height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
      opacity: element.opacity,
    });
  }
  if (needsClip) page.pushOperators(popGraphicsState());
}

function drawShapeElement(page: PDFPage, element: ShapeElement): void {
  if (element.shape === "line") {
    if (element.strokeWidth <= 0) return;
    const color = hexToRgb(
      element.stroke === "transparent" ? element.fill : element.stroke,
    );
    page.drawLine({
      start: { x: 0, y: element.height },
      end: { x: element.width, y: 0 },
      thickness: element.strokeWidth,
      color: rgb(color.r, color.g, color.b),
      opacity: element.opacity,
      dashArray: element.dash && element.dash.length > 0 ? element.dash : undefined,
      lineCap: undefined,
    });
    return;
  }

  if (element.shape === "ellipse") {
    const hasFill = element.fill !== "transparent";
    const hasStroke = element.strokeWidth > 0 && element.stroke !== "transparent";
    if (!hasFill && !hasStroke) return;
    const fillColor = hexToRgb(element.fill);
    const strokeColor = hexToRgb(element.stroke);
    page.drawEllipse({
      x: element.width / 2,
      y: element.height / 2,
      xScale: element.width / 2,
      yScale: element.height / 2,
      color: hasFill ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
      opacity: hasFill ? element.opacity : undefined,
      borderColor: hasStroke ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
      borderWidth: hasStroke ? element.strokeWidth : undefined,
      borderOpacity: hasStroke ? element.opacity : undefined,
      borderDashArray: element.dash && element.dash.length > 0 ? element.dash : undefined,
      blendMode: element.purpose === "highlight" ? BlendMode.Multiply : undefined,
    });
    return;
  }

  const hasFill = element.fill !== "transparent";
  const hasStroke = element.strokeWidth > 0 && element.stroke !== "transparent";
  if (!hasFill && !hasStroke) return;
  const fillColor = hexToRgb(element.fill);
  const strokeColor = hexToRgb(element.stroke);

  if (element.cornerRadius > 0.01) {
    page.drawSvgPath(svgRoundedRect(element.width, element.height, element.cornerRadius), {
      x: 0,
      y: element.height,
      color: hasFill ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
      opacity: hasFill ? element.opacity : undefined,
      borderColor: hasStroke ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
      borderWidth: hasStroke ? element.strokeWidth : undefined,
      borderOpacity: hasStroke ? element.opacity : undefined,
      borderDashArray: element.dash && element.dash.length > 0 ? element.dash : undefined,
      blendMode: element.purpose === "highlight" ? BlendMode.Multiply : undefined,
    });
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      color: hasFill ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
      opacity: hasFill ? element.opacity : undefined,
      borderColor: hasStroke ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
      borderWidth: hasStroke ? element.strokeWidth : undefined,
      borderOpacity: hasStroke ? element.opacity : undefined,
      borderDashArray: element.dash && element.dash.length > 0 ? element.dash : undefined,
      blendMode: element.purpose === "highlight" ? BlendMode.Multiply : undefined,
    });
  }
}

async function drawTableElement(
  page: PDFPage,
  table: TableElement,
  resolver: FontResolver,
): Promise<void> {
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const weights =
    table.columnWeights?.length === columns
      ? table.columnWeights
      : Array.from({ length: columns }, () => 1);
  const totalWeight = Math.max(0.0001, weights.reduce((sum, weight) => sum + weight, 0));
  const rowHeights =
    table.rowHeights?.length === table.rows.length
      ? table.rowHeights
      : Array.from({ length: table.rows.length }, () => table.height / table.rows.length);
  const totalRowHeight = Math.max(0.0001, rowHeights.reduce((sum, height) => sum + height, 0));
  const xOffsets: number[] = [];
  let cursorX = 0;
  for (const weight of weights) {
    xOffsets.push(cursorX);
    cursorX += (weight / totalWeight) * table.width;
  }
  const columnWidths = xOffsets.map((offset, index) =>
    index === weights.length - 1 ? cursorX - offset : xOffsets[index + 1] - offset,
  );

  const bodyFont = await resolver.resolve({
    family: table.fontFamily,
    weight: 400,
    italic: false,
  });
  const headerFont = await resolver.resolve({
    family: table.fontFamily,
    weight: 600,
    italic: false,
  });

  let yTop = table.height;
  for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
    const rawHeight = rowHeights[rowIndex];
    const rowHeight = (rawHeight / totalRowHeight) * table.height;
    const isHeader = rowIndex === 0 && table.headerRow;
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cellX = xOffsets[columnIndex];
      const cellWidth = columnWidths[columnIndex];
      const headerBackground = hexToRgb(table.headerBackground);
      const borderColor = hexToRgb(table.borderColor);
      page.drawRectangle({
        x: cellX,
        y: yTop - rowHeight,
        width: cellWidth,
        height: rowHeight,
        color: isHeader ? rgb(headerBackground.r, headerBackground.g, headerBackground.b) : undefined,
        opacity: isHeader ? table.opacity : undefined,
        borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
        borderWidth: table.borderWidth,
        borderOpacity: table.opacity,
      });
      const cellText = table.rows[rowIndex]?.[columnIndex] ?? "";
      if (!cellText) continue;
      const font = isHeader ? headerFont : bodyFont;
      const textColor = hexToRgb(isHeader ? table.headerColor : table.color);
      const padding = Math.max(0, table.cellPadding);
      const innerWidth = Math.max(1, cellWidth - padding * 2);
      const standard = isStandardFamily(table.fontFamily);
      const safeText = standard ? sanitizeForStandardFont(cellText) : cellText;
      const lines = wrapText(safeText, font, table.fontSize, innerWidth, 0);
      const ascent = table.fontSize * 0.8;
      page.pushOperators(pushGraphicsState());
      page.pushOperators(
        moveTo(cellX, yTop - rowHeight),
        lineTo(cellX + cellWidth, yTop - rowHeight),
        lineTo(cellX + cellWidth, yTop),
        lineTo(cellX, yTop),
        closePath(),
        clip(),
        endPath(),
      );
      let remainingHeight = rowHeight - padding * 2;
      page.setFont(font);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        if (remainingHeight < table.fontSize) break;
        const line = lines[lineIndex];
        page.drawText(line || " ", {
          x: cellX + padding,
          y: yTop - padding - ascent - lineIndex * table.fontSize * 1.22,
          size: table.fontSize,
          color: rgb(textColor.r, textColor.g, textColor.b),
          opacity: table.opacity,
        });
        remainingHeight -= table.fontSize * 1.22;
      }
      page.pushOperators(popGraphicsState());
    }
    yTop -= rowHeight;
  }
}

async function drawElement(
  page: PDFPage,
  element: PaperElement,
  pageHeight: number,
  transform: Affine,
  resolver: FontResolver,
  images: ImageResolver,
): Promise<void> {
  if (!element.visible) return;
  const local = multiplyAffine(transform, elementLocalToVisual(element, pageHeight));
  if (element.type === "text") {
    const font = await resolver.resolve({
      family: element.fontFamily,
      weight: element.fontWeight,
      italic: element.italic,
    });
    withTransform(page, local, () =>
      drawTextElement(page, element, font, isStandardFamily(element.fontFamily)),
    );
    return;
  }
  if (element.type === "image") {
    const image = await images.resolve(element.src);
    withTransform(page, local, () => drawImageElement(page, element, image));
    return;
  }
  if (element.type === "shape") {
    withTransform(page, local, () => drawShapeElement(page, element));
    return;
  }
  if (element.type === "table") {
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(local.a, local.b, local.c, local.d, local.e, local.f),
    );
    await drawTableElement(page, element, resolver);
    page.pushOperators(popGraphicsState());
  }
}

async function loadSourceDocument(asset: StoredPdfAsset): Promise<PDFDocument> {
  const cached = assetDocumentCache.get(asset.id);
  if (cached) return cached;
  const loading = (async () => {
    try {
      return await PDFDocument.load(asset.bytes.slice(0), {
        updateMetadata: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/encrypt|password/i.test(message)) {
        throw new PdfExportError(
          `“${asset.name}” is password protected, so its pages cannot be exported.`,
        );
      }
      throw new PdfExportError(
        `The original PDF “${asset.name}” could not be read for export. It may be damaged.`,
      );
    }
  })();
  assetDocumentCache.set(asset.id, loading);
  loading.catch(() => assetDocumentCache.delete(asset.id));
  return loading;
}

function targetDimensions(
  page: PaperPage,
  options: PdfExportOptions,
): { width: number; height: number } {
  if (options.sizeMode === "original") {
    return { width: page.width, height: page.height };
  }
  const preset =
    PAGE_PRESETS.find((item) => item.id === options.preset) ?? PAGE_PRESETS[0];
  const orientation =
    options.orientation === "auto"
      ? page.width > page.height
        ? "landscape"
        : "portrait"
      : options.orientation;
  return orientation === "landscape"
    ? { width: preset.height, height: preset.width }
    : { width: preset.width, height: preset.height };
}

function rotateBounds(
  rotation: number,
  width: number,
  height: number,
): { tx: number; ty: number } {
  const normalized = normalizeRotation(rotation);
  if (normalized === 90) return { tx: 0, ty: width };
  if (normalized === 180) return { tx: width, ty: height };
  if (normalized === 270) return { tx: height, ty: 0 };
  return { tx: 0, ty: 0 };
}

/**
 * Draw an imported source page into a newly created target page. The embedded
 * page is rotated explicitly because PDF form XObjects do not inherit the
 * source page's /Rotate entry.
 */
async function drawSourceIntoPage(
  output: PDFDocument,
  target: PDFPage,
  sourceDoc: PDFDocument,
  sourceRef: NonNullable<PaperPage["source"]>,
  offsetX: number,
  offsetY: number,
  scale: number,
): Promise<void> {
  const sourcePages = sourceDoc.getPages();
  const sourcePage = sourcePages[sourceRef.pageIndex];
  if (!sourcePage) {
    throw new PdfExportError("An imported page no longer exists in its original PDF.");
  }
  const crop = sourcePage.getCropBox();
  const finalRotation = normalizeRotation(
    sourcePage.getRotation().angle + (sourceRef.rotationOffset ?? 0),
  );
  const embedded = await output.embedPage(sourcePage, {
    left: crop.x,
    bottom: crop.y,
    right: crop.x + crop.width,
    top: crop.y + crop.height,
  });
  const rotation = rotateBounds(finalRotation, crop.width, crop.height);
  // drawPage applies translate -> rotate -> scale. The translation positions
  // the rotated crop in the visual coordinate space before the target offset
  // and fit scale are applied.
  const x = offsetX + rotation.tx * scale;
  const y = offsetY + rotation.ty * scale;
  target.drawPage(embedded, {
    x,
    y,
    xScale: scale,
    yScale: scale,
    rotate: degrees(-finalRotation),
  });
}

async function copySourcePage(
  output: PDFDocument,
  sourceDoc: PDFDocument,
  sourceRef: NonNullable<PaperPage["source"]>,
): Promise<PDFPage> {
  const sourcePage = sourceDoc.getPages()[sourceRef.pageIndex];
  if (!sourcePage) {
    throw new PdfExportError("An imported page no longer exists in its original PDF.");
  }
  const [copied] = await output.copyPages(sourceDoc, [sourceRef.pageIndex]);
  const finalRotation = normalizeRotation(
    sourcePage.getRotation().angle + (sourceRef.rotationOffset ?? 0),
  );
  copied.setRotation(degrees(finalRotation));
  return output.addPage(copied);
}

export async function exportDocumentToPdf(
  document: PaperDocument,
  options: PdfExportOptions,
  onProgress?: (progress: PdfExportProgress) => void,
): Promise<Uint8Array> {
  if (document.pages.length === 0) {
    throw new PdfExportError("There are no pages to export.");
  }
  const indices =
    options.pageIndices && options.pageIndices.length > 0
      ? options.pageIndices
      : document.pages.map((_, index) => index);
  if (indices.some((index) => index < 0 || index >= document.pages.length)) {
    throw new PdfExportError("The page selection is outside this document.");
  }

  const assets = await getPdfAssetMap(document.id);
  const output = await PDFDocument.create();
  output.setTitle(options.metadata.title || document.title);
  output.setAuthor(options.metadata.author || "");
  output.setSubject(options.metadata.subject || "");
  output.setKeywords(
    options.metadata.keywords.filter((keyword) => keyword.trim().length > 0),
  );
  output.setCreator(options.metadata.creator || "Paperforge");
  output.setProducer("Paperforge");
  output.setCreationDate(new Date());
  output.setModificationDate(new Date());

  const resolver = new FontResolver(output);
  const images = new ImageResolver(output);
  const sourceDocuments = new Map<string, PDFDocument>();
  const margin =
    options.sizeMode === "preset" ? Math.max(0, Math.min(400, options.margin)) : 0;

  for (let order = 0; order < indices.length; order += 1) {
    const page = document.pages[indices[order]];
    onProgress?.({
      current: order + 1,
      total: indices.length,
      label: `Rendering page ${order + 1} of ${indices.length}`,
    });

    if (options.sizeMode === "original" && page.source) {
      const asset = assets.get(page.source.assetId);
      if (!asset) {
        throw new PdfExportError(
          `The original PDF for page ${indices[order] + 1} is missing from local storage.`,
        );
      }
      let sourceDoc = sourceDocuments.get(asset.id);
      if (!sourceDoc) {
        sourceDoc = await loadSourceDocument(asset);
        sourceDocuments.set(asset.id, sourceDoc);
      }
      const outputPage = await copySourcePage(output, sourceDoc, page.source);
      const sourcePage = sourceDoc.getPages()[page.source.pageIndex];
      const crop = sourcePage.getCropBox();
      const finalRotation = normalizeRotation(
        sourcePage.getRotation().angle + (page.source.rotationOffset ?? 0),
      );
      const geometry = getVisualPageGeometry(finalRotation, {
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      });
      for (const element of page.elements) {
        await drawElement(
          outputPage,
          element,
          page.height,
          geometry.visualToUser,
          resolver,
          images,
        );
      }
      continue;
    }

    const dimensions = targetDimensions(page, options);
    const outputPage = output.addPage([dimensions.width, dimensions.height]);
    const background = hexToRgb(page.background || "#ffffff");
    outputPage.drawRectangle({
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      color: rgb(background.r, background.g, background.b),
    });

    const availableWidth = Math.max(1, dimensions.width - margin * 2);
    const availableHeight = Math.max(1, dimensions.height - margin * 2);
    const scale = Math.min(
      availableWidth / page.width,
      availableHeight / page.height,
    );
    const contentWidth = page.width * scale;
    const contentHeight = page.height * scale;
    const offsetX = (dimensions.width - contentWidth) / 2;
    const offsetY = (dimensions.height - contentHeight) / 2;

    if (page.source) {
      const asset = assets.get(page.source.assetId);
      if (!asset) {
        throw new PdfExportError(
          `The original PDF for page ${indices[order] + 1} is missing from local storage.`,
        );
      }
      let sourceDoc = sourceDocuments.get(asset.id);
      if (!sourceDoc) {
        sourceDoc = await loadSourceDocument(asset);
        sourceDocuments.set(asset.id, sourceDoc);
      }
      await drawSourceIntoPage(
        output,
        outputPage,
        sourceDoc,
        page.source,
        offsetX,
        offsetY,
        scale,
      );
    }

    const contentTransform: Affine = {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: offsetX,
      f: offsetY,
    };
    for (const element of page.elements) {
      await drawElement(
        outputPage,
        element,
        page.height,
        contentTransform,
        resolver,
        images,
      );
    }
  }

  onProgress?.({
    current: indices.length,
    total: indices.length,
    label: "Writing PDF file",
  });
  return output.save({ useObjectStreams: true, addDefaultPage: false });
}

export function pdfBytesToBlob(bytes: Uint8Array): Blob {
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([copy], { type: "application/pdf" });
}
