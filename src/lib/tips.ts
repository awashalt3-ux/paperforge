export interface Tip {
  id: string;
  title: string;
  body: string;
  /** Shortcut keys shown next to the tip when available. */
  keys?: string[];
  /** Where the tip is most useful. */
  context: "editor" | "dashboard" | "tools" | "templates";
}

/**
 * Concise, actionable tips surfaced in the interface. Keep each body under two
 * sentences: these are hints, not documentation. The full guide lives on /help.
 */
export const TIPS: Tip[] = [
  {
    id: "double-click-text",
    title: "Edit text in place",
    body: "Double-click any text on the page to edit it directly. Ctrl+Enter commits, Escape cancels.",
    keys: ["Double-click"],
    context: "editor",
  },
  {
    id: "shift-select",
    title: "Select several elements",
    body: "Hold Shift and click, or drag a marquee on empty canvas. Align and distribute appear in the properties panel.",
    keys: ["Shift", "Click"],
    context: "editor",
  },
  {
    id: "snap-and-guides",
    title: "Let the page guide you",
    body: "Alignment guides appear while dragging. Toggle snap-to-grid from the status bar when you want free movement.",
    context: "editor",
  },
  {
    id: "import-overlay",
    title: "Annotate instead of rewriting",
    body: "Imported PDF text stays exactly as it was. Add text, highlights, and signatures on top for a clean, non-destructive edit.",
    context: "editor",
  },
  {
    id: "project-backup",
    title: "Back up portable projects",
    body: "Export a .paperforge.json project to move a document to another browser, complete with its imported PDF pages.",
    context: "editor",
  },
  {
    id: "vector-export",
    title: "Keep text sharp",
    body: "PDF export draws real vector glyphs with embedded Inter fonts, so text stays selectable and print-ready.",
    context: "editor",
  },
  {
    id: "command-palette",
    title: "Everything from the keyboard",
    body: "Press Ctrl+K to search documents, destinations, tools, and actions from anywhere in the studio.",
    keys: ["Ctrl", "K"],
    context: "dashboard",
  },
  {
    id: "trash-recovery",
    title: "Deleted by mistake?",
    body: "Deleted documents sit in the trash for 30 days before they are purged. Restore them from the dashboard.",
    context: "dashboard",
  },
  {
    id: "tool-results",
    title: "Finish a tool in the editor",
    body: "Every PDF tool result can be opened in the editor with one click to add a final signature or note.",
    context: "tools",
  },
  {
    id: "template-edit",
    title: "Templates are fully editable",
    body: "Templates are built from real text, shapes, and tables — not background images. Change every element.",
    context: "templates",
  },
];

export function tipsFor(context: Tip["context"]): Tip[] {
  return TIPS.filter((tip) => tip.context === context);
}
