export interface ShortcutItem {
  keys: string[];
  label: string;
}

export interface ShortcutGroup {
  group: string;
  description: string;
  items: ShortcutItem[];
}

/**
 * Single source of truth for keyboard shortcuts. Used by the in-editor dialog,
 * the help page, and the tooltips so documentation never drifts from behaviour.
 */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: "Select & edit",
    description: "Work on elements without leaving the keyboard.",
    items: [
      { keys: ["V"], label: "Select and move" },
      { keys: ["Double-click"], label: "Edit text on the page" },
      { keys: ["Shift", "Click"], label: "Add to selection" },
      { keys: ["Ctrl", "A"], label: "Select all elements on the page" },
      { keys: ["Esc"], label: "Clear selection or close a tool" },
      { keys: ["Enter"], label: "Edit the selected text element" },
    ],
  },
  {
    group: "Insert",
    description: "Quickly place the element you need.",
    items: [
      { keys: ["T"], label: "Add text" },
      { keys: ["H"], label: "Add heading" },
      { keys: ["N"], label: "Add note or annotation" },
      { keys: ["I"], label: "Add image" },
      { keys: ["R"], label: "Add rectangle" },
      { keys: ["O"], label: "Add ellipse" },
      { keys: ["L"], label: "Add line" },
    ],
  },
  {
    group: "Elements",
    description: "Arrange, duplicate, and protect content.",
    items: [
      { keys: ["Ctrl", "C"], label: "Copy selection" },
      { keys: ["Ctrl", "X"], label: "Cut selection" },
      { keys: ["Ctrl", "V"], label: "Paste" },
      { keys: ["Ctrl", "D"], label: "Duplicate selection" },
      { keys: ["Delete"], label: "Delete selection" },
      { keys: ["Ctrl", "]"], label: "Bring forward" },
      { keys: ["Ctrl", "["], label: "Send backward" },
      { keys: ["Shift", "L"], label: "Lock or unlock selection" },
      { keys: ["Arrows"], label: "Nudge by 1 pt (Shift for 10 pt)" },
    ],
  },
  {
    group: "History & files",
    description: "Save, undo, and deliver the document.",
    items: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "S"], label: "Save now" },
      { keys: ["Ctrl", "Shift", "E"], label: "Export PDF" },
      { keys: ["Ctrl", "Alt", "E"], label: "Export project file" },
      { keys: ["Ctrl", "P"], label: "Print" },
    ],
  },
  {
    group: "Workspace",
    description: "Move around the studio.",
    items: [
      { keys: ["Ctrl", "K"], label: "Search documents, tools and actions" },
      { keys: ["G", "D"], label: "Go to the dashboard" },
      { keys: ["G", "T"], label: "Go to templates" },
      { keys: ["G", "P"], label: "Go to PDF tools" },
      { keys: ["G", "S"], label: "Go to settings" },
      { keys: ["G", "H"], label: "Go to the help guide" },
    ],
  },
  {
    group: "View",
    description: "Zoom, pan, and focus.",
    items: [
      { keys: ["+", "−"], label: "Zoom in or out" },
      { keys: ["0"], label: "Fit page to workspace" },
      { keys: ["1"], label: "Zoom to 100%" },
      { keys: ["PageUp"], label: "Previous page" },
      { keys: ["PageDown"], label: "Next page" },
      { keys: ["Space", "Drag"], label: "Pan the canvas" },
      { keys: ["Ctrl", "Wheel"], label: "Zoom with the mouse" },
      { keys: ["?"], label: "Open this shortcuts panel" },
    ],
  },
];

/** Platform-aware modifier label for UI copy. */
export function modifierLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl";
}
