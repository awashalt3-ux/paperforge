export interface RGB {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "#00000000",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  gray: "#6b7280",
  grey: "#6b7280",
};

export function normalizeHex(input: string): string {
  let value = (input || "").trim().toLowerCase();
  if (NAMED[value]) value = NAMED[value];
  if (!value.startsWith("#")) value = `#${value}`;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  if (/^#[0-9a-f]{4}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}${value[4]}${value[4]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{8}$/.test(value)) return value.slice(0, 7);
  return "#000000";
}

export function hexToRgb(input: string): RGB {
  const hex = normalizeHex(input).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function withAlpha(color: string, alpha: number): string {
  const hex = normalizeHex(color);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function readableTextColor(background: string): string {
  const { r, g, b } = hexToRgb(background);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.58 ? "#16201e" : "#ffffff";
}

export const COLOR_SWATCHES = [
  "#16201e",
  "#3f4a47",
  "#7a8582",
  "#b8bfbd",
  "#ffffff",
  "#265249",
  "#397e6e",
  "#78b7a5",
  "#d7ece5",
  "#b45309",
  "#d97706",
  "#fbbf24",
  "#9f1239",
  "#e11d48",
  "#fecdd3",
  "#1e3a8a",
  "#2563eb",
  "#bfdbfe",
  "#4c1d95",
  "#7c3aed",
  "#ddd6fe",
];
