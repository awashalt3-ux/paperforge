import { Link } from "react-router-dom";
import { ArrowRight, Keyboard, LifeBuoy, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/uiStore";
import { tipsFor } from "@/lib/tips";

const QUICK_HELP = [
  {
    title: "Start a document",
    body: "Use New PDF for a blank page, Import PDF to keep an existing file intact, or pick a template for a head start.",
  },
  {
    title: "Edit anything",
    body: "Double-click text to edit it. Drag elements to move them, use the handles to resize, and press Ctrl+Z to undo.",
  },
  {
    title: "Deliver the file",
    body: "Export PDF for print-ready output, Export images for PNG or JPEG, and Print for the system dialog.",
  },
];

/** A compact guide available from anywhere, complementing the full /help page. */
export function HelpDialog() {
  const open = useUIStore((state) => state.helpOpen);
  const setOpen = useUIStore((state) => state.setHelpOpen);
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);
  const tips = tipsFor("editor").slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-[620px] overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-forge-600/10 text-forge-700 dark:bg-forge-300/10 dark:text-forge-300">
            <LifeBuoy className="size-5" />
          </div>
          <DialogTitle>Quick help</DialogTitle>
          <DialogDescription>
            The essentials in one place. The full guide has walkthroughs, tips, and troubleshooting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {QUICK_HELP.map((item, index) => (
            <div
              key={item.title}
              className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-forge-600/10 font-mono text-[9px] font-semibold text-forge-700 dark:bg-forge-300/12 dark:text-forge-300">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {tips.map((tip) => (
            <div
              key={tip.id}
              className="rounded-xl border border-forge-600/12 bg-forge-600/[0.045] px-3.5 py-2.5 dark:border-forge-300/12 dark:bg-forge-300/[0.05]"
            >
              <p className="text-[11px] font-semibold text-foreground/85">{tip.title}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{tip.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-3.5" />
            Shortcuts
          </Button>
          <Button size="sm" className="gap-1.5" asChild onClick={() => setOpen(false)}>
            <Link to="/help">
              Open the full guide
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
            Everything stays on this device
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
