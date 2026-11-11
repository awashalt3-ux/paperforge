import { useMemo, useState } from "react";
import { Download, FileArchive, ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDocumentStore } from "@/store/documentStore";
import {
  exportDocumentToImages,
  type ImageExportProgress,
  type ImageFormat,
} from "@/services/imageExport";
import { createZip } from "@/lib/zip";
import { downloadBlob } from "@/lib/utils";

const DPI_OPTIONS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "72 dpi", hint: "Screen previews" },
  { value: 2, label: "144 dpi", hint: "Slides and email" },
  { value: 3, label: "216 dpi", hint: "Retina displays" },
  { value: 4, label: "288 dpi", hint: "Print quality" },
];

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-input bg-muted/30 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={
            value === option.value
              ? "flex h-7 flex-1 items-center justify-center rounded-md bg-card px-2 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/70"
              : "flex h-7 flex-1 items-center justify-center rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ExportImagesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const document = useDocumentStore((state) => state.activeDocument);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImageExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstPage = document?.pages[0];
  const estimated = useMemo(() => {
    if (!firstPage) return "";
    return `${Math.round(firstPage.width * scale)} × ${Math.round(firstPage.height * scale)} px per page`;
  }, [firstPage, scale]);

  if (!document) return null;

  const pageCount = document.pages.length;
  const progressPercent = progress
    ? Math.round((progress.current / Math.max(1, progress.total)) * 100)
    : 0;

  const handleExport = async (bundle: boolean) => {
    setError(null);
    setBusy(true);
    setProgress(null);
    try {
      const images = await exportDocumentToImages(
        document,
        { format, scale, quality },
        setProgress,
      );
      if (images.length === 0) throw new Error("There are no pages to export.");
      if (bundle && images.length > 1) {
        const zip = createZip(
          images.map((image) => ({
            name: image.filename,
            data: image.bytes,
          })),
        );
        downloadBlob(zip, `${images[0]!.filename.replace(/-page-\d+\.[a-z]+$/, "")}-images.zip`);
        toast.success(`${images.length} images exported as a ZIP`);
      } else {
        images.forEach((image) => downloadBlob(image.blob, image.filename));
        toast.success(
          images.length === 1 ? "Image exported" : `${images.length} images exported`,
        );
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The images could not be exported.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageDown className="size-4 text-forge-600 dark:text-forge-300" />
            Export images
          </DialogTitle>
          <DialogDescription>
            Render every page to PNG or JPEG using the same vector-faithful engine as PDF export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Format
            </Label>
            <div className="mt-2">
              <Segmented
                value={format}
                options={[
                  { value: "png", label: "PNG · lossless" },
                  { value: "jpeg", label: "JPEG · smaller" },
                ]}
                onChange={(value) => setFormat(value as ImageFormat)}
              />
            </div>
            {format === "jpeg" && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>JPEG quality</span>
                  <span className="tabular-nums">{Math.round(quality * 100)}%</span>
                </div>
                <Slider
                  className="mt-1.5"
                  value={[Math.round(quality * 100)]}
                  min={50}
                  max={100}
                  step={1}
                  onValueChange={([value]) => setQuality((value ?? 92) / 100)}
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Resolution
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DPI_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScale(option.value)}
                  className={
                    scale === option.value
                      ? "rounded-lg border border-primary/40 bg-forge-600/[0.06] px-2.5 py-2 text-left"
                      : "rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/40"
                  }
                >
                  <span className="block text-[11.5px] font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-[9.5px] text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{estimated}</p>
          </section>

          {busy && (
            <div className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  {progress?.label ?? "Preparing"}
                </span>
                <span className="tabular-nums">{progressPercent}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-forge-600 transition-[width] duration-300 dark:bg-forge-300"
                  style={{ width: `${Math.max(2, progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-destructive">
              {error}
            </p>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {pageCount} page{pageCount === 1 ? "" : "s"} will be rendered in this tab. Nothing is
            uploaded.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExport(false)}
            disabled={busy}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            {pageCount === 1 ? "Download image" : "Download each page"}
          </Button>
          {pageCount > 1 && (
            <Button onClick={() => void handleExport(true)} disabled={busy} className="gap-1.5">
              <FileArchive className="size-3.5" />
              Download ZIP
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
