import {
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  Settings2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface Destination {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
  /** Match the path exactly (used for the dashboard root). */
  end?: boolean;
}

/** Primary destinations, shared by the sidebar, the 404 page and the palette. */
export const DESTINATIONS: Destination[] = [
  {
    to: "/",
    label: "Dashboard",
    description: "Your saved documents and recent work.",
    icon: LayoutDashboard,
    shortcut: "G D",
    end: true,
  },
  {
    to: "/templates",
    label: "Templates",
    description: "Eight editable starting points.",
    icon: LayoutTemplate,
    shortcut: "G T",
  },
  {
    to: "/tools",
    label: "PDF tools",
    description: "Merge, split, rotate, watermark and more.",
    icon: Wrench,
    shortcut: "G P",
  },
  {
    to: "/help",
    label: "Help",
    description: "The full guide, tips, and shortcuts.",
    icon: LifeBuoy,
    shortcut: "G H",
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Appearance, editor defaults and local data.",
    icon: Settings2,
    shortcut: "G S",
  },
];

export interface PdfToolLink {
  id: string;
  label: string;
  description: string;
}

/** Deep-linkable entries on the PDF tool bench. */
export const PDF_TOOL_LINKS: PdfToolLink[] = [
  { id: "merge", label: "Merge PDFs", description: "Join several files into one." },
  { id: "split", label: "Split PDF", description: "Separate pages or ranges." },
  { id: "rotate", label: "Rotate pages", description: "Turn pages by 90, 180 or 270°." },
  { id: "remove", label: "Remove pages", description: "Delete pages you no longer need." },
  { id: "reorder", label: "Reorder pages", description: "Rearrange a document." },
  { id: "images", label: "Images to PDF", description: "Turn PNG or JPEG files into a PDF." },
  { id: "watermark", label: "Watermark", description: "Stamp text across pages." },
  { id: "numbers", label: "Page numbers", description: "Number pages consistently." },
  { id: "extract", label: "Extract pages", description: "Keep only the pages you need." },
];
