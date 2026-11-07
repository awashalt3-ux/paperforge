import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
  ShieldCheck,
} from "lucide-react";
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
import { importPdfFile, inspectPdfFile, type PdfInspection } from "@/services/pdfImporter";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

export function ImportPdfDialog() {
  const open = useUIStore((state) => state.importDialogOpen);
  const setOpen = useUIStore((state) => state.setImportDialogOpen);
  const navigate = useNavigate();
  const createFromDocument = useDocumentStore((state) => state.createFromDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<PdfInspection | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setInspection(null);
      setTitle("");
      setError(null);
      setInspecting(false);
      setImporting(false);
      setProgress("");
    }
  }, [open]);

  const chooseFile = async (selected: File | null) => {
    if (!selected) return;
    setError(null);
    setFile(selected);
    setInspection(null);
    setTitle(selected.name.replace(/\.pdf$/i, ""));
    setInspecting(true);
    try {
      const result = await inspectPdfFile(selected);
      setInspection(result);
      setTitle(result.title);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be opened.");
      setFile(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      setProgress("Reading PDF…");
      const result = await importPdfFile(file, setProgress);
      setProgress("Saving document…");
      const cleanTitle = title.trim() || result.document.title;
      result.document.title = cleanTitle;
      result.document.metadata.title = cleanTitle;
      await createFromDocument(result.document, [result.asset]);
      setOpen(false);
      toast.success(`Imported ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}`);
      navigate(`/editor/${result.document.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PDF could not be imported.");
    } finally {
      setImporting(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && setOpen(next)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
            <UploadCloud className="size-5" />
          </div>
          <DialogTitle>Import an existing PDF</DialogTitle>
          <DialogDescription>
            Original pages are preserved as vectors. Add text, images, signatures, and
            highlights on top — existing text is not reflowed.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            void chooseFile(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void chooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={`flex min-h-[210px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 text-center transition-colors ${
              dragOver
                ? "border-forge-600/60 bg-forge-600/[0.06]"
                : "border-border bg-muted/25 hover:border-foreground/20 hover:bg-muted/40"
            }`}
          >
            <div className="grid size-12 place-items-center rounded-full border border-border bg-card shadow-sm">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-medium">Drop a PDF here, or browse</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Up to 120 MB · Processed locally in your browser
              </p>
            </div>
            <span className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium shadow-sm">
              Choose PDF
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/25 p-3.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-card shadow-sm ring-1 ring-border/60">
                <FileText className="size-4 text-forge-700 dark:text-forge-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{file.name}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                  {formatBytes(file.size)}
                  {inspection ? ` · ${inspection.pageCount} page${inspection.pageCount === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              {inspecting ? (
                <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setFile(null);
                    setInspection(null);
                  }}
                  disabled={importing}
                  aria-label="Remove file"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {inspection && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  PDF verified and ready to import
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="import-title">Document name</Label>
                  <Input
                    id="import-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={importing}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11.5px] leading-relaxed text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Nothing leaves your device. Imported PDFs are stored in this browser's local
            database.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleImport()}
            disabled={!inspection || importing || inspecting || !file}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            {importing ? progress || "Importing…" : "Import PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
