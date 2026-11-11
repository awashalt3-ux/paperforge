import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  PdfToolError,
  addPageNumbers,
  addWatermark,
  extractPdfPages,
  getPdfInfo,
  imagesToPdf,
  mergePdfs,
  parsePageOrder,
  parsePageRanges,
  removePdfPages,
  reorderPdfPages,
  rotatePdf,
  splitPdf,
  toolResultBlob,
  wordSafeFilename,
  type ImageInputFile,
} from "./pdfTools";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function makePdf(pageCount: number, width = 200, height = 300): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([width, height]);
    page.drawText(`Page ${index + 1}`, { x: 12, y: 12, size: 10, font });
  }
  return toArrayBuffer(await pdf.save());
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes);
}

describe("parsePageRanges", () => {
  it("expands ranges, combines segments, and removes duplicates", () => {
    expect(parsePageRanges("1-3, 5", 6)).toEqual([1, 2, 3, 5]);
    expect(parsePageRanges("1,1,2, 2-3", 3)).toEqual([1, 2, 3]);
    expect(parsePageRanges("2", 4)).toEqual([2]);
    expect(parsePageRanges(" 1 - 2 ", 3)).toEqual([1, 2]);
  });

  it("rejects empty, malformed, descending, and out-of-range input", () => {
    expect(() => parsePageRanges("", 3)).toThrow(PdfToolError);
    expect(() => parsePageRanges("abc", 3)).toThrow(/whole page numbers/i);
    expect(() => parsePageRanges("3-2", 3)).toThrow(/count upwards/i);
    expect(() => parsePageRanges("0", 3)).toThrow(/between 1 and 3/i);
    expect(() => parsePageRanges("4", 3)).toThrow(/between 1 and 3/i);
    expect(() => parsePageRanges("1-2-3", 3)).toThrow(/not a valid page range/i);
  });
});

describe("parsePageOrder", () => {
  it("accepts a complete permutation", () => {
    expect(parsePageOrder("3 1 2", 3)).toEqual([3, 1, 2]);
    expect(parsePageOrder("2, 4, 1, 3", 4)).toEqual([2, 4, 1, 3]);
  });

  it("rejects missing, duplicate, and invalid pages", () => {
    expect(() => parsePageOrder("1 2", 3)).toThrow(/all 3 page numbers/i);
    expect(() => parsePageOrder("1 1 3", 3)).toThrow(/exactly once/i);
    expect(() => parsePageOrder("1 2 4", 3)).toThrow(/every page from 1 to 3/i);
    expect(() => parsePageOrder("1 2 3 4", 3)).toThrow(/all 3 page numbers/i);
  });
});

