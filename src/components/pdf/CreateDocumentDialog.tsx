import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FilePlus2, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/store/uiStore";
import { useDocumentStore } from "@/store/documentStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { PAGE_PRESETS, type PageSizePreset } from "@/utils/pageSizes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";

const customSchema = z.object({
  width: z.number().min(100).max(5000),
  height: z.number().min(100).max(5000),
});

const quickPresets: { id: PageSizePreset; label: string; dimensions: string }[] = [
  ...PAGE_PRESETS.filter((preset) => ["a4", "a5", "letter"].includes(preset.id)).map(
    (preset) => ({ id: preset.id as PageSizePreset, label: preset.label, dimensions: preset.description }),
  ),
  { id: "custom", label: "Custom", dimensions: "Your dimensions" },
];

export function CreateDocumentDialog() {
  const open = useUIStore((state) => state.createDialogOpen);
  const setOpen = useUIStore((state) => state.setCreateDialogOpen);
  const navigate = useNavigate();
  const createDocument = useDocumentStore((state) => state.createDocument);
  const defaultPageSize = usePreferencesStore((state) => state.defaultPageSize);
  const defaultOrientation = usePreferencesStore((state) => state.defaultOrientation);
  const [title, setTitle] = useState("Untitled document");
  const [preset, setPreset] = useState<PageSizePreset>(defaultPageSize);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(defaultOrientation);
  const [customWidth, setCustomWidth] = useState("210");
  const [customHeight, setCustomHeight] = useState("297");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("Untitled document");
      setPreset(defaultPageSize);
      setOrientation(defaultOrientation);
      setError(null);
      setCreating(false);
    }
  }, [open, defaultPageSize, defaultOrientation]);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Give your document a name.");
      return;
    }
    let custom: { width: number; height: number } | undefined;
    if (preset === "custom") {
      const result = customSchema.safeParse({
        width: (Number(customWidth) * 72) / 25.4,
        height: (Number(customHeight) * 72) / 25.4,
      });
      if (!result.success) {
        setError("Custom dimensions must be between 36 mm and 1760 mm.");
        return;
      }
      custom = result.data;
    }
    setCreating(true);
    try {
      const document = await createDocument({
        title: title.trim(),
        preset,
        orientation,
        customWidth: custom?.width,
        customHeight: custom?.height,
      });
      setOpen(false);
      toast.success("Document created");
      navigate(`/editor/${document.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !creating && setOpen(next)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-forge-600/10 text-forge-700 dark:text-forge-300">
            <FilePlus2 className="size-5" />
          </div>
          <DialogTitle>Create a blank PDF</DialogTitle>
          <DialogDescription>
            Choose your canvas. Every page can be tuned later in the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="document-title">Document name</Label>
            <Input
              id="document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
              }}
              placeholder="Untitled document"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Page size</Label>
            <div className="grid grid-cols-4 gap-2">
              {quickPresets.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPreset(option.id)}
                  className={cn(
                    "flex min-h-[82px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center transition-all",
                    preset === option.id
                      ? "border-primary/50 bg-forge-600/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--primary)/.2)]"
                      : "border-border bg-card hover:border-foreground/15 hover:bg-accent/40",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 border border-current/30",
                      option.id === "a4" && "h-6 w-[17px]",
                      option.id === "a5" && "h-6 w-[21px]",
                      option.id === "letter" && "h-6 w-[19px]",
                      option.id === "custom" && "size-5 rounded-sm border-dashed",
                      preset === option.id
                        ? "border-forge-700/50 text-forge-700 dark:text-forge-300"
                        : "text-muted-foreground",
                    )}
                  />
                  <span className="text-[11px] font-semibold">{option.label}</span>
                  <span className="text-[8.5px] text-muted-foreground">{option.dimensions}</span>
                </button>
              ))}
            </div>
          </div>

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-width">Width (mm)</Label>
                <Input
                  id="custom-width"
                  type="number"
                  inputMode="decimal"
                  value={customWidth}
                  onChange={(event) => setCustomWidth(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-height">Height (mm)</Label>
                <Input
                  id="custom-height"
                  type="number"
                  inputMode="decimal"
                  value={customHeight}
                  onChange={(event) => setCustomHeight(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Orientation</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["portrait", "landscape"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrientation(value)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-[11.5px] font-medium capitalize transition-colors",
                      orientation === value
                        ? "border-primary/40 bg-forge-600/[0.06] text-forge-700 dark:text-forge-300"
                        : "border-border bg-card text-muted-foreground hover:bg-accent/40",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-[2px] border border-current/40",
                        value === "portrait" ? "h-4 w-3" : "h-3 w-4",
                      )}
                    />
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {creating ? "Creating…" : "Create document"}
            {!creating && <ArrowRight className="size-3.5 opacity-60" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
