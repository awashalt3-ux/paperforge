import { describe, expect, it } from "vitest";
import {
  TEMPLATE_DEFINITIONS,
  getTemplatePreviewPage,
  instantiateTemplate,
} from "./index";
import { paperDocumentSchema } from "@/utils/validation";

const EXPECTED_IDS = [
  "invoice",
  "quotation",
  "resume",
  "letter",
  "proposal",
  "meeting-report",
  "certificate",
  "contract",
];

describe("template library", () => {
  it("ships all eight required templates", () => {
    expect(TEMPLATE_DEFINITIONS).toHaveLength(8);
    expect(TEMPLATE_DEFINITIONS.map((template) => template.id)).toEqual(EXPECTED_IDS);
    for (const template of TEMPLATE_DEFINITIONS) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.category.length).toBeGreaterThan(0);
      expect(template.tags.length).toBeGreaterThan(0);
      expect(template.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("builds valid, populated pages for every template", () => {
    for (const template of TEMPLATE_DEFINITIONS) {
      const { pages } = template.build();
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) {
        expect(page.width).toBeGreaterThan(0);
        expect(page.height).toBeGreaterThan(0);
        expect(page.elements.length).toBeGreaterThan(0);
        expect(page.elements.every((element) => element.id.length > 0)).toBe(true);
      }
    }
  });

  it("instantiates every template as a schema-valid document", () => {
    for (const template of TEMPLATE_DEFINITIONS) {
      const document = instantiateTemplate(template.id);
      expect(document).not.toBeNull();
      const parsed = paperDocumentSchema.safeParse(document);
      expect(parsed.success, template.id).toBe(true);
      expect(document?.templateId).toBe(template.id);
      expect(document?.metadata.creator).toBe("Paperforge");
      expect(document?.metadata.keywords).toEqual(template.tags);
    }
  });

  it("regenerates document and element ids on every instantiation", () => {
    const first = instantiateTemplate("invoice");
    const second = instantiateTemplate("invoice");
    expect(first?.id).not.toBe(second?.id);
    expect(first?.pages[0].id).not.toBe(second?.pages[0].id);
    expect(first?.pages[0].elements[0].id).not.toBe(second?.pages[0].elements[0].id);
  });

  it("honours a custom title and falls back to the template title", () => {
    expect(instantiateTemplate("resume", "  Elena Moreau  ")?.title).toBe("Elena Moreau");
    expect(instantiateTemplate("resume")?.title).toBe("Resume / CV");
    expect(instantiateTemplate("resume", "   ")?.title).toBe("Resume / CV");
  });

  it("returns null for unknown templates", () => {
    expect(instantiateTemplate("does-not-exist")).toBeNull();
    expect(getTemplatePreviewPage("does-not-exist")).toBeNull();
  });

  it("returns the first page for previews", () => {
    const preview = getTemplatePreviewPage("proposal");
    expect(preview).not.toBeNull();
    expect(preview?.elements.length).toBeGreaterThan(0);
    expect(getTemplatePreviewPage("proposal")).toBe(preview);
  });
});
