import { describe, expect, it } from "vitest";
import {
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGE_PRESETS,
  getPresetLabel,
  mmToPt,
  pageOrientation,
  ptToMm,
  resolvePageDimensions,
} from "./pageSizes";

describe("resolvePageDimensions", () => {
  it("returns portrait A4 dimensions", () => {
    expect(resolvePageDimensions("a4", "portrait")).toEqual({ width: 595.28, height: 841.89 });
  });

  it("swaps dimensions for landscape", () => {
    expect(resolvePageDimensions("a5", "landscape")).toEqual({ width: 595.28, height: 419.53 });
  });

  it("clamps custom dimensions to the supported range", () => {
    expect(resolvePageDimensions("custom", "portrait", { width: 10, height: 9000 })).toEqual({
      width: MIN_PAGE_SIZE,
      height: MAX_PAGE_SIZE,
    });
  });

  it("falls back to A4 for an unknown preset", () => {
    expect(resolvePageDimensions("unknown" as never, "portrait")).toEqual({
      width: PAGE_PRESETS[0].width,
      height: PAGE_PRESETS[0].height,
    });
  });
});

describe("page labels and orientation", () => {
  it("recognizes presets in either orientation, allowing a small tolerance", () => {
    expect(getPresetLabel(595.28, 841.89)).toBe("A4");
    expect(getPresetLabel(841.89, 595.28)).toBe("A4");
    expect(getPresetLabel(612, 792)).toBe("Letter");
    expect(getPresetLabel(500, 700)).toBe("Custom");
  });

  it("identifies landscape and portrait pages", () => {
    expect(pageOrientation(841.89, 595.28)).toBe("landscape");
    expect(pageOrientation(595.28, 841.89)).toBe("portrait");
    expect(pageOrientation(500, 500)).toBe("portrait");
  });
});

describe("millimetre conversions", () => {
  it("converts millimetres to points and back", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 8);
    expect(ptToMm(72)).toBeCloseTo(25.4, 8);
    expect(ptToMm(mmToPt(210))).toBeCloseTo(210, 8);
  });
});
