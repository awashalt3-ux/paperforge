import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Italic,
  Layers3,
  Loader2,
  Lock,
  LockOpen,
  Minus,
  Plus,
  RotateCw,
  Square,
  Table2,
  Trash2,
  Type,
  Underline,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ImageElement,
  ImageRole,
  PaperElement,
  PaperPage,
  ShapeElement,
  TableElement,
  TextElement,
} from "@/types/document";
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  cloneElementWithOffset,
  elementDisplayName,
} from "@/utils/elementDefaults";
import { rotatePageData } from "@/utils/documentFactory";
import { getPresetLabel, ptToMm } from "@/utils/pageSizes";
import { prepareImageFile } from "@/utils/files";
import { cn, clamp, round } from "@/lib/utils";

function formatNumber(value: number): string {
  return String(round(value, 2));
}

function PanelSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/60 px-3.5 py-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="micro-label">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function NumberInput({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  suffix,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(() => formatNumber(value));
  const focusedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatNumber(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (Number.isFinite(parsed)) {
      const bounded = clamp(parsed, min ?? -1_000_000, max ?? 1_000_000);
      onCommit(round(bounded, 2));
      setDraft(formatNumber(bounded));
    } else {
      setDraft(formatNumber(value));
    }
  };

  return (
    <label
      className={cn(
        "flex h-7 items-center gap-1 rounded-md border border-input bg-card px-1.5 text-[10px] shadow-[0_1px_1px_rgba(15,23,20,0.03)] focus-within:ring-2 focus-within:ring-ring/25",
        disabled && "opacity-55",
      )}
    >
      <span className="shrink-0 font-medium uppercase tracking-[0.04em] text-muted-foreground/75">
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        step={step}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          focusedRef.current = true;
          event.currentTarget.select();
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (cancelRef.current) {
            cancelRef.current = false;
            setDraft(formatNumber(value));
            return;
          }
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelRef.current = true;
            event.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-[11px] tabular-nums outline-none"
        aria-label={label}
      />
      {suffix && <span className="shrink-0 text-[9px] text-muted-foreground/60">{suffix}</span>}
    </label>
  );
}

function ColorInput({
  value,
  onChange,
  disabled,
  allowTransparent = false,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowTransparent?: boolean;
}) {
  const transparent = !value || value === "transparent";
  const normalized = transparent ? "#ffffff" : value;
  return (
    <div className="flex items-center gap-1.5">
      <label
        className={cn(
          "relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-inner",
          disabled && "pointer-events-none opacity-55",
        )}
        style={{
          background: transparent
            ? "repeating-conic-gradient(#e5e7e6 0% 25%, #ffffff 0% 50%) 50% / 8px 8px"
            : value,
        }}
      >
        <input
          type="color"
          value={normalized}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Choose colour"
        />
      </label>
      <span className="flex-1 truncate rounded-md border border-border/70 bg-muted/35 px-2 py-1 font-mono text-[9.5px] text-muted-foreground">
        {transparent ? "Transparent" : value}
      </span>
      {allowTransparent && !transparent && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onChange("transparent")}
          disabled={disabled}
          className="text-muted-foreground"
          aria-label="Remove colour"
        >
          <Minus className="size-3" />
        </Button>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md border border-input bg-muted/30 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex h-6 flex-1 items-center justify-center rounded-[4px] px-1.5 text-[10.5px] font-medium transition-colors disabled:opacity-50",
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

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="bg-card/60 text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function elementIcon(element: PaperElement) {
  if (element.type === "text") return Type;
  if (element.type === "image") return ImageIcon;
  if (element.type === "table") return Table2;
  return Square;
}

function elementsBounds(elements: PaperElement[]) {
  return elements.reduce(
    (bounds, element) => ({
      left: Math.min(bounds.left, element.x),
      top: Math.min(bounds.top, element.y),
      right: Math.max(bounds.right, element.x + element.width),
      bottom: Math.max(bounds.bottom, element.y + element.height),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );
}

export function PropertiesPanel({ className }: { className?: string }) {
  const document = useDocumentStore((state) => state.activeDocument);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const updateElements = useDocumentStore((state) => state.updateElements);
  const addElements = useDocumentStore((state) => state.addElements);
  const deleteElements = useDocumentStore((state) => state.deleteElements);
  const reorderElements = useDocumentStore((state) => state.reorderElements);
  const setElementsLocked = useDocumentStore((state) => state.setElementsLocked);
  const updatePage = useDocumentStore((state) => state.updatePage);
  const replacePage = useDocumentStore((state) => state.replacePage);
  const duplicatePage = useDocumentStore((state) => state.duplicatePage);
  const deletePage = useDocumentStore((state) => state.deletePage);
  const renameActiveDocument = useDocumentStore((state) => state.renameActiveDocument);
  const setMetadata = useDocumentStore((state) => state.setMetadata);

  const activePageId = useEditorStore((state) => state.activePageId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const toggleSelectedId = useEditorStore((state) => state.toggleSelectedId);
  const goToPage = useEditorStore((state) => state.goToPage);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [replacingImage, setReplacingImage] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState(document?.title ?? "");
  const [metadataAuthor, setMetadataAuthor] = useState(document?.metadata.author ?? "");
  const [metadataSubject, setMetadataSubject] = useState(document?.metadata.subject ?? "");

  const page: PaperPage | undefined =
    document?.pages.find((item) => item.id === activePageId) ?? document?.pages[0];
  const selected = useMemo(
    () => page?.elements.filter((element) => selectedIds.includes(element.id)) ?? [],
    [page, selectedIds],
  );
  const single = selected.length === 1 ? selected[0] : null;
  const allLocked = selected.length > 0 && selected.every((element) => element.locked);
  const hasLocked = selected.some((element) => element.locked);

  useEffect(() => {
    setMetadataTitle(document?.title ?? "");
    setMetadataAuthor(document?.metadata.author ?? "");
    setMetadataSubject(document?.metadata.subject ?? "");
  }, [document?.id, document?.title, document?.metadata.author, document?.metadata.subject]);

  if (!document || !page) {
    return (
      <aside className={cn("flex h-full w-[300px] flex-col border-l bg-card", className)}>
        <div className="grid flex-1 place-items-center p-6 text-center text-[11px] text-muted-foreground">
          No document open.
        </div>
      </aside>
    );
  }

  const patch = (id: string, value: Partial<PaperElement>, historyKey?: string) => {
    updateElement(id, value, historyKey ? { historyKey } : undefined);
  };

  const duplicateSelection = () => {
    if (selected.length === 0) return;
    const clones = selected.map((element) => cloneElementWithOffset(element, 14));
    addElements(page.id, clones);
    setSelectedIds(clones.map((element) => element.id));
    toast.success(clones.length > 1 ? "Elements duplicated" : "Element duplicated");
  };

  const deleteSelection = () => {
    if (selected.length === 0) return;
    deleteElements(selected.map((element) => element.id));
    setSelectedIds([]);
  };

  const alignSelection = (
    mode: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) => {
    if (selected.length < 2) return;
    const bounds = elementsBounds(selected);
    const updates = selected.map((element) => {
      if (mode === "left") return { id: element.id, patch: { x: round(bounds.left, 2) } };
      if (mode === "right")
        return { id: element.id, patch: { x: round(bounds.right - element.width, 2) } };
      if (mode === "center")
        return {
          id: element.id,
          patch: { x: round((bounds.left + bounds.right) / 2 - element.width / 2, 2) },
        };
      if (mode === "top") return { id: element.id, patch: { y: round(bounds.top, 2) } };
      if (mode === "bottom")
        return { id: element.id, patch: { y: round(bounds.bottom - element.height, 2) } };
      return {
        id: element.id,
        patch: { y: round((bounds.top + bounds.bottom) / 2 - element.height / 2, 2) },
      };
    });
    updateElements(updates, { historyKey: `align-${mode}-${selected.map((el) => el.id).join("-")}` });
  };

  const distributeSelection = (axis: "horizontal" | "vertical") => {
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) =>
      axis === "horizontal" ? a.x - b.x : a.y - b.y,
    );
    const totalSize = sorted.reduce(
      (sum, element) => sum + (axis === "horizontal" ? element.width : element.height),
      0,
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const available =
      axis === "horizontal"
        ? last.x + last.width - first.x
        : last.y + last.height - first.y;
    const gap = (available - totalSize) / (sorted.length - 1);
    let cursor = axis === "horizontal" ? first.x : first.y;
    const updates = sorted.map((element) => {
      const update =
        axis === "horizontal"
          ? { id: element.id, patch: { x: round(cursor, 2) } }
          : { id: element.id, patch: { y: round(cursor, 2) } };
      cursor += (axis === "horizontal" ? element.width : element.height) + gap;
      return update;
    });
    updateElements(updates, {
      historyKey: `distribute-${axis}-${selected.map((el) => el.id).join("-")}`,
    });
  };

  const opacity = selected.length > 0 ? selected[0].opacity : 1;
  const setOpacity = (value: number) => {
    const next = round(clamp(value, 0, 1), 3);
    updateElements(
      selected.map((element) => ({ id: element.id, patch: { opacity: next } })),
      { historyKey: `opacity-${selected.map((element) => element.id).join("-")}` },
    );
  };

  const replaceImage = async (file: File | null) => {
    if (!file || !single || single.type !== "image") return;
    setReplacingImage(true);
    try {
      const prepared = await prepareImageFile(file);
      const ratio = prepared.width / prepared.height;
      const height = single.width / ratio;
      updateElement<ImageElement>(single.id, {
        src: prepared.src,
        alt: file.name,
        height: round(Math.min(height, page.height - single.y), 2),
      });
      toast.success("Image replaced");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be replaced.");
    } finally {
      setReplacingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const deleteCurrentPage = () => {
    const index = document.pages.findIndex((item) => item.id === page.id);
    const next = document.pages[index + 1] ?? document.pages[index - 1];
    if (!deletePage(page.id)) {
      toast.error("A document must keep at least one page.");
      return;
    }
    if (next) goToPage(next.id);
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[300px] shrink-0 flex-col border-l border-border/70 bg-card/90 backdrop-blur-sm",
        className,
      )}
      aria-label="Element properties"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[-0.01em]">
            {single
              ? elementDisplayName(single)
              : selected.length > 1
                ? `${selected.length} elements`
                : "Page settings"}
          </span>
          {allLocked && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[8.5px] font-medium uppercase tracking-wide text-muted-foreground">
              Locked
            </span>
          )}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-0.5">
            <IconAction
              label={allLocked ? "Unlock selection" : "Lock selection"}
              onClick={() => setElementsLocked(selected.map((element) => element.id), !allLocked)}
            >
              {allLocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
            </IconAction>
            <IconAction
              label="Duplicate selection"
              onClick={duplicateSelection}
            >
              <Copy className="size-3.5" />
            </IconAction>
            <IconAction
              label="Delete selection"
              onClick={deleteSelection}
              disabled={hasLocked && selected.every((element) => element.locked)}
            >
              <Trash2 className="size-3.5 text-destructive/80" />
            </IconAction>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected.length === 0 ? (
          <>
            <PanelSection title="Page">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Page</span>
                  <span className="text-[11px] font-medium tabular-nums">
                    {document.pages.findIndex((item) => item.id === page.id) + 1} of{" "}
                    {document.pages.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberInput
                    label="W"
                    value={page.width}
                    min={100}
                    max={5000}
                    onCommit={(value) => updatePage(page.id, { width: value })}
                    suffix="pt"
                  />
                  <NumberInput
                    label="H"
                    value={page.height}
                    min={100}
                    max={5000}
                    onCommit={(value) => updatePage(page.id, { height: value })}
                    suffix="pt"
                  />
                </div>
                <div className="flex items-center justify-between text-[9.5px] text-muted-foreground/70">
                  <span>{getPresetLabel(page.width, page.height)}</span>
                  <span>
                    {Math.round(ptToMm(page.width))} × {Math.round(ptToMm(page.height))} mm
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Background</Label>
                  <ColorInput
                    value={page.background}
                    onChange={(value) => updatePage(page.id, { background: value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      replacePage(page.id, rotatePageData(page), {
                        historyKey: `rotate-page-${page.id}`,
                      });
                    }}
                    className="gap-1.5 bg-card/70"
                  >
                    <RotateCw className="size-3.5" />
                    Rotate 90°
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      const copy = duplicatePage(page.id);
                      if (copy) goToPage(copy.id);
                    }}
                    className="gap-1.5 bg-card/70"
                  >
                    <Copy className="size-3.5" />
                    Duplicate
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={deleteCurrentPage}
                  disabled={document.pages.length <= 1}
                  className="w-full gap-1.5 border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete page
                </Button>
              </div>
            </PanelSection>

            <PanelSection title="Document details">
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label className="text-[10.5px] text-muted-foreground">Title</Label>
                  <Input
                    value={metadataTitle}
                    onChange={(event) => setMetadataTitle(event.target.value)}
                    onBlur={() => {
                      const clean = metadataTitle.trim();
                      if (clean && clean !== document.title) {
                        renameActiveDocument(clean);
                      } else {
                        setMetadataTitle(document.title);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="h-8 text-[11.5px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] text-muted-foreground">Author</Label>
                  <Input
                    value={metadataAuthor}
                    onChange={(event) => setMetadataAuthor(event.target.value)}
                    onBlur={() => setMetadata({ author: metadataAuthor.trim() })}
                    placeholder="Your name or studio"
                    className="h-8 text-[11.5px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] text-muted-foreground">Subject</Label>
                  <Input
                    value={metadataSubject}
                    onChange={(event) => setMetadataSubject(event.target.value)}
                    onBlur={() => setMetadata({ subject: metadataSubject.trim() })}
                    placeholder="Document subject"
                    className="h-8 text-[11.5px]"
                  />
                </div>
                <p className="text-[9.5px] leading-relaxed text-muted-foreground/65">
                  These details are written into the PDF file when you export. Keywords and creator
                  can be edited in the export dialog.
                </p>
              </div>
            </PanelSection>

            <div className="px-3.5 py-4">
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center">
                <p className="text-[10.5px] font-medium text-foreground/75">Nothing selected</p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground/70">
                  Click an element on the page to edit its content, position, and style. Use the
                  layers below to reach hidden or locked elements.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {single && (
              <>
                <PanelSection title="Position & size">
                  <div className="grid grid-cols-2 gap-1.5">
                    <NumberInput
                      label="X"
                      value={single.x}
                      disabled={single.locked}
                      onCommit={(value) => patch(single.id, { x: value })}
                    />
                    <NumberInput
                      label="Y"
                      value={single.y}
                      disabled={single.locked}
                      onCommit={(value) => patch(single.id, { y: value })}
                    />
                    <NumberInput
                      label="W"
                      value={single.width}
                      min={1}
                      disabled={single.locked}
                      onCommit={(value) => patch(single.id, { width: value })}
                    />
                    <NumberInput
                      label="H"
                      value={single.height}
                      min={1}
                      disabled={single.locked}
                      onCommit={(value) => patch(single.id, { height: value })}
                    />
                    <NumberInput
                      label="R"
                      value={single.rotation}
                      min={-360}
                      max={360}
                      disabled={single.locked}
                      onCommit={(value) => patch(single.id, { rotation: value })}
                      suffix="°"
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => patch(single.id, { rotation: 0 })}
                        disabled={single.locked}
                        title="Reset rotation"
                        aria-label="Reset rotation"
                        className="h-7 w-full bg-card/60 text-muted-foreground"
                      >
                        <RotateCw className="size-3.5" />
                        0°
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Opacity</span>
                      <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(opacity * 100)]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={single.locked}
                      onValueChange={([value]) => setOpacity(value / 100)}
                    />
                  </div>
                </PanelSection>

                {single.type === "text" && (
                  <TextProperties
                    element={single}
                    onChange={(value, key) =>
                      patch(single.id, value, key ? `text-${key}-${single.id}` : undefined)
                    }
                  />
                )}
                {single.type === "image" && (
                  <ImageProperties
                    element={single}
                    replacing={replacingImage}
                    onReplace={() => imageInputRef.current?.click()}
                    onChange={(value, key) =>
                      patch(single.id, value, key ? `image-${key}-${single.id}` : undefined)
                    }
                  />
                )}
                {single.type === "shape" && (
                  <ShapeProperties
                    element={single}
                    onChange={(value, key) =>
                      patch(single.id, value, key ? `shape-${key}-${single.id}` : undefined)
                    }
                  />
                )}
                {single.type === "table" && (
                  <TableProperties
                    element={single}
                    onChange={(value, key) =>
                      patch(single.id, value, key ? `table-${key}-${single.id}` : undefined)
                    }
                  />
                )}
              </>
            )}

            {selected.length > 1 && (
              <PanelSection title="Align & distribute">
                <div className="grid grid-cols-6 gap-1">
                  <IconAction label="Align left" onClick={() => alignSelection("left")}>
                    <AlignLeft className="size-3.5" />
                  </IconAction>
                  <IconAction label="Align centre" onClick={() => alignSelection("center")}>
                    <AlignCenter className="size-3.5" />
                  </IconAction>
                  <IconAction label="Align right" onClick={() => alignSelection("right")}>
                    <AlignRight className="size-3.5" />
                  </IconAction>
                  <IconAction label="Align top" onClick={() => alignSelection("top")}>
                    <ArrowUpToLine className="size-3.5" />
                  </IconAction>
                  <IconAction label="Align middle" onClick={() => alignSelection("middle")}>
                    <AlignVerticalSpaceAround className="size-3.5" />
                  </IconAction>
                  <IconAction label="Align bottom" onClick={() => alignSelection("bottom")}>
                    <ArrowDownToLine className="size-3.5" />
                  </IconAction>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => distributeSelection("horizontal")}
                    disabled={selected.length < 3}
                    className="gap-1.5 bg-card/60"
                  >
                    <AlignHorizontalSpaceAround className="size-3.5" />
                    Distribute across
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => distributeSelection("vertical")}
                    disabled={selected.length < 3}
                    className="gap-1.5 bg-card/60"
                  >
                    <AlignVerticalSpaceAround className="size-3.5" />
                    Distribute down
                  </Button>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Group opacity</span>
                    <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round(opacity * 100)]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => setOpacity(value / 100)}
                  />
                </div>
              </PanelSection>
            )}

            <PanelSection title="Arrange">
              <div className="grid grid-cols-4 gap-1">
                <IconAction
                  label="Bring to front"
                  onClick={() => reorderElements(selected.map((element) => element.id), "front")}
                >
                  <ChevronsUp className="size-3.5" />
                </IconAction>
                <IconAction
                  label="Bring forward"
                  onClick={() => reorderElements(selected.map((element) => element.id), "forward")}
                >
                  <ArrowUpToLine className="size-3.5" />
                </IconAction>
                <IconAction
                  label="Send backward"
                  onClick={() => reorderElements(selected.map((element) => element.id), "backward")}
                >
                  <ArrowDownToLine className="size-3.5" />
                </IconAction>
                <IconAction
                  label="Send to back"
                  onClick={() => reorderElements(selected.map((element) => element.id), "back")}
                >
                  <ChevronsDown className="size-3.5" />
                </IconAction>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground/65">
                Elements higher in the stack paint above those below. Use the layers list to select
                overlapping elements.
              </p>
            </PanelSection>
          </>
        )}

        <PanelSection
          title="Layers"
          action={
            <span className="text-[9px] text-muted-foreground/60">{page.elements.length}</span>
          }
        >
          {page.elements.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/70 px-2.5 py-3 text-center text-[9.5px] text-muted-foreground/65">
              This page is empty. Add text or an image to begin.
            </p>
          ) : (
            <div className="space-y-0.5">
              {[...page.elements].reverse().map((element) => {
                const Icon = elementIcon(element);
                const isSelected = selectedIds.includes(element.id);
                return (
                  <div
                    key={element.id}
                    className={cn(
                      "group flex h-7 items-center gap-1 rounded-md px-1 transition-colors",
                      isSelected ? "bg-accent/70" : "hover:bg-accent/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelected) toggleSelectedId(element.id);
                        else setSelectedIds([element.id]);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <Icon className="size-3 shrink-0 text-muted-foreground/65" />
                      <span
                        className={cn(
                          "truncate text-[10.5px]",
                          element.visible ? "text-foreground/80" : "text-muted-foreground/50",
                          element.locked && "italic",
                        )}
                      >
                        {element.name || elementDisplayName(element)}
                        {element.type === "text" && (
                          <span className="ml-1 text-muted-foreground/45">
                            {element.text.trim().slice(0, 14)}
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch(element.id, { visible: !element.visible }, `visible-${element.id}`)
                      }
                      className={cn(
                        "rounded p-1 text-muted-foreground/45 hover:bg-background/80 hover:text-foreground",
                        !element.visible && "text-muted-foreground/25",
                      )}
                      aria-label={element.visible ? "Hide layer" : "Show layer"}
                    >
                      {element.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setElementsLocked([element.id], !element.locked)}
                      className={cn(
                        "rounded p-1 text-muted-foreground/45 hover:bg-background/80 hover:text-foreground",
                        element.locked && "text-forge-700 dark:text-forge-300",
                      )}
                      aria-label={element.locked ? "Unlock layer" : "Lock layer"}
                    >
                      {element.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>

        <div className="flex items-center justify-between px-3.5 py-3 text-[9px] text-muted-foreground/55">
          <span className="flex items-center gap-1">
            <Layers3 className="size-3" />
            {page.elements.length} layer{page.elements.length === 1 ? "" : "s"}
          </span>
          <span>
            {getPresetLabel(page.width, page.height)} ·{" "}
            {Math.round(ptToMm(page.width))}×{Math.round(ptToMm(page.height))} mm
          </span>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(event) => void replaceImage(event.target.files?.[0] ?? null)}
      />
    </aside>
  );
}

function TextProperties({
  element,
  onChange,
}: {
  element: TextElement;
  onChange: (value: Partial<TextElement>, key?: string) => void;
}) {
  return (
    <PanelSection title="Typography">
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Content</Label>
          <textarea
            value={element.text}
            disabled={element.locked}
            onChange={(event) => onChange({ text: event.target.value }, "content")}
            rows={4}
            className="w-full resize-y rounded-md border border-input bg-card px-2 py-1.5 text-[11.5px] leading-relaxed outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-55"
          />
        </div>
        <div className="grid grid-cols-[1fr_70px] gap-1.5">
          <Select
            value={element.fontFamily}
            disabled={element.locked}
            onValueChange={(value) => onChange({ fontFamily: value as TextElement["fontFamily"] }, "family")}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NumberInput
            label="Size"
            value={element.fontSize}
            min={4}
            max={300}
            step={0.5}
            disabled={element.locked}
            onCommit={(value) => onChange({ fontSize: value }, "size")}
          />
        </div>
        <div className="grid grid-cols-[1fr_70px] gap-1.5">
          <Select
            value={String(element.fontWeight)}
            disabled={element.locked}
            onValueChange={(value) => onChange({ fontWeight: Number(value) }, "weight")}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((weight) => (
                <SelectItem key={weight.value} value={String(weight.value)}>
                  {weight.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Button
              variant={element.italic ? "secondary" : "outline"}
              size="icon-xs"
              onClick={() => onChange({ italic: !element.italic }, "italic")}
              disabled={element.locked}
              aria-label="Italic"
              aria-pressed={element.italic}
              className="h-7 flex-1"
            >
              <Italic className="size-3.5" />
            </Button>
            <Button
              variant={element.underline ? "secondary" : "outline"}
              size="icon-xs"
              onClick={() => onChange({ underline: !element.underline }, "underline")}
              disabled={element.locked}
              aria-label="Underline"
              aria-pressed={element.underline}
              className="h-7 flex-1"
            >
              <Underline className="size-3.5" />
            </Button>
          </div>
        </div>
        <Segmented
          value={element.align}
          disabled={element.locked}
          options={[
            { value: "left", label: <AlignLeft className="size-3.5" />, title: "Align left" },
            { value: "center", label: <AlignCenter className="size-3.5" />, title: "Align centre" },
            { value: "right", label: <AlignRight className="size-3.5" />, title: "Align right" },
          ]}
          onChange={(value) => onChange({ align: value }, "align")}
        />
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Text colour</Label>
          <ColorInput
            value={element.color}
            disabled={element.locked}
            onChange={(value) => onChange({ color: value }, "color")}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Background</Label>
          <ColorInput
            value={element.backgroundColor}
            allowTransparent
            disabled={element.locked}
            onChange={(value) => onChange({ backgroundColor: value }, "background")}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberInput
            label="LH"
            value={element.lineHeight}
            min={0.6}
            max={4}
            step={0.05}
            disabled={element.locked}
            onCommit={(value) => onChange({ lineHeight: value }, "line-height")}
          />
          <NumberInput
            label="LS"
            value={element.letterSpacing}
            min={-10}
            max={40}
            step={0.1}
            disabled={element.locked}
            onCommit={(value) => onChange({ letterSpacing: value }, "letter-spacing")}
          />
          <NumberInput
            label="Pad"
            value={element.padding}
            min={0}
            max={100}
            disabled={element.locked}
            onCommit={(value) => onChange({ padding: value }, "padding")}
          />
        </div>
        <p className="text-[9px] leading-relaxed text-muted-foreground/60">
          <Bold className="mr-0.5 inline size-2.5" />
          Double-click the text on the page for quick inline editing. The box height grows to fit
          your text when you finish editing.
        </p>
      </div>
    </PanelSection>
  );
}

function ImageProperties({
  element,
  onChange,
  onReplace,
  replacing,
}: {
  element: ImageElement;
  onChange: (value: Partial<ImageElement>, key?: string) => void;
  onReplace: () => void;
  replacing: boolean;
}) {
  return (
    <>
      <PanelSection title="Image">
        <div className="space-y-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onReplace}
            disabled={replacing || element.locked}
            className="w-full gap-1.5 bg-card/60 text-[11px]"
          >
            {replacing ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            Replace image file
          </Button>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Fit</Label>
            <Segmented
              value={element.fit}
              disabled={element.locked}
              options={[
                { value: "contain", label: "Contain" },
                { value: "cover", label: "Cover" },
                { value: "fill", label: "Stretch" },
              ]}
              onChange={(value) => onChange({ fit: value }, "fit")}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberInput
              label="Radius"
              value={element.cornerRadius}
              min={0}
              max={Math.min(element.width, element.height) / 2}
              disabled={element.locked}
              onCommit={(value) => onChange({ cornerRadius: value }, "radius")}
            />
            <Select
              value={element.role}
              disabled={element.locked}
              onValueChange={(value) => onChange({ role: value as ImageRole }, "role")}
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="logo">Logo</SelectItem>
                <SelectItem value="signature">Signature</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Alt text</Label>
            <Input
              value={element.alt ?? ""}
              disabled={element.locked}
              onChange={(event) => onChange({ alt: event.target.value }, "alt")}
              placeholder="Describe this image"
              className="h-8 text-[11px]"
            />
          </div>
        </div>
      </PanelSection>
    </>
  );
}

function ShapeProperties({
  element,
  onChange,
}: {
  element: ShapeElement;
  onChange: (value: Partial<ShapeElement>, key?: string) => void;
}) {
  const isLine = element.shape === "line";
  return (
    <PanelSection title={element.purpose === "highlight" ? "Highlight" : "Shape style"}>
      <div className="space-y-2.5">
        {!isLine && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Fill</Label>
            <ColorInput
              value={element.fill}
              allowTransparent
              disabled={element.locked}
              onChange={(value) => onChange({ fill: value }, "fill")}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            {isLine ? "Line colour" : "Border colour"}
          </Label>
          <ColorInput
            value={element.stroke}
            allowTransparent
            disabled={element.locked}
            onChange={(value) => onChange({ stroke: value }, "stroke")}
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberInput
            label="Width"
            value={element.strokeWidth}
            min={0}
            max={40}
            step={0.25}
            disabled={element.locked}
            onCommit={(value) => onChange({ strokeWidth: value }, "stroke-width")}
          />
          {!isLine && (
            <NumberInput
              label="Radius"
              value={element.cornerRadius}
              min={0}
              max={80}
              disabled={element.locked}
              onCommit={(value) => onChange({ cornerRadius: value }, "radius")}
            />
          )}
          {isLine && (
            <div className="col-span-2 flex items-center">
              <Segmented
                value={element.dash && element.dash.length > 0 ? "dashed" : "solid"}
                disabled={element.locked}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                ]}
                onChange={(value) =>
                  onChange({ dash: value === "dashed" ? [6, 4] : undefined }, "dash")
                }
              />
            </div>
          )}
        </div>
        {!isLine && (
          <ToggleRow
            label="Highlight (multiply blend)"
            checked={element.purpose === "highlight"}
            disabled={element.locked}
            onChange={(value) => onChange({ purpose: value ? "highlight" : "shape" }, "purpose")}
          />
        )}
        <p className="text-[9px] leading-relaxed text-muted-foreground/60">
          {element.purpose === "highlight"
            ? "Highlights blend with the content beneath when exported to PDF."
            : "Borders and fills are exported as true vector shapes."}
        </p>
      </div>
    </PanelSection>
  );
}

function TableProperties({
  element,
  onChange,
}: {
  element: TableElement;
  onChange: (value: Partial<TableElement>, key?: string) => void;
}) {
  const columns = Math.max(1, ...element.rows.map((row) => row.length));

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = element.rows.map((row) => [...row]);
    while (rows[rowIndex].length < columns) rows[rowIndex].push("");
    rows[rowIndex][columnIndex] = value;
    onChange({ rows }, `cell-${rowIndex}-${columnIndex}`);
  };

  const addRow = () => {
    const rows = [...element.rows.map((row) => [...row]), Array(columns).fill("")];
    onChange(
      {
        rows,
        height: Math.min(800, element.height + 24),
      },
      "rows-add",
    );
  };

  const removeRow = () => {
    if (element.rows.length <= 1) return;
    const rows = element.rows.slice(0, -1).map((row) => [...row]);
    onChange({ rows, height: Math.max(24, element.height - 24) }, "rows-remove");
  };

  const addColumn = () => {
    const rows = element.rows.map((row) => [...row, ""]);
    const weights =
      element.columnWeights?.length === columns
        ? [...element.columnWeights, 1]
        : Array(columns + 1).fill(1);
    onChange({ rows, columnWeights: weights }, "column-add");
  };

  const removeColumn = () => {
    if (columns <= 1) return;
    const rows = element.rows.map((row) => row.slice(0, columns - 1));
    const weights =
      element.columnWeights?.length === columns
        ? element.columnWeights.slice(0, columns - 1)
        : Array(columns - 1).fill(1);
    onChange({ rows, columnWeights: weights }, "column-remove");
  };

  return (
    <PanelSection title="Table">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {element.rows.length} rows · {columns} columns
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={addRow}
              disabled={element.locked}
              aria-label="Add row"
              className="h-6 w-6"
            >
              <Plus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={removeRow}
              disabled={element.locked || element.rows.length <= 1}
              aria-label="Remove row"
              className="h-6 w-6"
            >
              <Minus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={addColumn}
              disabled={element.locked}
              aria-label="Add column"
              className="h-6 w-6"
            >
              <Plus className="size-3" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={removeColumn}
              disabled={element.locked || columns <= 1}
              aria-label="Remove column"
              className="h-6 w-6"
            >
              <Minus className="size-3" />
            </Button>
          </div>
        </div>
        <div className="max-h-52 overflow-auto rounded-md border border-border/70 bg-card">
          <table className="w-full border-collapse">
            <tbody>
              {element.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: columns }).map((_, columnIndex) => (
                    <td key={columnIndex} className="border border-border/50 p-0">
                      <input
                        value={row[columnIndex] ?? ""}
                        disabled={element.locked}
                        onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)}
                        aria-label={`Cell ${rowIndex + 1}, ${columnIndex + 1}`}
                        className={cn(
                          "h-6 w-full min-w-[46px] bg-transparent px-1 text-[9.5px] outline-none focus:bg-accent/40",
                          rowIndex === 0 &&
                            element.headerRow &&
                            "font-semibold text-foreground/90",
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ToggleRow
          label="Header row"
          checked={element.headerRow}
          disabled={element.locked}
          onChange={(value) => onChange({ headerRow: value }, "header-row")}
        />
        <div className="grid grid-cols-[1fr_70px] gap-1.5">
          <Select
            value={element.fontFamily}
            disabled={element.locked}
            onValueChange={(value) =>
              onChange({ fontFamily: value as TableElement["fontFamily"] }, "font-family")
            }
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <NumberInput
            label="Size"
            value={element.fontSize}
            min={4}
            max={40}
            step={0.5}
            disabled={element.locked}
            onCommit={(value) => onChange({ fontSize: value }, "font-size")}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[9.5px] text-muted-foreground">Text</Label>
            <ColorInput
              value={element.color}
              disabled={element.locked}
              onChange={(value) => onChange({ color: value }, "text-color")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9.5px] text-muted-foreground">Border</Label>
            <ColorInput
              value={element.borderColor}
              disabled={element.locked}
              onChange={(value) => onChange({ borderColor: value }, "border-color")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9.5px] text-muted-foreground">Header text</Label>
            <ColorInput
              value={element.headerColor}
              disabled={element.locked}
              onChange={(value) => onChange({ headerColor: value }, "header-color")}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[9.5px] text-muted-foreground">Header fill</Label>
            <ColorInput
              value={element.headerBackground}
              allowTransparent
              disabled={element.locked}
              onChange={(value) => onChange({ headerBackground: value }, "header-background")}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberInput
            label="Border"
            value={element.borderWidth}
            min={0}
            max={8}
            step={0.25}
            disabled={element.locked}
            onCommit={(value) => onChange({ borderWidth: value }, "border-width")}
          />
          <NumberInput
            label="Pad"
            value={element.cellPadding}
            min={0}
            max={40}
            disabled={element.locked}
            onCommit={(value) => onChange({ cellPadding: value }, "cell-padding")}
          />
        </div>
      </div>
    </PanelSection>
  );
}
