import type { PaperDocument } from "@/types/document";
import { exportDocumentToPdf, type PdfExportOptions } from "@/services/pdfExport";
import { rasterizePdfBytes, type RasterizedPage } from "@/services/pdfRenderer";
import { fileBaseName } from "@/lib/utils";
import { dataUrlToUint8Array } from "@/utils/files";

export type ImageFormat = "png" | "jpeg";

export interface ImageExportOptions {
  format: ImageFormat;
  /** 1 = 72 dpi, 2 = 144 dpi, 3 = 216 dpi, 4 = 288 dpi. */
  scale: number;
  quality: number;
  pageIndices?: number[];
  background?: string;
}

export interface ImageExportProgress {
  current: number;
  total: number;
  label: string;
}

export interface ExportedImage {
  filename: string;
  blob: Blob;
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  pageNumber: number;
}

export function imageMimeType(format: ImageFormat): string {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

export function imageExtension(format: ImageFormat): string {
  return format === "jpeg" ? "jpg" : "png";
}

/**
 * Render the document to a PDF first (so text stays vector-true and imported
 * pages keep their fidelity), then rasterize that PDF. This guarantees the
 * image matches what Export PDF produces instead of the on-screen canvas.
 */
export async function exportDocumentToImages(
  document: PaperDocument,
  options: ImageExportOptions,
  onProgress?: (progress: ImageExportProgress) => void,
): Promise<ExportedImage[]> {
  const mimeType = imageMimeType(options.format);
  const extension = imageExtension(options.format);
  const baseName = fileBaseName(document.title) || "paperforge-document";
  const total = options.pageIndices?.length ?? document.pages.length;

  const pdfOptions: PdfExportOptions = {
    sizeMode: "original",
    preset: "a4",
    orientation: "auto",
    margin: 0,
    pageIndices: options.pageIndices,
    metadata: document.metadata,
  };

  onProgress?.({ current: 0, total, label: "Rendering pages" });
  const bytes = await exportDocumentToPdf(document, pdfOptions);

  const rasterized: RasterizedPage[] = await rasterizePdfBytes(bytes, {
    scale: options.scale,
    format: options.format,
    quality: options.quality,
    background: options.background,
    onProgress: (current, pageTotal) =>
      onProgress?.({ current, total: pageTotal, label: "Writing images" }),
  });

  return rasterized.map((page, index) => {
    const pageBytes = dataUrlToUint8Array(page.dataUrl);
    return {
      filename: `${baseName}-page-${String(page.pageNumber || index + 1).padStart(2, "0")}.${extension}`,
      blob: new Blob([pageBytes as unknown as BlobPart], { type: mimeType }),
      bytes: pageBytes,
      mimeType,
      width: page.pixelWidth,
      height: page.pixelHeight,
      pageNumber: page.pageNumber || index + 1,
    };
  });
}
