import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { hexToRgb } from "@/utils/color";
import {
  getVisualPageGeometry,
  multiplyAffine,
  type Affine,
} from "@/utils/pdfGeometry";
import { PAGE_PRESETS } from "@/utils/pageSizes";

export type PdfToolErrorCode =
  | "invalid-pdf"
  | "encrypted"
  | "empty"
  | "invalid-pages"
  | "unsupported-image"
  | "unknown";

export class PdfToolError extends Error {
  code: PdfToolErrorCode;

  constructor(message: string, code: PdfToolErrorCode = "unknown") {
    super(message);
    this.name = "PdfToolError";
    this.code = code;
  }
}

export interface PdfInputFile {
  name: string;
  bytes: ArrayBuffer;
}

export interface ImageInputFile {
  name: string;
  bytes: ArrayBuffer;
  mimeType: string;
}

export interface ToolResult {
  bytes: Uint8Array;
  pageCount: number;
  filename?: string;
}

export interface SplitResult {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pageNumbers: number[];
}

const PDF_LOAD_OPTIONS = { updateMetadata: false } as const;

async function loadPdf(bytes: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes.slice(0), PDF_LOAD_OPTIONS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/encrypt|password/i.test(message)) {
      throw new PdfToolError(
        "This PDF is password protected. Remove its password before editing it.",
        "encrypted",
      );
    }
    throw new PdfToolError(
      "This PDF appears to be damaged or is not a supported PDF file.",
      "invalid-pdf",
    );
  }
}

function ensureNonEmpty(pdf: PDFDocument): void {
  if (pdf.getPageCount() === 0) {
    throw new PdfToolError("This PDF does not contain any pages.", "empty");
  }
}

async function savePdf(pdf: PDFDocument): Promise<Uint8Array> {
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

export async function getPdfInfo(bytes: ArrayBuffer): Promise<{ pageCount: number; title?: string }> {
  const pdf = await loadPdf(bytes);
  ensureNonEmpty(pdf);
  return { pageCount: pdf.getPageCount(), title: pdf.getTitle() };
}

function parseInteger(value: string, context: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new PdfToolError(`${context} must contain whole page numbers.`, "invalid-pages");
  }
  return Number.parseInt(value, 10);
}

/** Parse a 1-based range expression like "1-3, 5, 8-10" into ordered page indices. */
export function parsePageRanges(input: string, pageCount: number): number[] {
  const compact = input
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/\bpage(s)?\b/gi, "");
  if (!compact) {
    throw new PdfToolError("Enter at least one page or range.", "invalid-pages");
  }
  const pages: number[] = [];
  const seen = new Set<number>();
  for (const segment of compact.split(",")) {
    if (!segment) continue;
    const parts = segment.split("-");
    if (parts.length > 2) {
      throw new PdfToolError(`"${segment}" is not a valid page range.`, "invalid-pages");
    }
    const start = parseInteger(parts[0], `"${segment}"`);
    const end = parts.length === 2 ? parseInteger(parts[1], `"${segment}"`) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new PdfToolError(
        `Page numbers must be between 1 and ${pageCount}.`,
        "invalid-pages",
      );
    }
    if (end < start) {
      throw new PdfToolError(`Range "${segment}" must count upwards.`, "invalid-pages");
    }
    for (let page = start; page <= end; page += 1) {
      if (!seen.has(page)) {
        seen.add(page);
        pages.push(page);
      }
    }
  }
  if (pages.length === 0) {
    throw new PdfToolError("Enter at least one page or range.", "invalid-pages");
  }
  return pages;
}

export function parsePageOrder(input: string, pageCount: number): number[] {
  const tokens = input
    .replace(/[–—]/g, "-")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (tokens.length !== pageCount) {
    throw new PdfToolError(
      `Enter all ${pageCount} page number${pageCount === 1 ? "" : "s"} exactly once, in the new order.`,
      "invalid-pages",
    );
  }
  const pages = tokens.map((token) => parseInteger(token, "The page order"));
  const unique = new Set(pages);
  if (unique.size !== pageCount || pages.some((page) => page < 1 || page > pageCount)) {
    throw new PdfToolError(
      `The order must use every page from 1 to ${pageCount} exactly once.`,
      "invalid-pages",
    );
  }
  return pages;
}

