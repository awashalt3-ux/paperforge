export const MAX_PDF_BYTES = 120 * 1024 * 1024; // 120 MB
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export function isPdfBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  return (
    header[0] === 0x25 && // %
    header[1] === 0x50 && // P
    header[2] === 0x44 && // D
    header[3] === 0x46 && // F
    header[4] === 0x2d // -
  );
}

export async function validatePdfFile(file: File): Promise<ArrayBuffer> {
  if (!file) throw new FileValidationError("No file was selected.");
  if (file.size === 0) throw new FileValidationError("The PDF file is empty.");
  if (file.size > MAX_PDF_BYTES) {
    throw new FileValidationError("This PDF is larger than the 120 MB limit.");
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new FileValidationError("Please choose a PDF file.");
  }
  const bytes = await readFileAsArrayBuffer(file);
  if (!isPdfBytes(bytes)) {
    throw new FileValidationError("This file is not a valid PDF, or it is corrupted.");
  }
  return bytes;
}

export function validateImageFile(file: File): void {
  if (!file) throw new FileValidationError("No image was selected.");
  if (file.size === 0) throw new FileValidationError("The image file is empty.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new FileValidationError("Images must be smaller than 25 MB.");
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new FileValidationError("Use a PNG, JPEG, WebP, GIF, or SVG image.");
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new FileValidationError("The image could not be decoded."));
    image.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new FileValidationError("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes an image, validates it, and normalizes it into a canvas-safe data URL.
 * Large photographs are capped at 4096 px on the long edge to keep documents
 * responsive while preserving print-ready resolution.
 */
export async function prepareImageFile(
  file: File,
  options: { maxDimension?: number } = {},
): Promise<{
  src: string;
  width: number;
  height: number;
  mimeType: string;
}> {
  validateImageFile(file);
  const rawUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(rawUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new FileValidationError("The image has invalid dimensions.");
    }
    const maxDimension = options.maxDimension ?? 4096;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));

    // JPEG can be preserved directly at its original quality.
    if (file.type === "image/jpeg" && scale === 1) {
      const src = await blobToDataUrl(file);
      return { src, width: image.naturalWidth, height: image.naturalHeight, mimeType: "image/jpeg" };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new FileValidationError("Your browser could not process this image.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const hasTransparency = file.type !== "image/jpeg";
    const src = canvas.toDataURL(hasTransparency ? "image/png" : "image/jpeg", 0.92);
    return {
      src,
      width: canvas.width,
      height: canvas.height,
      mimeType: hasTransparency ? "image/png" : "image/jpeg",
    };
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64ToUint8Array(base64);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