describe("PDF tool operations", () => {
  it("reads PDF information", async () => {
    await expect(getPdfInfo(await makePdf(4))).resolves.toMatchObject({ pageCount: 4 });
  });

  it("merges PDFs in order", async () => {
    const result = await mergePdfs([
      { name: "a.pdf", bytes: await makePdf(2) },
      { name: "b.pdf", bytes: await makePdf(3) },
    ]);
    expect(result.pageCount).toBe(5);
    expect((await load(result.bytes)).getPageCount()).toBe(5);
  });

  it("requires at least two PDFs to merge", async () => {
    await expect(mergePdfs([{ name: "a.pdf", bytes: await makePdf(1) }])).rejects.toThrow(
      "Choose at least two PDF files to merge.",
    );
  });

  it("splits every page, fixed chunks, and custom ranges", async () => {
    const bytes = await makePdf(5);

    const each = await splitPdf(bytes, { mode: "each", chunkSize: 2, ranges: "" });
    expect(each).toHaveLength(5);
    expect(each.map((result) => result.pageNumbers)).toEqual([[1], [2], [3], [4], [5]]);
    expect(each[0].name).toBe("page-1");

    const chunks = await splitPdf(bytes, { mode: "chunks", chunkSize: 2, ranges: "" });
    expect(chunks.map((result) => result.pageCount)).toEqual([2, 2, 1]);
    expect(chunks[0].name).toBe("pages-1-2");

    const ranges = await splitPdf(bytes, { mode: "ranges", chunkSize: 2, ranges: "1-2, 3-5" });
    expect(ranges.map((result) => result.pageNumbers)).toEqual([
      [1, 2],
      [3, 4, 5],
    ]);
  });

  it("rotates every page or a selected page", async () => {
    const all = await rotatePdf(await makePdf(3), 90);
    const allPages = (await load(all.bytes)).getPages();
    expect(allPages.map((page) => page.getRotation().angle)).toEqual([90, 90, 90]);

    const selected = await rotatePdf(await makePdf(3), 270, "2");
    const selectedPages = (await load(selected.bytes)).getPages();
    expect(selectedPages.map((page) => page.getRotation().angle)).toEqual([0, 270, 0]);
  });

  it("removes selected pages but never the last page", async () => {
    const result = await removePdfPages(await makePdf(4), "2, 4");
    expect(result.pageCount).toBe(2);
    await expect(removePdfPages(await makePdf(3), "1-3")).rejects.toThrow(
      "A PDF must keep at least one page.",
    );
  });

  it("reorders pages and validates the permutation", async () => {
    const result = await reorderPdfPages(await makePdf(3), "3 1 2");
    expect(result.pageCount).toBe(3);
    await expect(reorderPdfPages(await makePdf(3), "1 2")).rejects.toThrow(PdfToolError);
  });

  it("extracts selected pages in ascending order", async () => {
    const result = await extractPdfPages(await makePdf(5), "4, 2-3");
    expect(result.pageCount).toBe(3);
    expect((await load(result.bytes)).getPageCount()).toBe(3);
  });

  it("applies watermarks and page numbers", async () => {
    const bytes = await makePdf(3);
    const watermarked = await addWatermark(bytes, {
      text: "CONFIDENTIAL",
      fontSize: 48,
      color: "#265249",
      opacity: 0.2,
      rotation: 45,
      position: "center",
      pages: "all",
    });
    expect(watermarked.pageCount).toBe(3);
    expect(watermarked.bytes.byteLength).toBeGreaterThan(bytes.byteLength);

    const numbered = await addPageNumbers(bytes, {
      position: "bottom-center",
      format: "page-of-total",
      start: 1,
      fontSize: 10,
      color: "#5d6663",
      margin: 36,
      pages: "all",
    });
    expect(numbered.pageCount).toBe(3);
    expect((await load(numbered.bytes)).getPages()[0].getRotation().angle).toBe(0);
  });

  it("converts a PNG to a matching page and rejects unsupported images", async () => {
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n2kAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    const image: ImageInputFile = {
      name: "pixel.png",
      bytes: toArrayBuffer(png),
      mimeType: "image/png",
    };
    const result = await imagesToPdf([image], {
      preset: "a4",
      orientation: "auto",
      margin: 24,
      background: "#ffffff",
    });
    expect(result.pageCount).toBe(1);
    const pages = (await load(result.bytes)).getPages();
    expect(pages[0].getWidth()).toBeCloseTo(595.28, 2);

    await expect(
      imagesToPdf(
        [{ name: "photo.bmp", bytes: toArrayBuffer(new Uint8Array([0x42, 0x4d])), mimeType: "image/bmp" }],
        { preset: "a4", orientation: "auto", margin: 24, background: "#ffffff" },
      ),
    ).rejects.toMatchObject({ code: "unsupported-image" });
  });
});

describe("PDF tool helpers", () => {
  it("builds a PDF blob", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const blob = toolResultBlob(bytes);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(4);
  });

  it("sanitizes filenames", () => {
    expect(wordSafeFilename("Q2 / Report: Final")).toBe("Q2 - Report- Final.pdf");
    expect(wordSafeFilename("report.pdf", "merged")).toBe("report-merged.pdf");
    expect(wordSafeFilename("   ")).toBe("paperforge.pdf");
  });
});