export async function mergePdfs(files: PdfInputFile[]): Promise<ToolResult> {
  if (files.length < 2) {
    throw new PdfToolError("Choose at least two PDF files to merge.", "empty");
  }
  const output = await PDFDocument.create();
  let total = 0;
  for (const file of files) {
    const source = await loadPdf(file.bytes);
    ensureNonEmpty(source);
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
    total += pages.length;
  }
  return { bytes: await savePdf(output), pageCount: total };
}

export type SplitMode = "each" | "chunks" | "ranges";

export interface SplitOptions {
  mode: SplitMode;
  chunkSize?: number;
  ranges?: string;
}

export async function splitPdf(
  bytes: ArrayBuffer,
  options: SplitOptions,
): Promise<SplitResult[]> {
  const source = await loadPdf(bytes);
  ensureNonEmpty(source);
  const pageCount = source.getPageCount();
  const groups: number[][] = [];

  if (options.mode === "each") {
    for (let index = 1; index <= pageCount; index += 1) groups.push([index]);
  } else if (options.mode === "chunks") {
    const size = Math.floor(options.chunkSize ?? 2);
    if (!Number.isFinite(size) || size < 1 || size > 500) {
      throw new PdfToolError("Chunk size must be between 1 and 500 pages.", "invalid-pages");
    }
    for (let index = 1; index <= pageCount; index += size) {
      groups.push(
        Array.from({ length: Math.min(size, pageCount - index + 1) }, (_, offset) => index + offset),
      );
    }
  } else {
    if (!options.ranges?.trim()) {
      throw new PdfToolError("Enter the ranges to split into groups.", "invalid-pages");
    }
    for (const segment of options.ranges.split(",")) {
      if (!segment.trim()) continue;
      groups.push(parsePageRanges(segment, pageCount));
    }
    if (groups.length === 0) {
      throw new PdfToolError("Enter at least one range.", "invalid-pages");
    }
  }

  const results: SplitResult[] = [];
  for (const group of groups) {
    const output = await PDFDocument.create();
    const pages = await output.copyPages(
      source,
      group.map((number) => number - 1),
    );
    pages.forEach((page) => output.addPage(page));
    results.push({
      name:
        group.length === 1
          ? `page-${group[0]}`
          : `pages-${group[0]}-${group[group.length - 1]}`,
      bytes: await savePdf(output),
      pageCount: group.length,
      pageNumbers: group,
    });
  }
  return results;
}

export async function rotatePdf(
  bytes: ArrayBuffer,
  angle: 90 | 180 | 270,
  pagesInput = "all",
): Promise<ToolResult> {
  const pdf = await loadPdf(bytes);
  ensureNonEmpty(pdf);
  const pageCount = pdf.getPageCount();
  const targets =
    !pagesInput.trim() || /^all$/i.test(pagesInput.trim())
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : parsePageRanges(pagesInput, pageCount);
  const pages = pdf.getPages();
  for (const pageNumber of targets) {
    const page = pages[pageNumber - 1];
    const current = page.getRotation().angle;
    page.setRotation(degrees((((current + angle) % 360) + 360) % 360));
  }
  return { bytes: await savePdf(pdf), pageCount };
}

export async function removePdfPages(
  bytes: ArrayBuffer,
  pagesInput: string,
): Promise<ToolResult> {
  const pdf = await loadPdf(bytes);
  ensureNonEmpty(pdf);
  const pageCount = pdf.getPageCount();
  const targets = parsePageRanges(pagesInput, pageCount);
  if (targets.length >= pageCount) {
    throw new PdfToolError("A PDF must keep at least one page.", "invalid-pages");
  }
  targets
    .slice()
    .sort((a, b) => b - a)
    .forEach((pageNumber) => pdf.removePage(pageNumber - 1));
  return { bytes: await savePdf(pdf), pageCount: pageCount - targets.length };
}

export async function reorderPdfPages(
  bytes: ArrayBuffer,
  orderInput: string,
): Promise<ToolResult> {
  const source = await loadPdf(bytes);
  ensureNonEmpty(source);
  const order = parsePageOrder(orderInput, source.getPageCount());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(
    source,
    order.map((number) => number - 1),
  );
  pages.forEach((page) => output.addPage(page));
  return { bytes: await savePdf(output), pageCount: pages.length };
}

