import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileArchive,
  FileOutput,
  FileText,
  FolderInput,
  Hash,
  Images,
  Layers,
  Loader2,
  RotateCw,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  addPageNumbers,
  addWatermark,
  extractPdfPages,
  getPdfInfo,
  imagesToPdf,
  mergePdfs,
  removePdfPages,
  reorderPdfPages,
  rotatePdf,
  splitPdf,
  toolResultBlob,
  type ImageInputFile,
  type PageNumberFormat,
  type PageNumberPosition,
  type PdfToolError,
  type SplitMode,
  type SplitResult,
  type WatermarkPosition,
} from "@/services/pdfTools";
import { importPdfFile, PdfImportError } from "@/services/pdfImporter";
import { useDocumentStore } from "@/store/documentStore";
import { MAX_PDF_BYTES, validateImageFile, validatePdfFile } from "@/utils/files";
import { createId } from "@/utils/id";
import { downloadBlob, formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createZip } from "@/lib/zip";
import { ContextTip } from "@/components/common/Tip";
import { tipsFor } from "@/lib/tips";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type ToolId =
  | "merge"
  | "split"
  | "rotate"
  | "remove"
  | "reorder"
  | "images"
  | "watermark"
  | "numbers"
  | "extract";

const ALL_TOOL_IDS: ToolId[] = [
  "merge",
  "split",
  "rotate",
  "remove",
  "reorder",
  "images",
  "watermark",
  "numbers",
  "extract",
];

interface ToolDefinition {
  id: ToolId;
  title: string;
  short: string;
  description: string;
  icon: typeof Layers;
  kind: "pdf" | "image";
  multiple: boolean;
}

const TOOLS: ToolDefinition[] = [
  {
    id: "merge",
    title: "Merge PDFs",
    short: "Merge",
    description: "Join several PDFs into one, in the order you choose.",
    icon: Layers,
    kind: "pdf",
    multiple: true,
  },
  {
    id: "split",
    title: "Split PDF",
    short: "Split",
    description: "Separate a PDF into single pages, chunks, or ranges.",
    icon: Scissors,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "rotate",
    title: "Rotate pages",
    short: "Rotate",
    description: "Turn every page or selected pages by 90, 180, or 270°.",
    icon: RotateCw,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "remove",
    title: "Remove pages",
    short: "Remove",
    description: "Delete unwanted pages without touching the rest.",
    icon: Trash2,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "reorder",
    title: "Reorder pages",
    short: "Reorder",
    description: "Rearrange a PDF into a new page order.",
    icon: ArrowUpDown,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "images",
    title: "Images to PDF",
    short: "Images",
    description: "Place PNG or JPEG images onto clean pages.",
    icon: Images,
    kind: "image",
    multiple: true,
  },
  {
    id: "watermark",
    title: "Add a watermark",
    short: "Watermark",
    description: "Stamp text across pages with precise placement.",
    icon: Stamp,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "numbers",
    title: "Page numbers",
    short: "Numbers",
    description: "Add consistent page numbering in six positions.",
    icon: Hash,
    kind: "pdf",
    multiple: false,
  },
  {
    id: "extract",
    title: "Extract pages",
    short: "Extract",
    description: "Keep only the pages you need in a new PDF.",
    icon: FileOutput,
    kind: "pdf",
    multiple: false,
  },
];

interface ToolInput {
  id: string;
  name: string;
  size: number;
  bytes: ArrayBuffer;
  mimeType: string;
  pageCount?: number;
}

interface ResultFile {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pageNumbers?: number[];
}

interface ToolOptions {
  outputName: string;
  splitMode: SplitMode;
  chunkSize: number;
  ranges: string;
  angle: 90 | 180 | 270;
  pages: string;
  order: string;
  preset: "a4" | "a5" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  margin: number;
  background: string;
  watermarkText: string;
  watermarkSize: number;
  watermarkColor: string;
  watermarkOpacity: number;
  watermarkRotation: number;
  watermarkPosition: WatermarkPosition;
  numberPosition: PageNumberPosition;
  numberFormat: PageNumberFormat;
  numberStart: number;
  numberSize: number;
  numberColor: string;
  numberMargin: number;
}

