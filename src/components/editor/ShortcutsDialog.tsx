import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/uiStore";

const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: "Select & edit",
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
    group: "Elements",
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
    items: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "S"], label: "Save now" },
      { keys: ["Ctrl", "Shift", "E"], label: "Export PDF" },
      { keys: ["Ctrl", "Alt", "E"], label: "Export project file" },
    ],
  },
  {
    group: "View",
    items: [
      { keys: ["+", "−"], label: "Zoom in or out" },
      { keys: ["0"], label: "Fit page to workspace" },
      { keys: ["1"], label: "Zoom to 100%" },
      { keys: ["Space", "Drag"], label: "Pan the canvas" },
      { keys: ["Ctrl", "Wheel"], label: "Zoom with the mouse" },
      { keys: ["?"], label: "Open this shortcuts panel" },
    ],
  },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border/90 bg-muted/55 px-1.5 font-mono text-[9.5px] font-medium text-foreground/75 shadow-[inset_0_-1px_0_rgba(15,23,20,0.08)]">
      {children}
    </kbd>
  );
}

export function ShortcutsDialog() {
  const open = useUIStore((state) => state.shortcutsOpen);
  const setOpen = useUIStore((state) => state.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-[720px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move quickly through the studio. Shortcuts are ignored while typing in a text field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {SHORTCUTS.map((section) => (
            <section key={section.group}>
              <h3 className="micro-label mb-2.5">{section.group}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground"
                  >
                    <span>{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, index) => (
                        <span key={`${item.label}-${key}`} className="flex items-center gap-1">
                          {index > 0 && <span className="text-[8px] text-muted-foreground/45">+</span>}
                          <Key>{key}</Key>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="border-t border-border/60 pt-3 text-[10.5px] text-muted-foreground/70">
          On macOS, use <Key>⌘</Key> in place of <Key>Ctrl</Key>. Paperforge saves your work locally
          as you go.
        </p>
      </DialogContent>
    </Dialog>
  );
}