export async function extractPdfPages(
  bytes: ArrayBuffer,
  pagesInput: string,
): Promise<ToolResult> {
  const source = await loadPdf(bytes);
  ensureNonEmpty(source);
  const targets = parsePageRanges(pagesInput, source.getPageCount());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(
    source,
    targets.map((page) => page - 1),
  );
  pages.forEach((page) => output.addPage(page));
  return { bytes: await savePdf(output), pageCount: pages.length };
}

function convertCommonUnicode(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

function wrapForPdf(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        let chunk = "";
        for (const char of Array.from(word)) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      }
    }
    lines.push(current);
  }
  return lines;
}

async function drawVisualText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: { r: number; g: number; b: number };
    opacity?: number;
    rotation?: number;
  },
): Promise<void> {
  const crop = page.getCropBox();
  const geometry = getVisualPageGeometry(page.getRotation().angle, crop);
  const radians = ((options.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const elementMatrix: Affine = {
    a: cos,
    b: sin,
    c: -sin,
    d: cos,
    e: options.x,
    f: options.y,
  };
  const matrix = multiplyAffine(geometry.visualToUser, elementMatrix);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f),
  );
  page.drawText(convertCommonUnicode(text || " "), {
    x: 0,
    y: 0,
    size: options.size,
    font: options.font,
    color: rgb(options.color.r, options.color.g, options.color.b),
    opacity: options.opacity ?? 1,
  });
  page.pushOperators(popGraphicsState());
}

export type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  position: WatermarkPosition;
  pages?: string;
}

export async function addWatermark(
  bytes: ArrayBuffer,
  options: WatermarkOptions,
): Promise<ToolResult> {
  const text = options.text.trim();
  if (!text) throw new PdfToolError("Enter the watermark text.", "invalid-pages");
  if (text.length > 160) {
    throw new PdfToolError("Watermark text must be 160 characters or fewer.", "invalid-pages");
  }
  const fontSize = Math.min(144, Math.max(6, options.fontSize));
  const opacity = Math.min(0.9, Math.max(0.03, options.opacity));
  const pdf = await loadPdf(bytes);
  ensureNonEmpty(pdf);
  const pageCount = pdf.getPageCount();
  const targetPages =
    !options.pages?.trim() || /^all$/i.test(options.pages.trim())
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : parsePageRanges(options.pages, pageCount);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = hexToRgb(options.color);
  const pages = pdf.getPages();
  const margin = 44;

  for (const number of targetPages) {
    const page = pages[number - 1];
    const geometry = getVisualPageGeometry(page.getRotation().angle, page.getCropBox());
    const clean = convertCommonUnicode(text);
    const textWidth = font.widthOfTextAtSize(clean, fontSize);
    const textHeight = fontSize * 0.72;
    let centerX = geometry.width / 2;
    let centerY = geometry.height / 2;
    if (options.position.includes("left")) centerX = margin + textWidth / 2;
    if (options.position.includes("right")) centerX = geometry.width - margin - textWidth / 2;
    if (options.position.includes("top")) centerY = geometry.height - margin - textHeight / 2;
    if (options.position.includes("bottom")) centerY = margin + textHeight / 2;

    const radians = (options.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const x = centerX - (cos * textWidth) / 2 + (sin * textHeight) / 2;
    const y = centerY - (sin * textWidth) / 2 - (cos * textHeight) / 2;
    await drawVisualText(page, text, {
      x,
      y,
      size: fontSize,
      font,
      color,
      opacity,
      rotation: options.rotation,
    });
  }
  return { bytes: await savePdf(pdf), pageCount };
}

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";
export type PageNumberFormat = "page-of-total" | "x-of-y" | "page-x" | "x";

export interface PageNumberOptions {
  position: PageNumberPosition;
  format: PageNumberFormat;
  start: number;
  fontSize: number;
  color: string;
  margin: number;
  pages?: string;
}

function formatPageNumber(
  current: number,
  total: number,
  format: PageNumberFormat,
): string {
  if (format === "page-of-total") return `Page ${current} of ${total}`;
  if (format === "x-of-y") return `${current} / ${total}`;
  if (format === "page-x") return `Page ${current}`;
  return String(current);
}

export async function addPageNumbers(
  bytes: ArrayBuffer,
  options: PageNumberOptions,
): Promise<ToolResult> {
  const pdf = await loadPdf(bytes);
  ensureNonEmpty(pdf);
  const pageCount = pdf.getPageCount();
  const start = Math.floor(options.start);
  if (!Number.isFinite(start) || start < 0 || start > 1_000_000) {
    throw new PdfToolError("Start number must be zero or greater.", "invalid-pages");
  }
  const fontSize = Math.min(72, Math.max(5, options.fontSize));
  const margin = Math.min(200, Math.max(8, options.margin));
  const targetPages =
    !options.pages?.trim() || /^all$/i.test(options.pages.trim())
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : parsePageRanges(options.pages, pageCount);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color);
  const pages = pdf.getPages();
  const totalLabel = start + targetPages.length - 1;

  for (const number of targetPages) {
    const page = pages[number - 1];
    const geometry = getVisualPageGeometry(page.getRotation().angle, page.getCropBox());
    const label = formatPageNumber(
      start + targetPages.indexOf(number),
      totalLabel,
      options.format,
    );
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    let x = (geometry.width - textWidth) / 2;
    if (options.position.endsWith("left")) x = margin;
    if (options.position.endsWith("right")) x = geometry.width - margin - textWidth;
    const y = options.position.startsWith("top")
      ? geometry.height - margin - fontSize
      : margin;
    await drawVisualText(page, label, {
      x,
      y,
      size: fontSize,
      font,
      color,
    });
  }
  return { bytes: await savePdf(pdf), pageCount };
}

