import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUT_GROUPS, modifierLabel } from "@/lib/shortcuts";
import { useUIStore } from "@/store/uiStore";

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
  const modifier = modifierLabel();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-[780px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move quickly through the studio. Shortcuts are ignored while typing in a text field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((section) => (
            <section key={section.group}>
              <h3 className="micro-label mb-0.5">{section.group}</h3>
              <p className="mb-2.5 text-[10px] leading-relaxed text-muted-foreground/70">
                {section.description}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={`${section.group}-${item.label}`}
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
          On macOS, use <Key>⌘</Key> in place of <Key>Ctrl</Key> ({modifier}). Paperforge saves your
          work locally as you go.
        </p>
      </DialogContent>
    </Dialog>
  );
}
