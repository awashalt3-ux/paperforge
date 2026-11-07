import type {
  FontFamily,
  ImageElement,
  PaperElement,
  ShapeElement,
  TableElement,
  TextElement,
} from "@/types/document";

export const DEFAULT_TEXT_COLOR = "#18211f";
export const DEFAULT_ACCENT = "#2b6559";
export const DEFAULT_FONT: FontFamily = "Inter";

export const FONT_FAMILIES: { value: FontFamily; label: string; css: string }[] = [
  { value: "Inter", label: "Inter", css: "Inter, system-ui, sans-serif" },
  { value: "Helvetica", label: "Helvetica", css: "Helvetica, Arial, sans-serif" },
  { value: "Times New Roman", label: "Times New Roman", css: "'Times New Roman', Times, serif" },
  { value: "Courier New", label: "Courier New", css: "'Courier New', Courier, monospace" },
];

export const FONT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extrabold" },
];

export function cssFontFamily(font: FontFamily): string {
  return FONT_FAMILIES.find((f) => f.value === font)?.css ?? FONT_FAMILIES[0].css;
}

export const TEXT_ROLE_PRESETS: Record<
  TextElement["role"],
  Pick<TextElement, "fontSize" | "fontWeight" | "lineHeight" | "letterSpacing" | "color">
> = {
  heading: { fontSize: 32, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.4, color: DEFAULT_TEXT_COLOR },
  subheading: { fontSize: 18, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.1, color: DEFAULT_TEXT_COLOR },
  body: { fontSize: 11, fontWeight: 400, lineHeight: 1.55, letterSpacing: 0, color: DEFAULT_TEXT_COLOR },
  caption: { fontSize: 8.5, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.2, color: "#6b7471" },
};

export function defaultText(
  overrides: Partial<TextElement> & Pick<TextElement, "id" | "x" | "y">,
): TextElement {
  const role = overrides.role ?? "body";
  const preset = TEXT_ROLE_PRESETS[role];
  return {
    type: "text",
    text: overrides.text ?? (role === "heading" ? "Untitled heading" : "Start writing…"),
    role,
    width: role === "heading" ? 360 : 280,
    height: role === "heading" ? 44 : 20,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fontFamily: DEFAULT_FONT,
    fontSize: preset.fontSize,
    fontWeight: preset.fontWeight,
    italic: false,
    underline: false,
    color: preset.color,
    align: "left",
    lineHeight: preset.lineHeight,
    letterSpacing: preset.letterSpacing,
    padding: 0,
    ...overrides,
  };
}

export function defaultImage(
  overrides: Partial<ImageElement> & Pick<ImageElement, "id" | "x" | "y" | "src">,
): ImageElement {
  return {
    type: "image",
    role: "image",
    width: 240,
    height: 160,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fit: "contain",
    cornerRadius: 0,
    ...overrides,
  };
}

export function defaultShape(
  overrides: Partial<ShapeElement> & Pick<ShapeElement, "id" | "x" | "y" | "shape">,
): ShapeElement {
  const isLine = overrides.shape === "line";
  const isHighlight = overrides.purpose === "highlight";
  return {
    type: "shape",
    width: isLine ? 180 : 140,
    height: isLine ? 2 : 96,
    rotation: 0,
    opacity: isLine ? 1 : isHighlight ? 0.42 : 1,
    locked: false,
    visible: true,
    purpose: "shape",
    fill: isHighlight ? "#f8d34d" : isLine ? "transparent" : "#dcebe6",
    stroke: isLine ? "#265249" : "transparent",
    strokeWidth: isLine ? 2 : 0,
    cornerRadius: 6,
    ...overrides,
  };
}

export function defaultTable(
  overrides: Partial<TableElement> & Pick<TableElement, "id" | "x" | "y">,
): TableElement {
  return {
    type: "table",
    width: 500,
    height: 152,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    rows:
      overrides.rows ??
      [
        ["Description", "Qty", "Rate", "Amount"],
        ["Consultation", "1", "$1,200.00", "$1,200.00"],
        ["Design & direction", "12", "$120.00", "$1,440.00"],
        ["", "", "", ""],
      ],
    headerRow: true,
    fontFamily: DEFAULT_FONT,
    fontSize: 9.5,
    color: "#26302d",
    headerColor: "#ffffff",
    headerBackground: "#265249",
    borderColor: "#d7dddb",
    borderWidth: 0.75,
    cellPadding: 8,
    ...overrides,
  };
}

export function elementDisplayName(element: PaperElement): string {
  switch (element.type) {
    case "text":
      if (element.role === "heading") return "Heading";
      if (element.role === "subheading") return "Subheading";
      if (element.role === "caption") return "Caption";
      return "Text";
    case "image":
      if (element.role === "logo") return "Logo";
      if (element.role === "signature") return "Signature";
      return "Image";
    case "shape":
      if (element.purpose === "highlight") return "Highlight";
      return element.shape === "ellipse" ? "Ellipse" : element.shape === "line" ? "Line" : "Rectangle";
    case "table":
      return "Table";
    default:
      return "Element";
  }
}

export function cloneElementWithOffset(element: PaperElement, offset = 16): PaperElement {
  return {
    ...structuredClone(element),
    id: `${element.id}_copy_${Math.random().toString(36).slice(2, 8)}`,
    x: element.x + offset,
    y: element.y + offset,
    locked: false,
  };
}
