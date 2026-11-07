import type { PaperDocument, PaperPage, PdfMetadata } from "@/types/document";
import { createDocumentId, createPageId } from "@/utils/id";
import { defaultText } from "@/utils/elementDefaults";
import { resolvePageDimensions, type Orientation, type PageSizePreset } from "@/utils/pageSizes";

export interface CreateDocumentOptions {
  title: string;
  preset?: PageSizePreset;
  orientation?: Orientation;
  customWidth?: number;
  customHeight?: number;
}

export function createMetadata(title: string): PdfMetadata {
  return {
    title,
    author: "",
    subject: "",
    keywords: [],
    creator: "Paperforge",
  };
}

export function createBlankPage(
  width = 595.28,
  height = 841.89,
  background = "#ffffff",
): PaperPage {
  return {
    id: createPageId(),
    width,
    height,
    background,
    elements: [],
  };
}

export function createBlankDocument(options: CreateDocumentOptions): PaperDocument {
  const dimensions = resolvePageDimensions(
    options.preset ?? "a4",
    options.orientation ?? "portrait",
    {
      width: options.customWidth ?? 595.28,
      height: options.customHeight ?? 841.89,
    },
  );
  const now = Date.now();
  return {
    id: createDocumentId(),
    title: options.title.trim() || "Untitled document",
    pages: [createBlankPage(dimensions.width, dimensions.height)],
    createdAt: now,
    updatedAt: now,
    metadata: createMetadata(options.title.trim() || "Untitled document"),
  };
}

export function createStarterDocument(): PaperDocument {
  const document = createBlankDocument({ title: "Untitled document" });
  const page = document.pages[0];
  page.elements = [
    defaultText({
      id: "starter_title",
      x: 72,
      y: 120,
      width: 450,
      role: "heading",
      text: "A document with intent.",
      fontSize: 38,
      fontWeight: 700,
      lineHeight: 1.08,
      letterSpacing: -1,
    }),
    defaultText({
      id: "starter_body",
      x: 72,
      y: 238,
      width: 390,
      role: "body",
      text: "This page is yours to shape. Add text, images, tables, or a signature — then export a crisp, vector-true PDF.",
      fontSize: 12,
      lineHeight: 1.65,
      color: "#5d6663",
    }),
  ];
  return document;
}

export function duplicatePage(page: PaperPage, copy = false): PaperPage {
  const clone: PaperPage = structuredClone(page);
  clone.id = createPageId();
  clone.elements = page.elements.map((element) => ({
    ...structuredClone(element),
    id: copy
      ? `${element.id}_copy_${Math.random().toString(36).slice(2, 8)}`
      : element.id,
  }));
  return clone;
}

/**
 * Rotate a page's visible content 90° clockwise. Imported page sources are
 * normalized separately by pdfImporter; this handles dimensions and overlays.
 */
export function rotatePageData(page: PaperPage): PaperPage {
  const nextWidth = page.height;
  const nextHeight = page.width;
  return {
    ...page,
    width: nextWidth,
    height: nextHeight,
    source: page.source
      ? {
          ...page.source,
          rotationOffset: (((page.source.rotationOffset ?? 0) + 90) % 360 + 360) % 360,
        }
      : undefined,
    elements: page.elements.map((element) => ({
      ...element,
      x: page.height - element.y - element.height,
      y: element.x,
      width: element.height,
      height: element.width,
      rotation: (element.rotation + 90) % 360,
    })),
  };
}

export function documentWordCount(document: PaperDocument): number {
  return document.pages.reduce((total, page) => {
    const textElements = page.elements.filter((element) => element.type === "text");
    const tableCells = page.elements.flatMap((element) =>
      element.type === "table" ? element.rows.flat() : [],
    );
    const words = [
      ...textElements.map((element) => element.text),
      ...tableCells,
    ]
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return total + words;
  }, 0);
}
