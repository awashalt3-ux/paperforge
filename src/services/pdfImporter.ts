import { PDFDocument } from "pdf-lib";
import type { PaperDocument, PaperPage, StoredPdfAsset } from "@/types/document";
import { createDocumentId, createAssetId, createPageId } from "@/utils/id";
import { createMetadata } from "@/utils/documentFactory";
import { fileBaseName } from "@/lib/utils";
import { validatePdfFile } from "@/utils/files";

export const MAX_IMPORTED_PAGES = 500;

export interface PdfImportResult {
  document: PaperDocument;
  asset: StoredPdfAsset;
  pageCount: number;
}

export interface PdfInspection {
  pageCount: number;
  title: string;
  encrypted: boolean;
  dimensions: { width: number; height: number }[];
}

export class PdfImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfImportError";
  }
}

function normalizeRotation(angle: number): number {
  return ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
}

export async function inspectPdfFile(file: File): Promise<PdfInspection> {
  const bytes = await validatePdfFile(file);
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    if (pdf.getPageCount() === 0) {
      throw new PdfImportError("This PDF does not contain any pages.");
    }
    const dimensions = pdf.getPages().map((page) => {
      const crop = page.getCropBox();
      const rotation = normalizeRotation(page.getRotation().angle);
      return rotation % 180 === 0
        ? { width: crop.width, height: crop.height }
        : { width: crop.height, height: crop.width };
    });
    return {
      pageCount: pdf.getPageCount(),
      title: fileBaseName(file.name),
      encrypted: false,
      dimensions,
    };
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/encrypt|password/i.test(message)) {
      throw new PdfImportError(
        "This PDF is password protected. Remove the password before importing it.",
      );
    }
    throw new PdfImportError(
      "This PDF appears to be damaged or uses an unsupported format.",
    );
  }
}

/** Import a PDF as page sources, keeping the original vector pages intact. */
export async function importPdfFile(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PdfImportResult> {
  const inspection = await inspectPdfFile(file);
  if (inspection.pageCount > MAX_IMPORTED_PAGES) {
    throw new PdfImportError(
      `This PDF has ${inspection.pageCount} pages. Split it into files of ${MAX_IMPORTED_PAGES} pages or fewer before importing.`,
    );
  }
  onProgress?.("Preparing pages…");
  const bytes = await file.arrayBuffer();
  const documentId = createDocumentId();
  const assetId = createAssetId();
  const title = inspection.title;
  const now = Date.now();

  const pages: PaperPage[] = inspection.dimensions.map((dimensions, index) => ({
    id: createPageId(),
    width: dimensions.width,
    height: dimensions.height,
    background: "#ffffff",
    elements: [],
    source: {
      assetId,
      pageIndex: index,
      rotationOffset: 0,
      originalName: file.name,
    },
  }));

  const document: PaperDocument = {
    id: documentId,
    title,
    pages,
    createdAt: now,
    updatedAt: now,
    metadata: createMetadata(title),
  };

  const asset: StoredPdfAsset = {
    id: assetId,
    documentId,
    name: file.name,
    mimeType: "application/pdf",
    bytes,
    pageCount: inspection.pageCount,
    createdAt: now,
  };

  return { document, asset, pageCount: inspection.pageCount };
}
