import { describe, expect, it } from "vitest";
import { createZip, dataUrlToBytes } from "@/lib/zip";

const encoder = new TextEncoder();

async function readBlob(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

describe("createZip", () => {
  it("writes a local header, the payload, and an end-of-central-directory record", async () => {
    const payload = encoder.encode("hello paperforge");
    const zip = createZip([{ name: "note.txt", data: payload }]);
    const bytes = await readBlob(zip);

    expect(zip.type).toBe("application/zip");
    expect(readUint32(bytes, 0)).toBe(0x04034b50); // local file header
    expect(readUint16(bytes, 8)).toBe(0); // store, no compression
    expect(readUint32(bytes, 18)).toBe(payload.length);
    expect(readUint32(bytes, 22)).toBe(payload.length);

    const payloadStart = 30 + encoder.encode("note.txt").length;
    expect(Array.from(bytes.subarray(payloadStart, payloadStart + payload.length))).toEqual(
      Array.from(payload),
    );

    const endOffset = bytes.length - 22;
    expect(readUint32(bytes, endOffset)).toBe(0x06054b50);
    expect(readUint16(bytes, endOffset + 10)).toBe(1); // one entry
  });

  it("records every entry in the central directory", async () => {
    const zip = createZip([
      { name: "a.pdf", data: encoder.encode("aaa") },
      { name: "b.pdf", data: encoder.encode("bbbb") },
    ]);
    const bytes = await readBlob(zip);
    const endOffset = bytes.length - 22;
    expect(readUint16(bytes, endOffset + 8)).toBe(2);
    expect(readUint16(bytes, endOffset + 10)).toBe(2);
  });

  it("sanitises unsafe characters in entry names", async () => {
    const zip = createZip([{ name: "../bad:name?.pdf", data: encoder.encode("x") }]);
    const bytes = await readBlob(zip);
    const nameLength = readUint16(bytes, 26);
    const name = new TextDecoder().decode(bytes.subarray(30, 30 + nameLength));
    expect(name).not.toContain("..");
    expect(name).not.toContain(":");
    expect(name).not.toContain("?");
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("computes a CRC that matches the payload", async () => {
    // crc32("123456789") is 0xCBF43926 — a well-known check value.
    const zip = createZip([{ name: "check.txt", data: encoder.encode("123456789") }]);
    const bytes = await readBlob(zip);
    expect(readUint32(bytes, 14)).toBe(0xcbf43926);
  });
});

describe("dataUrlToBytes", () => {
  it("decodes a base64 data URL", () => {
    const bytes = dataUrlToBytes("data:application/pdf;base64,UGFwZXJmb3JnZQ==");
    expect(new TextDecoder().decode(bytes)).toBe("Paperforge");
  });

  it("returns an empty array for a malformed payload", () => {
    expect(dataUrlToBytes("not-a-data-url")).toHaveLength(0);
  });
});
