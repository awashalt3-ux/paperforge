export interface PagePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
}

/** PDF points (1pt = 1/72in). */
export const PAGE_PRESETS: PagePreset[] = [
  { id: "a4", label: "A4", width: 595.28, height: 841.89, description: "210 × 297 mm" },
  { id: "a5", label: "A5", width: 419.53, height: 595.28, description: "148 × 210 mm" },
  { id: "letter", label: "Letter", width: 612, height: 792, description: "8.5 × 11 in" },
  { id: "a3", label: "A3", width: 841.89, height: 1190.55, description: "297 × 420 mm" },
];

export type PageSizePreset = "a4" | "a5" | "letter" | "a3" | "custom";
export type Orientation = "portrait" | "landscape";

export interface PageDimensions {
  width: number;
  height: number;
}

export const MIN_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 5000;

export function resolvePageDimensions(
  preset: PageSizePreset,
  orientation: Orientation,
  custom?: PageDimensions,
): PageDimensions {
  let width: number;
  let height: number;
  if (preset === "custom" && custom) {
    width = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, custom.width));
    height = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, custom.height));
    return { width, height };
  }
  const found = PAGE_PRESETS.find((p) => p.id === preset) ?? PAGE_PRESETS[0];
  width = found.width;
  height = found.height;
  if (orientation === "landscape") {
    [width, height] = [height, width];
  }
  return { width, height };
}

export function getPresetLabel(width: number, height: number): string {
  const w = Math.min(width, height);
  const h = Math.max(width, height);
  const found = PAGE_PRESETS.find(
    (p) => Math.abs(p.width - w) < 1.5 && Math.abs(p.height - h) < 1.5,
  );
  if (found) return found.label;
  return "Custom";
}

export function pageOrientation(width: number, height: number): Orientation {
  return width > height ? "landscape" : "portrait";
}

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}
