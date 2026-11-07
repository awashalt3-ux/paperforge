import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  FileValidationError,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToUint8Array,
  isPdfBytes,
  uint8ArrayToBase64,
  validateImageFile,
  validatePdfFile,
} from "./files";

const pdfBytes = (content = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n") =>
  new TextEncoder().encode(content).buffer as ArrayBuffer;

describe("isPdfBytes", () => {
  it("recognizes a PDF header", () => {
    expect(isPdfBytes(pdfBytes())).toBe(true);
  });

  it("rejects short or non-PDF buffers", () => {
    expect(isPdfBytes(new ArrayBuffer(2))).toBe(false);
    expect(isPdfBytes(new TextEncoder().encode("hello world").buffer as ArrayBuffer)).toBe(false);
  });
});

describe("validatePdfFile", () => {
  it("returns the bytes of a valid PDF", async () => {
    const file = new File([pdfBytes()], "report.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file)).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it("rejects an empty file", async () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file)).rejects.toThrow("The PDF file is empty.");
  });

  it("rejects a file whose contents are not a PDF", async () => {
    const file = new File(["not a pdf"], "broken.pdf", { type: "application/pdf" });
    await expect(validatePdfFile(file)).rejects.toThrow(FileValidationError);
  });

  it("rejects a non-PDF file type", async () => {
    const file = new File(["%PDF-1.7"], "notes.txt", { type: "text/plain" });
    await expect(validatePdfFile(file)).rejects.toThrow("Please choose a PDF file.");
  });

  it("rejects files over the size limit", async () => {
    const file = new File([pdfBytes()], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: MAX_PDF_BYTES + 1 });
    await expect(validatePdfFile(file)).rejects.toThrow("120 MB limit");
  });
});

describe("validateImageFile", () => {
  it("accepts supported image types", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]) {
      expect(() => validateImageFile(new File(["x"], "image", { type }))).not.toThrow();
    }
  });

  it("rejects unsupported and empty images", () => {
    expect(() => validateImageFile(new File(["x"], "image.bmp", { type: "image/bmp" }))).toThrow(
      "Use a PNG, JPEG, WebP, GIF, or SVG image.",
    );
    expect(() => validateImageFile(new File([], "empty.png", { type: "image/png" }))).toThrow(
      "The image file is empty.",
    );
  });

  it("rejects oversized images", () => {
    const file = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });
    expect(() => validateImageFile(file)).toThrow("Images must be smaller than 25 MB.");
  });
});

describe("base64 helpers", () => {
  it("round-trips bytes and array buffers", () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    const encoded = uint8ArrayToBase64(bytes);
    expect(base64ToUint8Array(encoded)).toEqual(bytes);

    const buffer = arrayBufferToBase64(bytes.buffer as ArrayBuffer);
    expect(new Uint8Array(base64ToArrayBuffer(buffer))).toEqual(bytes);
  });
});
