import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getPdfAsset } from "@/db/database";
import type { PageSourceRef, StoredPdfAsset } from "@/types/document";
import { clamp } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface CachedDocument {
  document: PDFDocumentProxy;
  pageCount: number;
}

const documentCache = new Map<string, Promise<CachedDocument>>();
const renderCache = new Map<string, Promise<string>>();
const MAX_RENDER_CACHE = 120;

function evictRenderCache(): void {
  if (renderCache.size <= MAX_RENDER_CACHE) return;
  const entries = [...renderCache.keys()];
  for (let i = 0; i < entries.length - MAX_RENDER_CACHE; i += 1) {
    renderCache.delete(entries[i]);
  }
}

export class PdfRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderError";
  }
}

async function loadDocument(
  key: string,
  bytes: ArrayBuffer,
): Promise<CachedDocument> {
  const cached = documentCache.get(key);
  if (cached) return cached;

  const loading = (async () => {
    try {
      // PDF.js may transfer the buffer to its worker; pass a safe copy.
      const data = new Uint8Array(bytes.slice(0));
      const document = await pdfjs.getDocument({
        data,
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
      return { document, pageCount: document.numPages };
    } catch (error) {
      documentCache.delete(key);
      const message =
        error instanceof Error ? error.message : "The PDF could not be rendered.";
      if (/password/i.test(message)) {
        throw new PdfRenderError("This PDF is password protected and cannot be previewed.");
      }
      throw new PdfRenderError(`This PDF could not be rendered. ${message}`);
    }
  })();

  documentCache.set(key, loading);
  return loading;
}

export async function getPdfjsDocumentForAsset(
  asset: StoredPdfAsset,
): Promise<PDFDocumentProxy> {
  const loaded = await loadDocument(asset.id, asset.bytes);
  return loaded.document;
}

export async function renderPdfPage(
  asset: StoredPdfAsset,
  pageIndex: number,
  targetWidth: number,
  background = "#ffffff",
  rotationOffset = 0,
): Promise<string> {
  const width = Math.round(clamp(targetWidth, 80, 2400));
  const offset = ((Math.round(rotationOffset / 90) * 90) % 360 + 360) % 360;
  const key = `${asset.id}:${pageIndex}:${width}:${offset}`;
  const existing = renderCache.get(key);
  if (existing) return existing;

  const rendering = (async () => {
    const loaded = await loadDocument(asset.id, asset.bytes);
    if (pageIndex < 0 || pageIndex >= loaded.pageCount) {
      throw new PdfRenderError("This page no longer exists in the source PDF.");
    }
    let page: PDFPageProxy | null = null;
    try {
      page = await loaded.document.getPage(pageIndex + 1);
      const finalRotation = (page.rotate + offset) % 360;
      const naturalViewport = page.getViewport({ scale: 1, rotation: finalRotation });
      const scale = width / naturalViewport.width;
      const viewport = page.getViewport({ scale, rotation: finalRotation });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new PdfRenderError("Canvas rendering is unavailable.");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      const task = page.render({ canvasContext: context, viewport });
      await task.promise;
      return canvas.toDataURL("image/png");
    } catch (error) {
      if (error instanceof PdfRenderError) throw error;
      const message = error instanceof Error ? error.message : "Unknown rendering error.";
      throw new PdfRenderError(`Page rendering failed. ${message}`);
    } finally {
      page?.cleanup();
    }
  })();

  renderCache.set(key, rendering);
  evictRenderCache();
  try {
    return await rendering;
  } catch (error) {
    renderCache.delete(key);
    throw error;
  }
}

export async function renderPageSource(
  source: PageSourceRef,
  targetWidth: number,
  background = "#ffffff",
): Promise<string> {
  const asset = await getPdfAsset(source.assetId);
  if (!asset) {
    throw new PdfRenderError("The original PDF for this page is missing.");
  }
  return renderPdfPage(
    asset,
    source.pageIndex,
    targetWidth,
    background,
    source.rotationOffset ?? 0,
  );
}

export async function getPdfPageDimensions(
  asset: StoredPdfAsset,
): Promise<{ width: number; height: number }[]> {
  const document = await getPdfjsDocumentForAsset(asset);
  const dimensions: { width: number; height: number }[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    dimensions.push({ width: viewport.width, height: viewport.height });
    page.cleanup();
  }
  return dimensions;
}

export interface RasterizedPage {
  pageNumber: number;
  width: number;
  height: number;
  /** Pixel width at the requested scale. */
  pixelWidth: number;
  pixelHeight: number;
  dataUrl: string;
}

/**
 * Rasterize an in-memory PDF (typically the output of the export engine) into
 * page images. Used by PNG/JPG export and the print view so both share the same
 * vector-faithful rendering path as the exported PDF.
 */
export async function rasterizePdfBytes(
  bytes: Uint8Array,
  options: {
    /** Multiplier on the PDF's 72 dpi user space. 2 ≈ 144 dpi. */
    scale?: number;
    format?: "png" | "jpeg";
    quality?: number;
    background?: string;
    maxPixelDimension?: number;
    onProgress?: (current: number, total: number) => void;
  } = {},
): Promise<RasterizedPage[]> {
  const scale = clamp(options.scale ?? 2, 0.5, 6);
  const format = options.format ?? "png";
  const quality = clamp(options.quality ?? 0.92, 0.4, 1);
  const background = options.background ?? "#ffffff";
  const maxPixelDimension = options.maxPixelDimension ?? 5000;

  const data = new Uint8Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  let document: PDFDocumentProxy;
  try {
    document = await pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The PDF could not be read.";
    throw new PdfRenderError(`The document could not be rasterized. ${message}`);
  }

  const pages: RasterizedPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale });
        const pixelScale = Math.min(
          1,
          maxPixelDimension / Math.max(viewport.width, viewport.height),
        );
        const finalViewport = page.getViewport({ scale: scale * pixelScale });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(finalViewport.width));
        canvas.height = Math.max(1, Math.ceil(finalViewport.height));
        const context = canvas.getContext("2d", { alpha: format === "png" });
        if (!context) throw new PdfRenderError("Canvas rendering is unavailable.");
        if (format === "jpeg") {
          context.fillStyle = background;
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        await page.render({ canvasContext: context, viewport: finalViewport }).promise;
        pages.push({
          pageNumber,
          width: finalViewport.width / scale,
          height: finalViewport.height / scale,
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          dataUrl: canvas.toDataURL(
            format === "jpeg" ? "image/jpeg" : "image/png",
            quality,
          ),
        });
      } finally {
        page.cleanup();
      }
      options.onProgress?.(pageNumber, document.numPages);
    }
  } finally {
    await document.destroy().catch(() => undefined);
  }
  return pages;
}

export async function disposePdfAsset(assetId: string): Promise<void> {
  const cached = documentCache.get(assetId);
  documentCache.delete(assetId);
  for (const key of [...renderCache.keys()]) {
    if (key.startsWith(`${assetId}:`)) renderCache.delete(key);
  }
  if (cached) {
    try {
      const { document } = await cached;
      await document.destroy();
    } catch {
      // Already disposed or invalid.
    }
  }
}

export async function disposeAllPdfDocuments(): Promise<void> {
  const cached = [...documentCache.values()];
  documentCache.clear();
  renderCache.clear();
  await Promise.allSettled(
    cached.map(async (promise) => {
      try {
        const { document } = await promise;
        await document.destroy();
      } catch {
        // Ignore failures while clearing.
      }
    }),
  );
}
