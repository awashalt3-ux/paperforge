import { writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfFixtureOptions {
  pageCount?: number;
  width?: number;
  height?: number;
  text?: string;
}

export async function makePdfBytes({
  pageCount = 2,
  width = 320,
  height = 480,
  text = "Paperforge fixture",
}: PdfFixtureOptions = {}): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage([width, height]);
    page.drawText(`${text} ${index + 1}`, { x: 24, y: height - 50, size: 16, font });
  }
  return Buffer.from(await pdf.save());
}

export async function writePdfFixture(
  targetPath: string,
  options: PdfFixtureOptions = {},
): Promise<string> {
  await writeFile(targetPath, await makePdfBytes(options));
  return targetPath;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([length, payload, checksum]);
}

/** Builds a small solid-color RGB PNG for editor image-upload tests. */
export function makePngBytes(width = 96, height = 64): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = 47;
    row[2 + x * 3] = 111;
    row[3 + x * 3] = 78;
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function writePngFixture(
  targetPath: string,
  dimensions: { width?: number; height?: number } = {},
): Promise<string> {
  await writeFile(targetPath, makePngBytes(dimensions.width, dimensions.height));
  return targetPath;
}

export async function readDownloadedPdf(downloadPath: string): Promise<PDFDocument> {
  const { readFile } = await import("node:fs/promises");
  return PDFDocument.load(await readFile(downloadPath));
}

/** Counts embedded image XObjects in a PDF loaded with pdf-lib. */
export function countPdfImages(pdf: PDFDocument): number {
  let count = 0;
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream) {
      const subtype = object.dict.get(PDFName.of("Subtype"));
      if (subtype instanceof PDFName && subtype.asString() === "/Image") count += 1;
    }
  }
  return count;
}

export async function extractPdfText(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return pages;
}