const DEFAULT_OPTIONS: ToolOptions = {
  outputName: "",
  splitMode: "each",
  chunkSize: 2,
  ranges: "",
  angle: 90,
  pages: "all",
  order: "",
  preset: "a4",
  orientation: "auto",
  margin: 24,
  background: "#ffffff",
  watermarkText: "CONFIDENTIAL",
  watermarkSize: 64,
  watermarkColor: "#265249",
  watermarkOpacity: 0.18,
  watermarkRotation: 45,
  watermarkPosition: "center",
  numberPosition: "bottom-center",
  numberFormat: "page-of-total",
  numberStart: 1,
  numberSize: 10,
  numberColor: "#5d6663",
  numberMargin: 36,
};

function baseName(name: string): string {
  return name.replace(/\.(pdf|png|jpe?g)$/i, "").trim() || "document";
}

function isJpegBytes(bytes: ArrayBuffer): boolean {
  const header = new Uint8Array(bytes.slice(0, 3));
  return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
}

function isPngBytes(bytes: ArrayBuffer): boolean {
  const header = new Uint8Array(bytes.slice(0, 4));
  return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
}

function isPdfToolError(error: unknown): error is PdfToolError {
  return error instanceof Error && error.name === "PdfToolError";
}

export function ToolsPage() {
  useDocumentTitle("PDF tools");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const createFromDocument = useDocumentStore((state) => state.createFromDocument);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestedTool = searchParams.get("tool");
  const initialTool = ALL_TOOL_IDS.includes(requestedTool as ToolId)
    ? (requestedTool as ToolId)
    : "merge";
  const [toolId, setToolId] = useState<ToolId>(initialTool);
  const [inputs, setInputs] = useState<ToolInput[]>([]);
  const [options, setOptions] = useState<ToolOptions>(DEFAULT_OPTIONS);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);

  const tool = TOOLS.find((item) => item.id === toolId) ?? TOOLS[0];
  const ToolIcon = tool.icon;
  const firstFile = inputs[0];
  const pageCount = firstFile?.pageCount ?? 0;

  useEffect(() => {
    setInputs([]);
    setResults([]);
    setError(null);
    setOptions(DEFAULT_OPTIONS);
  }, [toolId]);

  // Keep the URL shareable: /tools?tool=split always opens Split.
  useEffect(() => {
    const current = searchParams.get("tool");
    if (current === toolId) return;
    const next = new URLSearchParams(searchParams);
    if (toolId === "merge") next.delete("tool");
    else next.set("tool", toolId);
    setSearchParams(next, { replace: true });
  }, [toolId, searchParams, setSearchParams]);

  const update = (patch: Partial<ToolOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));

  const addFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError(null);
    setResults([]);
    setBusy(true);
    setBusyLabel(tool.kind === "image" ? "Checking images" : "Reading PDFs");
    try {
      const loaded: ToolInput[] = [];
      for (const file of files) {
        if (tool.kind === "pdf") {
          if (file.size > MAX_PDF_BYTES) {
            throw new Error("This PDF is larger than the 120 MB limit.");
          }
          const bytes = await validatePdfFile(file);
          let pageCount = 0;
          try {
            const info = await getPdfInfo(bytes);
            pageCount = info.pageCount;
          } catch (cause) {
            throw new Error(
              cause instanceof Error
                ? `“${file.name}” could not be read. ${cause.message}`
                : `“${file.name}” could not be read.`,
            );
          }
          loaded.push({
            id: createId("input"),
            name: file.name,
            size: file.size,
            bytes,
            mimeType: "application/pdf",
            pageCount,
          });
        } else {
          validateImageFile(file);
          const bytes = await file.arrayBuffer();
          const png = isPngBytes(bytes);
          const jpeg = isJpegBytes(bytes);
          if (!png && !jpeg) {
            throw new Error(
              `“${file.name}” is not a PNG or JPEG. Convert it to PNG or JPEG and try again.`,
            );
          }
          loaded.push({
            id: createId("input"),
            name: file.name,
            size: file.size,
            bytes,
            mimeType: png ? "image/png" : "image/jpeg",
          });
        }
      }
      setInputs((current) => {
        const next = tool.multiple ? [...current, ...loaded] : loaded.slice(0, 1);
        if (tool.id === "reorder" && next[0]?.pageCount) {
          setOptions((state) => ({
            ...state,
            order: Array.from({ length: next[0].pageCount ?? 0 }, (_, index) => index + 1).join(" "),
          }));
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be read.");
    } finally {
      setBusy(false);
      setBusyLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const moveInput = (index: number, direction: -1 | 1) => {
    setInputs((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeInput = (id: string) => {
    setInputs((current) => current.filter((input) => input.id !== id));
    setResults([]);
  };

  const outputBase = useMemo(() => {
    if (options.outputName.trim()) return baseName(options.outputName.trim());
    if (firstFile) return baseName(firstFile.name);
    return "paperforge";
  }, [firstFile, options.outputName]);

  const run = async () => {
    setError(null);
    setResults([]);
    if (inputs.length === 0) {
      setError(tool.kind === "image" ? "Choose at least one image." : "Choose a PDF first.");
      return;
    }
    setBusy(true);
    try {
      let output: ResultFile[] = [];
      if (tool.id === "merge") {
        setBusyLabel("Merging pages");
        if (inputs.length < 2) {
          throw new Error("Choose at least two PDF files to merge.");
        }
        const result = await mergePdfs(
          inputs.map((input) => ({ name: input.name, bytes: input.bytes })),
        );
        output = [
          {
            id: createId("result"),
            name: `${options.outputName.trim() ? baseName(options.outputName.trim()) : "merged"}.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "split") {
        setBusyLabel("Splitting PDF");
        const splitResults = await splitPdf(inputs[0].bytes, {
          mode: options.splitMode,
          chunkSize: options.chunkSize,
          ranges: options.ranges,
        });
        output = splitResults.map((result: SplitResult) => ({
          id: createId("result"),
          name: `${outputBase}-${result.name}.pdf`,
          bytes: result.bytes,
          pageCount: result.pageCount,
          pageNumbers: result.pageNumbers,
        }));
      } else if (tool.id === "rotate") {
        setBusyLabel("Rotating pages");
        const result = await rotatePdf(inputs[0].bytes, options.angle, options.pages);
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-rotated.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "remove") {
        setBusyLabel("Removing pages");
        const result = await removePdfPages(inputs[0].bytes, options.pages);
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-pages-removed.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "reorder") {
        setBusyLabel("Reordering pages");
        const result = await reorderPdfPages(inputs[0].bytes, options.order);
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-reordered.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "extract") {
        setBusyLabel("Extracting pages");
        const result = await extractPdfPages(inputs[0].bytes, options.pages);
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-extracted.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "images") {
        setBusyLabel("Building PDF pages");
        const imageInputs: ImageInputFile[] = inputs.map((input) => ({
          name: input.name,
          bytes: input.bytes,
          mimeType: input.mimeType,
        }));
        const result = await imagesToPdf(imageInputs, {
          preset: options.preset,
          orientation: options.orientation,
          margin: options.margin,
          background: options.background,
        });
        output = [
          {
            id: createId("result"),
            name: `${options.outputName.trim() ? baseName(options.outputName.trim()) : "images"}.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "watermark") {
        setBusyLabel("Applying watermark");
        const result = await addWatermark(inputs[0].bytes, {
          text: options.watermarkText,
          fontSize: options.watermarkSize,
          color: options.watermarkColor,
          opacity: options.watermarkOpacity,
          rotation: options.watermarkRotation,
          position: options.watermarkPosition,
          pages: options.pages,
        });
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-watermarked.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      } else if (tool.id === "numbers") {
        setBusyLabel("Adding page numbers");
        const result = await addPageNumbers(inputs[0].bytes, {
          position: options.numberPosition,
          format: options.numberFormat,
          start: options.numberStart,
          fontSize: options.numberSize,
          color: options.numberColor,
          margin: options.numberMargin,
          pages: options.pages,
        });
        output = [
          {
            id: createId("result"),
            name: `${outputBase}-numbered.pdf`,
            bytes: result.bytes,
            pageCount: result.pageCount,
          },
        ];
      }
      setResults(output);
      toast.success(
        output.length === 1
          ? `${output[0].name} is ready`
          : `${output.length} PDF files are ready`,
      );
    } catch (cause) {
      if (isPdfToolError(cause) || cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("The PDF could not be processed.");
      }
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const downloadResult = (result: ResultFile) => {
    downloadBlob(toolResultBlob(result.bytes), result.name);
  };

  const downloadAll = () => {
    results.forEach((result) => downloadResult(result));
  };

  const downloadAllZip = () => {
    if (results.length === 0) return;
    try {
      const zip = createZip(
        results.map((result) => ({ name: result.name, data: result.bytes })),
      );
      const base = baseName(options.outputName.trim() || firstFile?.name || "paperforge");
      downloadBlob(zip, `${base}-results.zip`);
      toast.success(`${results.length} files downloaded as a ZIP`);
    } catch {
      toast.error("The ZIP could not be created. Try downloading files individually.");
    }
  };

  const editResult = async (result: ResultFile) => {
    setEditingResultId(result.id);
    setError(null);
    try {
      const file = new File([toolResultBlob(result.bytes)], result.name, {
        type: "application/pdf",
      });
      const imported = await importPdfFile(file);
      await createFromDocument(imported.document, [imported.asset]);
      toast.success("Opened in the editor");
      navigate(`/editor/${imported.document.id}`);
    } catch (cause) {
      if (cause instanceof PdfImportError) {
        setError(cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : "The PDF could not be opened.");
      }
    } finally {
      setEditingResultId(null);
    }
  };

  const changePages = (value: string) => update({ pages: value });

  const isImageTool = tool.kind === "image";

  return (
    <div className="mx-auto w-full max-w-[1380px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="micro-label">The tool bench</p>
          <h1 className="display-serif mt-2 text-[44px] leading-none sm:text-[52px]">
            Nine precise tools.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Real PDF operations, processed entirely on this device. Nothing is uploaded, and every
            result opens for a final look in the editor.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.055] px-3 py-2 text-[10.5px] text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="size-3.5" />
          On-device processing
        </div>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl border border-border/70 bg-card/55 p-2">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {TOOLS.map((item) => {
              const Icon = item.icon;
              const active = item.id === toolId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setToolId(item.id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                    active
                      ? "bg-forge-600 text-white shadow-sm dark:bg-forge-300 dark:text-forge-950"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                      active
                        ? "bg-white/15 text-white dark:bg-forge-950/10 dark:text-forge-950"
                        : "bg-muted/70 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold leading-tight">
                      {item.short}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 hidden text-[9.5px] leading-snug lg:block",
                        active ? "text-white/70 dark:text-forge-950/65" : "text-muted-foreground",
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 hidden items-start gap-2 rounded-xl border border-forge-600/10 bg-forge-600/[0.04] p-3 text-[9.5px] leading-relaxed text-muted-foreground lg:flex">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-forge-600 dark:text-forge-300" />
            Every operation uses pdf-lib and preserves vector content where the output format
            allows it.
          </div>
          <ContextTip tips={tipsFor("tools")} className="mt-2 hidden lg:flex" />
        </aside>

        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 bg-card/70 p-5 sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <ToolIcon className="size-4 text-forge-700 dark:text-forge-300" />
                <h2 className="text-[16px] font-semibold tracking-[-0.02em]">{tool.title}</h2>
              </div>
              <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted-foreground">
                {tool.description}
              </p>
            </div>
            <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              PDF · {tool.multiple ? "Multiple files" : "One file"}
            </span>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <input
              ref={fileInputRef}
              type="file"
              multiple={tool.multiple}
              accept={isImageTool ? "image/png,image/jpeg,.png,.jpg,.jpeg" : "application/pdf,.pdf"}
              className="hidden"
              onChange={(event) => void addFiles(event.target.files)}
            />

            {inputs.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  void addFiles(event.dataTransfer.files);
                }}
                className={cn(
                  "flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
                  dragOver
                    ? "border-forge-600/60 bg-forge-600/[0.055]"
                    : "border-border bg-muted/20 hover:border-foreground/20 hover:bg-muted/35",
                )}
              >
                <div className="grid size-11 place-items-center rounded-full border border-border bg-card shadow-sm">
                  {isImageTool ? (
                    <Images className="size-5 text-muted-foreground" />
                  ) : (
                    <FolderInput className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-medium">
                    {isImageTool
                      ? tool.multiple
                        ? "Drop images here, or browse"
                        : "Drop a PDF here, or browse"
                      : tool.multiple
                        ? "Drop PDFs here, or browse"
                        : "Drop a PDF here, or browse"}
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {isImageTool
                      ? "PNG or JPEG · Up to 25 MB per image · 100 images maximum"
                      : "Up to 120 MB per file · Processed locally in your browser"}
                  </p>
                </div>
                <span className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium shadow-sm">
                  {isImageTool ? "Choose images" : "Choose PDF"}
                </span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{isImageTool ? "Images" : "PDF files"}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {inputs.length} file{inputs.length === 1 ? "" : "s"}
                    </span>
                    {tool.multiple && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                      >
                        Add more
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setInputs([]);
                        setResults([]);
                        setError(null);
                      }}
                      disabled={busy}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {inputs.map((input, index) => (
                    <div
                      key={input.id}
                      className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/40 px-2.5 py-2"
                    >
                      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground">
                        {isImageTool ? (
                          <Images className="size-3.5" />
                        ) : (
                          <FileText className="size-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium">{input.name}</p>
                        <p className="text-[9.5px] text-muted-foreground">
                          {formatBytes(input.size)}
                          {input.pageCount ? ` · ${input.pageCount} page${input.pageCount === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      {tool.multiple && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveInput(index, -1)}
                            disabled={index === 0 || busy}
                            aria-label="Move up"
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveInput(index, 1)}
                            disabled={index === inputs.length - 1 || busy}
                            aria-label="Move down"
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeInput(input.id)}
                        disabled={busy}
                        aria-label={`Remove ${input.name}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {toolId === "merge" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="merge-name">Output file name</Label>
                  <Input
                    id="merge-name"
                    value={options.outputName}
                    onChange={(event) => update({ outputName: event.target.value })}
                    placeholder="merged"
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[10px] leading-relaxed text-muted-foreground">
                  Files are merged from top to bottom. Use the arrows to change the order before
                  running.
                </div>
              </div>
            )}

            {toolId === "split" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Split mode</Label>
                  <Select
                    value={options.splitMode}
                    onValueChange={(value) => update({ splitMode: value as SplitMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="each">One page per file</SelectItem>
                      <SelectItem value="chunks">Fixed chunks</SelectItem>
                      <SelectItem value="ranges">Custom ranges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {options.splitMode === "chunks" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="chunk-size">Pages per file</Label>
                    <Input
                      id="chunk-size"
                      type="number"
                      min={1}
                      max={500}
                      value={options.chunkSize}
                      onChange={(event) => update({ chunkSize: Number(event.target.value) || 1 })}
                    />
                  </div>
                )}
                {options.splitMode === "ranges" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="split-ranges">Ranges</Label>
                    <Input
                      id="split-ranges"
                      value={options.ranges}
                      onChange={(event) => update({ ranges: event.target.value })}
                      placeholder="1-3, 4-8, 9-12"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Each comma-separated range becomes a separate PDF.
                    </p>
                  </div>
                )}
              </div>
            )}

            {toolId === "rotate" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Rotation</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([90, 180, 270] as const).map((angle) => (
                      <Button
                        key={angle}
                        type="button"
                        variant={options.angle === angle ? "default" : "outline"}
                        size="sm"
                        onClick={() => update({ angle })}
                      >
                        {angle}°
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rotate-pages">Pages</Label>
                  <Input
                    id="rotate-pages"
                    value={options.pages}
                    onChange={(event) => changePages(event.target.value)}
                    placeholder="all"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use “all”, or a range like 1-3, 6.
                  </p>
                </div>
              </div>
            )}

            {(toolId === "remove" || toolId === "extract") && (
              <div className="space-y-1.5">
                <Label htmlFor={`${toolId}-pages`}>
                  {toolId === "remove" ? "Pages to remove" : "Pages to keep"}
                </Label>
                <Input
                  id={`${toolId}-pages`}
                  value={options.pages === "all" ? "" : options.pages}
                  onChange={(event) => changePages(event.target.value)}
                  placeholder="1-3, 6, 9-12"
                />
                <p className="text-[10px] text-muted-foreground">
                  {pageCount > 0
                    ? `This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`
                    : "Choose a PDF to see its page count."}{" "}
                  {toolId === "remove"
                    ? "At least one page must remain."
                    : "Pages are kept in ascending order."}
                </p>
              </div>
            )}

            {toolId === "reorder" && (
              <div className="space-y-1.5">
                <Label htmlFor="page-order">New page order</Label>
                <Input
                  id="page-order"
                  value={options.order}
                  onChange={(event) => update({ order: event.target.value })}
                  placeholder={pageCount > 0 ? Array.from({ length: pageCount }, (_, index) => index + 1).join(" ") : "3 1 2"}
                />
                <p className="text-[10px] text-muted-foreground">
                  Enter every page number exactly once. This does not apply a page rotation.
                </p>
              </div>
            )}

            {toolId === "images" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Page size</Label>
                  <Select
                    value={options.preset}
                    onValueChange={(value) =>
                      update({ preset: value as ToolOptions["preset"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 · 210 × 297 mm</SelectItem>
                      <SelectItem value="a5">A5 · 148 × 210 mm</SelectItem>
                      <SelectItem value="letter">Letter · 8.5 × 11 in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Orientation</Label>
                  <Select
                    value={options.orientation}
                    onValueChange={(value) =>
                      update({ orientation: value as ToolOptions["orientation"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Match each image</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Margin</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {options.margin} pt
                    </span>
                  </div>
                  <Slider
                    value={[options.margin]}
                    min={0}
                    max={120}
                    step={4}
                    onValueChange={([value]) => update({ margin: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={options.background}
                      onChange={(event) => update({ background: event.target.value })}
                      className="size-9 cursor-pointer rounded-md border border-border bg-card p-1"
                      aria-label="Image page background"
                    />
                    <Input
                      value={options.background}
                      onChange={(event) => update({ background: event.target.value })}
                      className="font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {toolId === "watermark" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="watermark-text">Watermark text</Label>
                  <Input
                    id="watermark-text"
                    value={options.watermarkText}
                    onChange={(event) => update({ watermarkText: event.target.value })}
                    placeholder="CONFIDENTIAL"
                    maxLength={160}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select
                    value={options.watermarkPosition}
                    onValueChange={(value) =>
                      update({ watermarkPosition: value as WatermarkPosition })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Centre</SelectItem>
                      <SelectItem value="top-left">Top left</SelectItem>
                      <SelectItem value="top-center">Top centre</SelectItem>
                      <SelectItem value="top-right">Top right</SelectItem>
                      <SelectItem value="bottom-left">Bottom left</SelectItem>
                      <SelectItem value="bottom-center">Bottom centre</SelectItem>
                      <SelectItem value="bottom-right">Bottom right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="watermark-pages">Pages</Label>
                  <Input
                    id="watermark-pages"
                    value={options.pages}
                    onChange={(event) => changePages(event.target.value)}
                    placeholder="all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Size</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {options.watermarkSize} pt
                    </span>
                  </div>
                  <Slider
                    value={[options.watermarkSize]}
                    min={8}
                    max={144}
                    step={2}
                    onValueChange={([value]) => update({ watermarkSize: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Rotation</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {options.watermarkRotation}°
                    </span>
                  </div>
                  <Slider
                    value={[options.watermarkRotation]}
                    min={-90}
                    max={90}
                    step={5}
                    onValueChange={([value]) => update({ watermarkRotation: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Opacity</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {Math.round(options.watermarkOpacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[options.watermarkOpacity]}
                    min={0.03}
                    max={0.9}
                    step={0.01}
                    onValueChange={([value]) => update({ watermarkOpacity: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={options.watermarkColor}
                      onChange={(event) => update({ watermarkColor: event.target.value })}
                      className="size-9 cursor-pointer rounded-md border border-border bg-card p-1"
                      aria-label="Watermark colour"
                    />
                    <Input
                      value={options.watermarkColor}
                      onChange={(event) => update({ watermarkColor: event.target.value })}
                      className="font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {toolId === "numbers" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select
                    value={options.numberPosition}
                    onValueChange={(value) =>
                      update({ numberPosition: value as PageNumberPosition })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-center">Bottom centre</SelectItem>
                      <SelectItem value="bottom-left">Bottom left</SelectItem>
                      <SelectItem value="bottom-right">Bottom right</SelectItem>
                      <SelectItem value="top-center">Top centre</SelectItem>
                      <SelectItem value="top-left">Top left</SelectItem>
                      <SelectItem value="top-right">Top right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Select
                    value={options.numberFormat}
                    onValueChange={(value) =>
                      update({ numberFormat: value as PageNumberFormat })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="page-of-total">Page 1 of 10</SelectItem>
                      <SelectItem value="x-of-y">1 / 10</SelectItem>
                      <SelectItem value="page-x">Page 1</SelectItem>
                      <SelectItem value="x">1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="number-start">First number</Label>
                  <Input
                    id="number-start"
                    type="number"
                    min={0}
                    value={options.numberStart}
                    onChange={(event) =>
                      update({ numberStart: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="number-pages">Pages</Label>
                  <Input
                    id="number-pages"
                    value={options.pages}
                    onChange={(event) => changePages(event.target.value)}
                    placeholder="all"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Font size</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {options.numberSize} pt
                    </span>
                  </div>
                  <Slider
                    value={[options.numberSize]}
                    min={5}
                    max={36}
                    step={1}
                    onValueChange={([value]) => update({ numberSize: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Margin</Label>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {options.numberMargin} pt
                    </span>
                  </div>
                  <Slider
                    value={[options.numberMargin]}
                    min={8}
                    max={160}
                    step={4}
                    onValueChange={([value]) => update({ numberMargin: value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={options.numberColor}
                      onChange={(event) => update({ numberColor: event.target.value })}
                      className="size-9 cursor-pointer rounded-md border border-border bg-card p-1"
                      aria-label="Page number colour"
                    />
                    <Input
                      value={options.numberColor}
                      onChange={(event) => update({ numberColor: event.target.value })}
                      className="font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {inputs.length === 0
                  ? "Add a file to begin."
                  : `${inputs.length} file${inputs.length === 1 ? "" : "s"} ready · ${formatBytes(inputs.reduce((total, input) => total + input.size, 0))}`}
              </p>
              <Button
                onClick={() => void run()}
                disabled={busy || inputs.length === 0}
                className="min-w-[174px]"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {busyLabel || "Processing…"}
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Run {tool.short.toLowerCase()}
                  </>
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <div>
                      <p className="text-[12px] font-semibold">
                        {results.length === 1 ? "Your PDF is ready" : `${results.length} PDFs are ready`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {results.reduce((total, result) => total + result.pageCount, 0)} pages in
                        total
                      </p>
                    </div>
                  </div>
                  {results.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={downloadAll}>
                        <Download className="size-3.5" />
                        Download each
                      </Button>
                      <Button variant="soft" size="sm" onClick={downloadAllZip} className="gap-1.5">
                        <FileArchive className="size-3.5" />
                        Download ZIP
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-1.5">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-2"
                    >
                      <FileText className="size-3.5 shrink-0 text-forge-700 dark:text-forge-300" />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                        {result.name}
                      </span>
                      <span className="text-[9.5px] text-muted-foreground">
                        {result.pageCount} page{result.pageCount === 1 ? "" : "s"}
                        {result.pageNumbers
                          ? ` · ${result.pageNumbers.join(", ")}`
                          : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => void editResult(result)}
                        disabled={editingResultId !== null}
                      >
                        {editingResultId === result.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <FileOutput className="size-3.5" />
                        )}
                        Edit
                      </Button>
                      <Button variant="soft" size="xs" onClick={() => downloadResult(result)}>
                        <Download className="size-3.5" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <p className="mt-7 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <ShieldCheck className="size-3" />
        PDFs are never uploaded. Results are generated in this tab and downloaded from it.
      </p>
    </div>
  );
}