export interface ImagesToPdfOptions {
  preset: "a4" | "a5" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  margin: number;
  background: string;
}

function detectImageKind(file: ImageInputFile): "jpg" | "png" {
  const mime = file.mimeType.toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  const header = new Uint8Array(file.bytes.slice(0, 8));
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return "png";
  }
  if (header[0] === 0xff && header[1] === 0xd8) return "jpg";
  throw new PdfToolError(
    `“${file.name}” is not a PNG or JPEG. Convert it to PNG or JPEG and try again.`,
    "unsupported-image",
  );
}

export async function imagesToPdf(
  files: ImageInputFile[],
  options: ImagesToPdfOptions,
): Promise<ToolResult> {
  if (files.length === 0) {
    throw new PdfToolError("Choose at least one image.", "empty");
  }
  if (files.length > 100) {
    throw new PdfToolError("Add 100 images or fewer at a time.", "empty");
  }
  const preset = PAGE_PRESETS.find((item) => item.id === options.preset) ?? PAGE_PRESETS[0];
  const margin = Math.min(200, Math.max(0, options.margin));
  const output = await PDFDocument.create();
  output.setCreator("Paperforge");
  output.setProducer("Paperforge");

  for (const file of files) {
    const kind = detectImageKind(file);
    let image: PDFImage;
    try {
      image = kind === "jpg" ? await output.embedJpg(file.bytes) : await output.embedPng(file.bytes);
    } catch {
      throw new PdfToolError(
        `“${file.name}” could not be read as a valid ${kind.toUpperCase()} image.`,
        "unsupported-image",
      );
    }
    if (!image.width || !image.height) {
      throw new PdfToolError(`“${file.name}” has invalid image dimensions.`, "unsupported-image");
    }
    let pageWidth = preset.width;
    let pageHeight = preset.height;
    const imageLandscape = image.width > image.height;
    if (
      options.orientation === "landscape" ||
      (options.orientation === "auto" && imageLandscape)
    ) {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }
    const page = output.addPage([pageWidth, pageHeight]);
    const background = hexToRgb(options.background);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(background.r, background.g, background.b),
    });
    const availableWidth = Math.max(1, pageWidth - margin * 2);
    const availableHeight = Math.max(1, pageHeight - margin * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return {
    bytes: await savePdf(output),
    pageCount: files.length,
  };
}

export function makeImageFromFile(file: File): Promise<ImageInputFile> {
  return file.arrayBuffer().then((bytes) => ({
    name: file.name,
    bytes,
    mimeType: file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"),
  }));
}

export function toolResultBlob(bytes: Uint8Array): Blob {
  const source = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([source], { type: "application/pdf" });
}

export function wordSafeFilename(base: string, suffix?: string): string {
  const clean = base
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
  return `${clean || "paperforge"}${suffix ? `-${suffix}` : ""}.pdf`;
}

export { wrapForPdf };
