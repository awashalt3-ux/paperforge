import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileOutput,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { PageSizePreset } from "@/utils/pageSizes";
import type { PdfExportOptions, PdfExportProgress } from "@/services/pdfExport";
import { exportDocumentToPdf, pdfBytesToBlob } from "@/services/pdfExport";
import { parsePageRanges, PdfToolError } from "@/services/pdfTools";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_PRESETS, ptToMm } from "@/utils/pageSizes";
import { cn, clamp, downloadBlob, round, safeFileName } from "@/lib/utils";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PageSelection = "all" | "current" | "range";
type Orientation = "auto" | "portrait" | "landscape";

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
          className={cn(
            "flex h-7 flex-1 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors",
            value === option.value
              ? "bg-card text-foreground shadow-sm ring-1 ring-border/70"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const document = useDocumentStore((state) => state.activeDocument);
  const setMetadata = useDocumentStore((state) => state.setMetadata);
  const activePageId = useEditorStore((state) => state.activePageId);

  const [pageSelection, setPageSelection] = useState<PageSelection>("all");
  const [range, setRange] = useState("");
  const [sizeMode, setSizeMode] = useState<"original" | "preset">("original");
  const [preset, setPreset] = useState<PageSizePreset>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [marginPt, setMarginPt] = useState(0);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [keywords, setKeywords] = useState("");
  const [creator, setCreator] = useState("Paperforge");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<PdfExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const activeIndex = useMemo(
    () =>
      Math.max(
        0,
        document?.pages.findIndex((page) => page.id === activePageId) ?? 0,
      ),
    [document?.pages, activePageId],
  );

  useEffect(() => {
    if (!open || !document) return;
    setPageSelection("all");
    setRange("");
    setSizeMode("original");
    setPreset("a4");
    setOrientation("auto");
    setMarginPt(0);
    setTitle(document.metadata.title || document.title);
    setAuthor(document.metadata.author);
    setSubject(document.metadata.subject);
    setKeywords(document.metadata.keywords.join(", "));
    setCreator(document.metadata.creator || "Paperforge");
    setExporting(false);
    setProgress(null);
    setError(null);
    setCompleted(false);
    // Reset only when the dialog opens or switches documents. Persisting metadata
    // after an export must not wipe the success state or the user's choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, document?.id]);

  if (!document) return null;

  const resolveIndices = (): number[] | undefined => {
    if (pageSelection === "all") return undefined;
    if (pageSelection === "current") return [activeIndex];
    try {
      return parsePageRanges(range, document.pages.length).map((page) => page - 1);
    } catch (rangeError) {
      throw new Error(
        rangeError instanceof PdfToolError
          ? rangeError.message
          : "Enter a valid page range, such as 1-3, 5.",
      );
    }
  };

  const selectedCount = (() => {
    if (pageSelection === "all") return document.pages.length;
    if (pageSelection === "current") return 1;
    try {
      return parsePageRanges(range, document.pages.length).length;
    } catch {
      return 0;
    }
  })();

  const handleExport = async () => {
    setError(null);
    setCompleted(false);
    let pageIndices: number[] | undefined;
    try {
      pageIndices = resolveIndices();
    } catch (rangeError) {
      setError(rangeError instanceof Error ? rangeError.message : "Invalid page selection.");
      return;
    }
    const cleanedKeywords = keywords
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    const options: PdfExportOptions = {
      sizeMode,
      preset,
      orientation,
      margin: Math.round(marginPt),
      pageIndices,
      metadata: {
        title: title.trim() || document.title,
        author: author.trim(),
        subject: subject.trim(),
        keywords: cleanedKeywords,
        creator: creator.trim() || "Paperforge",
      },
    };
    setExporting(true);
    setProgress({ current: 0, total: pageIndices?.length ?? document.pages.length, label: "Preparing document" });
    try {
      const bytes = await exportDocumentToPdf(document, options, (next) => setProgress(next));
      downloadBlob(pdfBytesToBlob(bytes), safeFileName(options.metadata.title, "pdf"));
      setMetadata(options.metadata);
      setCompleted(true);
      toast.success("PDF exported");
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "The PDF could not be exported.",
      );
    } finally {
      setExporting(false);
    }
  };

  const progressPercent = progress
    ? Math.round(
        clamp(
          (progress.current / Math.max(1, progress.total)) * 100,
          0,
          100,
        ),
      )
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (exporting) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-[620px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="size-4 text-forge-600 dark:text-forge-300" />
            Export PDF
          </DialogTitle>
          <DialogDescription>
            Render vector text, shapes, and embedded images into a print-ready PDF. Imported pages
            can keep their original vectors and page size.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Pages
            </Label>
            <div className="mt-2">
              <Segmented
                value={pageSelection}
                options={[
                  { value: "all", label: `All pages (${document.pages.length})` },
                  { value: "current", label: "Current page" },
                  { value: "range", label: "Page range" },
                ]}
                onChange={(value) => setPageSelection(value as PageSelection)}
              />
            </div>
            {pageSelection === "range" && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  placeholder="e.g. 1-3, 5, 8"
                  className="h-8 max-w-[260px] text-[12px]"
                  aria-label="Page range"
                />
                <span className="text-[10px] text-muted-foreground">
                  {selectedCount} page{selectedCount === 1 ? "" : "s"} selected
                </span>
              </div>
            )}
            {pageSelection === "current" && (
              <p className="mt-2 text-[10px] text-muted-foreground">
                Exporting page {activeIndex + 1} of {document.pages.length}.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Page size
            </Label>
            <div className="mt-2">
              <Segmented
                value={sizeMode}
                options={[
                  { value: "original", label: "Original size" },
                  { value: "preset", label: "Place on preset size" },
                ]}
                onChange={(value) => setSizeMode(value as "original" | "preset")}
              />
            </div>
            {sizeMode === "preset" ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Paper</Label>
                  <Select
                    value={preset}
                    onValueChange={(value) => setPreset(value as PageSizePreset)}
                  >
                    <SelectTrigger className="h-8 text-[11.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_PRESETS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label} · {item.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Orientation</Label>
                  <Select
                    value={orientation}
                    onValueChange={(value) => setOrientation(value as Orientation)}
                  >
                    <SelectTrigger className="h-8 text-[11.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Match each page</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Margin</Label>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {round(ptToMm(marginPt), 1)} mm
                    </span>
                  </div>
                  <Slider
                    value={[marginPt]}
                    min={0}
                    max={72}
                    step={2.835}
                    onValueChange={([value]) => setMarginPt(value)}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Each page keeps its own dimensions. Imported PDF pages are copied as original
                vector pages, so their text and annotations remain intact.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              PDF metadata
            </Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] text-muted-foreground">Title</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-8 text-[11.5px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Author</Label>
                <Input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Your name or studio"
                  className="h-8 text-[11.5px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Creator</Label>
                <Input
                  value={creator}
                  onChange={(event) => setCreator(event.target.value)}
                  className="h-8 text-[11.5px]"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] text-muted-foreground">Subject</Label>
                <Input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="A short description"
                  className="h-8 text-[11.5px]"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[10px] text-muted-foreground">
                  Keywords <span className="text-muted-foreground/60">(comma separated)</span>
                </Label>
                <Input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="invoice, client, 2026"
                  className="h-8 text-[11.5px]"
                />
              </div>
            </div>
          </section>

          {exporting && (
            <div className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>{progress?.label ?? "Rendering PDF"}</span>
                <span className="ml-auto tabular-nums">
                  {progress?.current ?? 0}/{progress?.total ?? 0}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-forge-600 transition-[width] duration-300 dark:bg-forge-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[11px] leading-relaxed text-destructive">
              {error}
            </div>
          )}

          {completed && !exporting && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              Your PDF was downloaded. You can export again with different settings without
              closing this dialog.
            </div>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <span className="hidden items-center gap-1.5 text-[9.5px] text-muted-foreground/65 sm:flex">
            <ShieldCheck className="size-3" />
            Generated on this device
          </span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={exporting}
              className="flex-1 sm:flex-none"
            >
              Close
            </Button>
            <Button onClick={() => void handleExport()} disabled={exporting} className="flex-1 sm:flex-none">
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Rendering…" : "Export PDF"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
