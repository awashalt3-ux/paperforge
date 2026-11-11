import type { PaperDocument } from "@/types/document";
import { exportDocumentToPdf } from "@/services/pdfExport";
import { rasterizePdfBytes } from "@/services/pdfRenderer";

/**
 * Print a document through the browser print dialog.
 *
 * The document is rendered to a PDF, rasterized into page images, and placed in
 * a hidden iframe sized to the real page dimensions. Printing the rasterized
 * output avoids browser-specific quirks with PDF iframes and keeps rotated and
 * cropped imported pages exactly as exported.
 */
export async function printDocument(
  document: PaperDocument,
  onProgress?: (label: string) => void,
): Promise<void> {
  onProgress?.("Rendering pages for print");
  const bytes = await exportDocumentToPdf(document, {
    sizeMode: "original",
    preset: "a4",
    orientation: "auto",
    margin: 0,
    metadata: document.metadata,
  });

  onProgress?.("Preparing the print view");
  const pages = await rasterizePdfBytes(bytes, {
    scale: 2,
    format: "png",
    background: "#ffffff",
  });

  const iframe = window.document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  window.document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error("The browser blocked the print view.");
  }

  frameDocument.open();
  frameDocument.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      document.title,
    )}</title><style>
      @page { margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page { display: block; width: 100%; height: auto; page-break-after: always; break-after: page; }
      .page:last-child { page-break-after: auto; break-after: auto; }
    </style></head><body>${pages
      .map(
        (page) =>
          `<img class="page" src="${page.dataUrl}" width="${page.pixelWidth}" height="${page.pixelHeight}" alt="" />`,
      )
      .join("")}</body></html>`,
  );
  frameDocument.close();

  await new Promise<void>((resolve) => {
    const images = Array.from(frameDocument.images);
    let remaining = images.length;
    if (remaining === 0) {
      resolve();
      return;
    }
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
    };
    images.forEach((image) => {
      if (image.complete) done();
      else {
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      }
    });
  });

  try {
    frameWindow.focus();
    frameWindow.print();
  } finally {
    window.setTimeout(() => iframe.remove(), 60_000);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
