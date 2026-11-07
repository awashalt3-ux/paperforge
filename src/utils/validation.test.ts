import { describe, expect, it } from "vitest";
import {
  formatValidationError,
  paperDocumentSchema,
  paperPageSchema,
  projectFileSchema,
} from "./validation";
import type { PaperDocument, PaperPage } from "@/types/document";

const page: PaperPage = {
  id: "page_1",
  width: 595.28,
  height: 841.89,
  background: "#ffffff",
  elements: [
    {
      id: "element_1",
      type: "text",
      x: 72,
      y: 72,
      width: 300,
      height: 60,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      text: "Quarterly report",
      role: "heading",
      fontFamily: "Inter",
      fontSize: 24,
      fontWeight: 600,
      italic: false,
      underline: false,
      color: "#1d1916",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
      padding: 0,
    },
  ],
};

const document: PaperDocument = {
  id: "doc_1",
  title: "Test document",
  pages: [page],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  metadata: {
    title: "Test document",
    author: "Paperforge",
    subject: "",
    keywords: ["test"],
    creator: "Paperforge",
  },
};

describe("paperDocumentSchema", () => {
  it("accepts a valid document and page", () => {
    expect(paperDocumentSchema.safeParse(document).success).toBe(true);
    expect(paperPageSchema.safeParse(page).success).toBe(true);
  });

  it("rejects a document without pages", () => {
    const result = paperDocumentSchema.safeParse({ ...document, pages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid geometry", () => {
    const result = paperPageSchema.safeParse({
      ...page,
      width: -10,
      elements: [{ ...page.elements[0], opacity: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown element discriminator", () => {
    const result = paperPageSchema.safeParse({
      ...page,
      elements: [{ ...page.elements[0], type: "video" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid page source index", () => {
    const result = paperPageSchema.safeParse({
      ...page,
      source: { assetId: "asset_1", pageIndex: -1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("projectFileSchema", () => {
  it("accepts a complete project file", () => {
    const result = projectFileSchema.safeParse({
      format: "paperforge-project",
      version: 1,
      exportedAt: 1_700_000_000_000,
      document,
      assets: [
        {
          id: "asset_1",
          name: "source.pdf",
          mimeType: "application/pdf",
          pageCount: 1,
          data: "JVBERi0=",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported versions and empty assets", () => {
    const base = {
      format: "paperforge-project",
      version: 2,
      exportedAt: 1_700_000_000_000,
      document,
      assets: [{ id: "asset_1", name: "x", mimeType: "application/pdf", pageCount: 0, data: "" }],
    };
    expect(projectFileSchema.safeParse(base).success).toBe(false);
    expect(projectFileSchema.safeParse({ ...base, version: 1 }).success).toBe(false);
  });
});

describe("formatValidationError", () => {
  it("renders the first issue with its path", () => {
    const result = paperDocumentSchema.safeParse({ ...document, title: "" });
    if (result.success) throw new Error("Expected validation to fail");
    expect(formatValidationError(result.error)).toMatch(/^title:/);
  });

  it("falls back when no issue is available", () => {
    expect(formatValidationError({ errors: [] } as never)).toBe("The project data is not valid.");
  });
});
