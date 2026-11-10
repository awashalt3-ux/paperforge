import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  FileDown,
  FileOutput,
  Grid3X3,
  Keyboard,
  Loader2,
  Magnet,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Redo2,
  Save,
  ShieldCheck,
  Sparkles,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ImageElement,
  ImageRole,
  PaperElement,
  PaperPage,
  TextElement,
} from "@/types/document";
import { BrandMark } from "@/components/common/Brand";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { PageSidebar } from "@/components/editor/PageSidebar";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { SignatureDialog } from "@/components/editor/SignatureDialog";
import { ExportDialog } from "@/components/pdf/ExportDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentStore } from "@/store/documentStore";
import type { SaveStatus } from "@/store/documentStore";
import { useEditorStore, ZOOM_MAX, ZOOM_MIN } from "@/store/editorStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { useUIStore } from "@/store/uiStore";
import { exportProjectFile } from "@/services/projects";
import { prepareImageFile } from "@/utils/files";
import {
  cloneElementWithOffset,
  defaultImage,
  defaultShape,
  defaultTable,
  defaultText,
} from "@/utils/elementDefaults";
import { createElementId } from "@/utils/id";
import { cn, clamp, formatRelativeDate, isTypingTarget, round } from "@/lib/utils";

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: "Ready",
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved",
  error: "Save failed",
};

function SaveIndicator({
  status,
  lastSavedAt,
  autosave,
  onSave,
}: {
  status: SaveStatus;
  lastSavedAt: number | null;
  autosave: boolean;
  onSave: () => void;
}) {
  const tone =
    status === "error"
      ? "text-destructive"
      : status === "unsaved"
        ? "text-amber-600 dark:text-amber-400"
        : status === "saved"
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded px-1 text-[9.5px] font-medium transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            tone,
          )}
          aria-label="Save the document now"
        >
          {status === "saving" ? (
            <Loader2 className="size-2.5 animate-spin" />
          ) : status === "error" ? (
            <AlertTriangle className="size-2.5" />
          ) : status === "unsaved" ? (
            <span className="size-1.5 rounded-full bg-amber-500" />
          ) : (
            <Check className="size-2.5" />
          )}
          {SAVE_LABELS[status]}
          {!autosave && <span className="text-muted-foreground/80">· autosave off</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {status === "error"
          ? "Your latest changes could not be saved. Click to try again."
          : lastSavedAt
            ? `Last saved ${formatRelativeDate(lastSavedAt)}. Click to save now.`
            : "Saved locally in this browser. Click to save now."}
      </TooltipContent>
    </Tooltip>
  );
}

function HeaderIcon({
  label,
  onClick,
  children,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn("text-muted-foreground", active && "text-foreground")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function contentMarginX(page: PaperPage): number {
  return clamp(page.width * 0.1, 20, 72);
}

function contentMarginY(page: PaperPage): number {
  return clamp(page.height * 0.07, 20, 72);
}

function verticalInsertion(page: PaperPage, height: number): number {
  const top = contentMarginY(page);
  const offset = (page.elements.length % 7) * 22;
  return clamp(top + 20 + offset, top, Math.max(top, page.height - height - top));
}

function suggestHighlight(
  page: PaperPage,
  selected: PaperElement[],
): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  beforeId?: string;
} {
  const text = selected.find(
    (element): element is TextElement => element.type === "text" && element.visible,
  );
  if (text) {
    return {
      x: Math.max(0, text.x),
      y: Math.max(0, text.y + Math.min(2, text.fontSize * 0.14)),
      width: Math.max(16, text.width),
      height: Math.max(12, text.height),
      rotation: text.rotation,
      beforeId: text.id,
    };
  }
  const margin = contentMarginX(page);
  const width = Math.min(440, Math.max(80, page.width - margin * 2));
  return {
    x: margin,
    y: clamp(page.height * 0.34, margin, Math.max(margin, page.height - margin - 18)),
    width,
    height: 18,
    rotation: 0,
  };
}

export function EditorPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const doc = useDocumentStore((state) => state.activeDocument);
  const saveStatus = useDocumentStore((state) => state.saveStatus);
  const lastSavedAt = useDocumentStore((state) => state.lastSavedAt);
  const storeError = useDocumentStore((state) => state.error);
  const canUndo = useDocumentStore((state) => state.historyPast.length > 0);
  const canRedo = useDocumentStore((state) => state.historyFuture.length > 0);
  const saveNow = useDocumentStore((state) => state.saveNow);
  const initialize = useDocumentStore((state) => state.initialize);
  const openDocument = useDocumentStore((state) => state.openDocument);

  const zoom = useEditorStore((state) => state.zoom);
  const activePageId = useEditorStore((state) => state.activePageId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const focusMode = useEditorStore((state) => state.focusMode);
  const leftPanelOpen = useEditorStore((state) => state.leftPanelOpen);
  const rightPanelOpen = useEditorStore((state) => state.rightPanelOpen);

  const autosave = usePreferencesStore((state) => state.autosave);
  const showGrid = usePreferencesStore((state) => state.showGrid);
  const snapToGrid = usePreferencesStore((state) => state.snapToGrid);

  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [loadNonce, setLoadNonce] = useState(0);
  const [titleDraft, setTitleDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageRoleRef = useRef<ImageRole>("image");
  const pasteCycleRef = useRef(0);
  const shortcutActionsRef = useRef<Record<string, (() => void) | undefined>>({});

  const isLoading = loadState === "loading" || (loadState === "ready" && doc?.id !== routeId);
  const isMissing = !isLoading && (!doc || doc.id !== routeId || loadState === "missing");

  const activeIndex = useMemo(() => {
    if (!doc) return -1;
    return doc.pages.findIndex((page) => page.id === activePageId);
  }, [doc, activePageId]);

  const activePage = doc?.pages[activeIndex >= 0 ? activeIndex : 0];

  const selectedElements = useMemo(
    () => activePage?.elements.filter((element) => selectedIds.includes(element.id)) ?? [],
    [activePage, selectedIds],
  );

  // Load the requested document and keep the local route state in sync.
  useEffect(() => {
    let alive = true;
    if (!routeId) {
      setLoadState("missing");
      return;
    }
    setLoadState("loading");
    void initialize();
    openDocument(routeId)
      .then((loaded) => {
        if (!alive) return;
        if (loaded && loaded.id === routeId) setLoadState("ready");
        else setLoadState("missing");
      })
      .catch(() => {
        if (alive) setLoadState("missing");
      });
    return () => {
      alive = false;
    };
  }, [routeId, loadNonce, initialize, openDocument]);

  // Restore per-document view state and make sure the active page always exists.
  useEffect(() => {
    if (!doc) return;
    const editor = useEditorStore.getState();
    const firstPageId = doc.pages[0]?.id ?? null;
    if (editor.activeDocumentId !== doc.id) {
      editor.loadDocumentView(doc.id, firstPageId);
    } else if (!doc.pages.some((page) => page.id === editor.activePageId)) {
      editor.setActivePage(firstPageId);
    }
  }, [doc?.id, doc?.pages]);

  useEffect(() => {
    if (!doc) return;
    setTitleDraft(doc.title);
  }, [doc?.id, doc?.title]);

  useEffect(() => {
    if (!doc) return;
    const previous = document.title;
    document.title = `${doc.title} · Paperforge`;
    return () => {
      document.title = previous;
    };
  }, [doc?.id, doc?.title]);

  // Flush the working document if the editor route is left.
  useEffect(() => {
    return () => {
      void useDocumentStore.getState().saveNow();
    };
  }, []);

  const saveDocument = useCallback(
    async (notify = false) => {
      await saveNow();
      const state = useDocumentStore.getState();
      if (state.saveStatus === "error") {
        toast.error(state.error ?? "The document could not be saved.");
      } else if (notify) {
        toast.success("Saved on this device");
      }
    },
    [saveNow],
  );

  const resolveTargetPage = useCallback((): PaperPage | null => {
    const active = useDocumentStore.getState().activeDocument;
    if (!active) return null;
    const pageId = useEditorStore.getState().activePageId;
    return active.pages.find((page) => page.id === pageId) ?? active.pages[0] ?? null;
  }, []);

  const insertElement = useCallback(
    (pageId: string, element: PaperElement, beforeId?: string) => {
      useDocumentStore.getState().updateActive(
        (current) => ({
          ...current,
          pages: current.pages.map((page) => {
            if (page.id !== pageId) return page;
            const elements = [...page.elements];
            if (beforeId) {
              const index = elements.findIndex((item) => item.id === beforeId);
              if (index >= 0) {
                elements.splice(index, 0, element);
                return { ...page, elements };
              }
            }
            elements.push(element);
            return { ...page, elements };
          }),
        }),
        { historyKey: `add-${element.id}` },
      );
      const editor = useEditorStore.getState();
      editor.setActivePage(pageId);
      editor.setSelectedIds([element.id]);
      editor.setTool("select");
    },
    [],
  );

  const addText = useCallback(
    (
      role: TextElement["role"],
      options: { paragraph?: boolean; note?: boolean } = {},
    ) => {
      const page = resolveTargetPage();
      if (!page) return;
      const margin = contentMarginX(page);
      const note = Boolean(options.note);
      const paragraph = Boolean(options.paragraph);
      const desiredWidth = note ? 252 : role === "heading" ? 460 : paragraph ? 440 : 320;
      const width = Math.max(60, Math.min(desiredWidth, page.width - margin * 2));
      const height = note ? 88 : paragraph ? 92 : role === "heading" ? 46 : 26;
      const text =
        role === "heading"
          ? "New heading"
          : note
            ? "Note: add a comment, annotation, or callout."
            : paragraph
              ? "Write a paragraph. Double-click this text to edit it and add your own words."
              : "Start writing…";
      const element = defaultText({
        id: createElementId(),
        x: note ? Math.max(margin, page.width - width - margin) : margin,
        y: verticalInsertion(page, height),
        width,
        height,
        role,
        text,
      });
      if (paragraph) {
        element.lineHeight = 1.65;
        element.height = 92;
      }
      if (note) {
        element.backgroundColor = "#fff6cf";
        element.padding = 10;
        element.fontSize = 10.5;
        element.color = "#715a20";
        element.lineHeight = 1.5;
        element.height = 88;
      }
      insertElement(page.id, element);
    },
    [insertElement, resolveTargetPage],
  );

  const addImageSource = useCallback(
    (
      src: string,
      options: {
        role: ImageRole;
        alt?: string;
        naturalWidth: number;
        naturalHeight: number;
      },
    ): ImageElement | null => {
      const page = resolveTargetPage();
      if (!page) return null;
      const naturalWidth = Math.max(1, options.naturalWidth);
      const naturalHeight = Math.max(1, options.naturalHeight);
      const margin = contentMarginX(page);
      const isLogo = options.role === "logo";
      const isSignature = options.role === "signature";
      const maxWidth = Math.min(
        isLogo ? 200 : isSignature ? 230 : 430,
        Math.max(48, page.width - margin * 2),
      );
      const maxHeight = Math.min(
        isLogo ? 110 : isSignature ? 120 : 350,
        Math.max(36, page.height - margin * 2),
      );
      const scale = Math.min(
        maxWidth / naturalWidth,
        maxHeight / naturalHeight,
        1,
      );
      const width = Math.max(24, naturalWidth * scale);
      const height = Math.max(16, naturalHeight * scale);
      const x = isSignature
        ? Math.max(margin, page.width - width - margin)
        : isLogo
          ? margin
          : clamp((page.width - width) / 2, 0, Math.max(0, page.width - width));
      const y = isSignature
        ? Math.max(margin, page.height - height - margin)
        : isLogo
          ? contentMarginY(page) + 8
          : clamp((page.height - height) / 2, 0, Math.max(0, page.height - height));
      const element = defaultImage({
        id: createElementId(),
        x,
        y,
        width,
        height,
        src,
        role: options.role,
        alt: options.alt,
        fit: "contain",
      });
      insertElement(page.id, element);
      return element;
    },
    [insertElement, resolveTargetPage],
  );

  const openImagePicker = useCallback(
    (role: ImageRole) => {
      if (!useDocumentStore.getState().activeDocument) {
        toast.error("Open a document before adding an image.");
        return;
      }
      imageRoleRef.current = role;
      imageInputRef.current?.click();
    },
    [],
  );

  const handleImageFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const role = imageRoleRef.current;
      setPreparingImage(true);
      try {
        const prepared = await prepareImageFile(file);
        const element = addImageSource(prepared.src, {
          role,
          alt: file.name,
          naturalWidth: prepared.width,
          naturalHeight: prepared.height,
        });
        if (!element) {
          toast.error("This document has no page to place the image on.");
          return;
        }
        toast.success(role === "logo" ? "Logo added" : "Image added");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "The image could not be added.",
        );
      } finally {
        setPreparingImage(false);
        if (imageInputRef.current) imageInputRef.current.value = "";
      }
    },
    [addImageSource],
  );

  const handleSignatureCapture = useCallback(
    (dataUrl: string) => {
      const insert = (naturalWidth: number, naturalHeight: number) => {
        const element = addImageSource(dataUrl, {
          role: "signature",
          alt: "Handwritten signature",
          naturalWidth,
          naturalHeight,
        });
        if (element) toast.success("Signature added");
        else toast.error("This document has no page to place the signature on.");
      };
      const image = new window.Image();
      image.onload = () => insert(image.naturalWidth, image.naturalHeight);
      image.onerror = () => insert(240, 86);
      image.src = dataUrl;
    },
    [addImageSource],
  );

  const addTable = useCallback(() => {
    const page = resolveTargetPage();
    if (!page) return;
    const margin = contentMarginX(page);
    const width = Math.max(120, Math.min(500, page.width - margin * 2));
    const height = Math.min(190, Math.max(120, page.height * 0.24));
    const element = defaultTable({
      id: createElementId(),
      x: clamp((page.width - width) / 2, 0, Math.max(0, page.width - width)),
      y: verticalInsertion(page, height),
      width,
      height,
    });
    insertElement(page.id, element);
  }, [insertElement, resolveTargetPage]);

  const addShape = useCallback(
    (shape: "rectangle" | "ellipse" | "line") => {
      const page = resolveTargetPage();
      if (!page) return;
      const isLine = shape === "line";
      const margin = contentMarginX(page);
      const width = Math.min(isLine ? 240 : 160, Math.max(40, page.width - margin * 2));
      const height = isLine ? 2 : Math.min(110, Math.max(40, page.height * 0.16));
      const element = defaultShape({
        id: createElementId(),
        x: clamp((page.width - width) / 2, 0, Math.max(0, page.width - width)),
        y: isLine
          ? clamp(page.height * 0.5, margin, Math.max(margin, page.height - margin))
          : clamp(
              (page.height - height) / 2,
              0,
              Math.max(0, page.height - height),
            ),
        shape,
        width,
        height,
      });
      insertElement(page.id, element);
    },
    [insertElement, resolveTargetPage],
  );

  const addHighlight = useCallback(() => {
    const page = resolveTargetPage();
    if (!page) return;
    const box = suggestHighlight(page, selectedElements);
    const element = defaultShape({
      id: createElementId(),
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      shape: "rectangle",
      purpose: "highlight",
      rotation: box.rotation,
      fill: "#f8d34d",
      stroke: "transparent",
      strokeWidth: 0,
      cornerRadius: 2,
      opacity: 0.42,
    });
    insertElement(page.id, element, box.beforeId);
  }, [insertElement, resolveTargetPage, selectedElements]);

  const copySelection = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current || editor.selectedIds.length === 0) return;
    const ids = new Set(editor.selectedIds);
    const elements = current.pages
      .flatMap((page) => page.elements)
      .filter((element) => ids.has(element.id))
      .map((element) => structuredClone(element));
    if (elements.length === 0) return;
    editor.setClipboard(elements);
    pasteCycleRef.current = 0;
  }, []);

  const pasteClipboard = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    const clipboard = editor.clipboard;
    if (!current || clipboard.length === 0) return;
    const page =
      current.pages.find((item) => item.id === editor.activePageId) ?? current.pages[0];
    if (!page) return;
    const offset = 18 + Math.min(5, pasteCycleRef.current) * 12;
    pasteCycleRef.current += 1;
    const clones = clipboard.map((element) => {
      const clone = structuredClone(element);
      clone.id = createElementId();
      clone.x = round(clone.x + offset, 2);
      clone.y = round(clone.y + offset, 2);
      clone.locked = false;
      return clone;
    });
    useDocumentStore.getState().addElements(page.id, clones, {
      historyKey: `paste-${clones.map((element) => element.id).join("-")}`,
    });
    editor.setActivePage(page.id);
    editor.setSelectedIds(clones.map((element) => element.id));
    editor.setTool("select");
  }, []);

  const deleteSelection = useCallback(() => {
    const editor = useEditorStore.getState();
    if (editor.selectedIds.length === 0) return;
    useDocumentStore.getState().deleteElements(editor.selectedIds);
    editor.clearSelection();
  }, []);

  const cutSelection = useCallback(() => {
    const editor = useEditorStore.getState();
    if (editor.selectedIds.length === 0) return;
    copySelection();
    useDocumentStore.getState().deleteElements(editor.selectedIds);
    editor.clearSelection();
  }, [copySelection]);

  const duplicateSelection = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current || editor.selectedIds.length === 0) return;
    const page =
      current.pages.find((item) => item.id === editor.activePageId) ?? current.pages[0];
    if (!page) return;
    const ids = new Set(editor.selectedIds);
    const source = page.elements.filter((element) => ids.has(element.id));
    if (source.length === 0) return;
    const clones = source.map((element) => cloneElementWithOffset(element, 18));
    useDocumentStore.getState().addElements(page.id, clones, {
      historyKey: `duplicate-${clones.map((element) => element.id).join("-")}`,
    });
    editor.setSelectedIds(clones.map((element) => element.id));
  }, []);

  const selectAll = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current) return;
    const page =
      current.pages.find((item) => item.id === editor.activePageId) ?? current.pages[0];
    if (!page) return;
    editor.setSelectedIds(page.elements.filter((element) => element.visible).map((element) => element.id));
  }, []);

  const toggleLock = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current || editor.selectedIds.length === 0) return;
    const ids = new Set(editor.selectedIds);
    const selected = current.pages.flatMap((page) => page.elements).filter((element) => ids.has(element.id));
    if (selected.length === 0) return;
    const allLocked = selected.every((element) => element.locked);
    useDocumentStore.getState().setElementsLocked(editor.selectedIds, !allLocked);
  }, []);

  const nudgeSelection = useCallback((dx: number, dy: number) => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current || editor.selectedIds.length === 0) return;
    const ids = new Set(editor.selectedIds);
    const page =
      current.pages.find((item) => item.id === editor.activePageId) ?? current.pages[0];
    if (!page) return;
    const updates = page.elements
      .filter((element) => ids.has(element.id) && !element.locked)
      .map((element) => ({
        id: element.id,
        patch: { x: round(element.x + dx, 2), y: round(element.y + dy, 2) },
      }));
    if (updates.length > 0) {
      useDocumentStore.getState().updateElements(updates, {
        historyKey: `nudge-${updates.map((update) => update.id).sort().join("-")}`,
      });
    }
  }, []);

  const editSelectedText = useCallback(() => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current || editor.selectedIds.length !== 1) return;
    const selected = current.pages
      .flatMap((page) => page.elements)
      .find((element) => element.id === editor.selectedIds[0]);
    if (selected?.type === "text" && !selected.locked) {
      editor.requestEdit(selected.id);
    }
  }, []);

  const reorderSelection = useCallback(
    (
      action: "forward" | "backward" | "front" | "back",
    ) => {
      const editor = useEditorStore.getState();
      if (editor.selectedIds.length === 0) return;
      useDocumentStore.getState().reorderElements(editor.selectedIds, action);
    },
    [],
  );

  const fitToPage = useCallback((mode: "page" | "width") => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current) return;
    const page =
      current.pages.find((item) => item.id === editor.activePageId) ?? current.pages[0];
    const container = document.getElementById("editor-scroll");
    if (!page || !container) return;
    const availableWidth = Math.max(180, container.clientWidth - 92);
    const availableHeight = Math.max(180, container.clientHeight - 110);
    const next =
      mode === "width"
        ? availableWidth / page.width
        : Math.min(availableWidth / page.width, availableHeight / page.height);
    editor.setZoom(clamp(next, ZOOM_MIN, ZOOM_MAX));
  }, []);

  const goToAdjacentPage = useCallback((direction: -1 | 1) => {
    const editor = useEditorStore.getState();
    const current = useDocumentStore.getState().activeDocument;
    if (!current) return;
    const index = current.pages.findIndex((page) => page.id === editor.activePageId);
    const nextIndex = (index < 0 ? 0 : index) + direction;
    const next = current.pages[nextIndex];
    if (next) editor.goToPage(next.id);
  }, []);

  const toggleGrid = useCallback(() => {
    const preferences = usePreferencesStore.getState();
    preferences.setShowGrid(!preferences.showGrid);
  }, []);

  const toggleSnap = useCallback(() => {
    const preferences = usePreferencesStore.getState();
    preferences.setSnapToGrid(!preferences.snapToGrid);
  }, []);

  const handleExportProject = useCallback(async () => {
    const current = useDocumentStore.getState().activeDocument;
    if (!current) return;
    try {
      await saveNow();
      await exportProjectFile(current.id, current.title);
      toast.success("Project file exported");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The project file could not be exported.",
      );
    }
  }, [saveNow]);

  const commitTitle = useCallback(() => {
    const current = useDocumentStore.getState().activeDocument;
    if (!current) return;
    const clean = titleDraft.trim();
    if (!clean) {
      setTitleDraft(current.title);
      return;
    }
    if (clean !== current.title) {
      useDocumentStore.getState().renameActiveDocument(clean);
    } else {
      setTitleDraft(current.title);
    }
  }, [titleDraft]);

  // Keep the one-shot shortcut table current without re-binding the listener.
  shortcutActionsRef.current = {
    addText: () => addText("body"),
    addHeading: () => addText("heading"),
    addNote: () => addText("body", { note: true }),
    addImage: () => openImagePicker("image"),
    addTable,
    addRectangle: () => addShape("rectangle"),
    addEllipse: () => addShape("ellipse"),
    addLine: () => addShape("line"),
    addHighlight,
    addSignature: () => setSignatureOpen(true),
    copy: copySelection,
    cut: cutSelection,
    paste: pasteClipboard,
    duplicate: duplicateSelection,
    remove: deleteSelection,
    selectAll,
    toggleLock,
    editText: editSelectedText,
    reorderForward: () => reorderSelection("forward"),
    reorderBackward: () => reorderSelection("backward"),
    reorderFront: () => reorderSelection("front"),
    reorderBack: () => reorderSelection("back"),
    fitPage: () => fitToPage("page"),
    fitWidth: () => fitToPage("width"),
    previousPage: () => goToAdjacentPage(-1),
    nextPage: () => goToAdjacentPage(1),
    save: () => void saveDocument(true),
    exportPdf: () => setExportOpen(true),
    exportProject: () => void handleExportProject(),
    toggleGrid,
    toggleSnap,
    nudgeLeft: () => nudgeSelection(-1, 0),
    nudgeRight: () => nudgeSelection(1, 0),
    nudgeUp: () => nudgeSelection(0, -1),
    nudgeDown: () => nudgeSelection(0, 1),
    nudgeLeftLarge: () => nudgeSelection(-10, 0),
    nudgeRightLarge: () => nudgeSelection(10, 0),
    nudgeUpLarge: () => nudgeSelection(0, -10),
    nudgeDownLarge: () => nudgeSelection(0, 10),
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dialogOpen = Boolean(
        document.querySelector('[role="dialog"][data-state="open"]'),
      );
      if (dialogOpen) return;

      const target = event.target;
      const typing = isTypingTarget(target);
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key;
      const lower = key.toLowerCase();
      const actions = shortcutActionsRef.current;

      // Save works even while the title field is focused.
      if (mod && lower === "s") {
        event.preventDefault();
        actions.save?.();
        return;
      }
      if (typing) return;

      // Zoom and fit keys work with or without the platform modifier.
      if (key === "=" || key === "+") {
        event.preventDefault();
        useEditorStore.getState().zoomIn();
        return;
      }
      if (key === "-" || key === "_") {
        event.preventDefault();
        useEditorStore.getState().zoomOut();
        return;
      }
      if (key === "0") {
        event.preventDefault();
        actions.fitPage?.();
        return;
      }
      if (key === "1") {
        event.preventDefault();
        useEditorStore.getState().setZoom(1);
        return;
      }

      if (mod) {
        if (lower === "z") {
          event.preventDefault();
          if (event.shiftKey) useDocumentStore.getState().redo();
          else useDocumentStore.getState().undo();
          return;
        }
        if (lower === "y") {
          event.preventDefault();
          useDocumentStore.getState().redo();
          return;
        }
        if (lower === "c") {
          event.preventDefault();
          actions.copy?.();
          return;
        }
        if (lower === "x") {
          event.preventDefault();
          actions.cut?.();
          return;
        }
        if (lower === "v") {
          event.preventDefault();
          actions.paste?.();
          return;
        }
        if (lower === "d") {
          event.preventDefault();
          actions.duplicate?.();
          return;
        }
        if (lower === "a") {
          event.preventDefault();
          actions.selectAll?.();
          return;
        }
        if (lower === "e") {
          event.preventDefault();
          if (event.altKey) actions.exportProject?.();
          else actions.exportPdf?.();
          return;
        }
        if (key === "]" || key === "}") {
          event.preventDefault();
          if (key === "}" || event.shiftKey) actions.reorderFront?.();
          else actions.reorderForward?.();
          return;
        }
        if (key === "[" || key === "{") {
          event.preventDefault();
          if (key === "{" || event.shiftKey) actions.reorderBack?.();
          else actions.reorderBackward?.();
          return;
        }
        return;
      }

      if (event.shiftKey && lower === "l") {
        event.preventDefault();
        actions.toggleLock?.();
        return;
      }

      switch (key) {
        case "?":
          event.preventDefault();
          useUIStore.getState().setShortcutsOpen(true);
          return;
        case "Escape":
          event.preventDefault();
          useEditorStore.getState().setTool("select");
          useEditorStore.getState().clearSelection();
          return;
        case "Delete":
        case "Backspace":
          event.preventDefault();
          actions.remove?.();
          return;
        case "Enter":
          event.preventDefault();
          actions.editText?.();
          return;
        case "PageUp":
          event.preventDefault();
          actions.previousPage?.();
          return;
        case "PageDown":
          event.preventDefault();
          actions.nextPage?.();
          return;
        case "ArrowLeft":
          event.preventDefault();
          (event.shiftKey ? actions.nudgeLeftLarge : actions.nudgeLeft)?.();
          return;
        case "ArrowRight":
          event.preventDefault();
          (event.shiftKey ? actions.nudgeRightLarge : actions.nudgeRight)?.();
          return;
        case "ArrowUp":
          event.preventDefault();
          (event.shiftKey ? actions.nudgeUpLarge : actions.nudgeUp)?.();
          return;
        case "ArrowDown":
          event.preventDefault();
          (event.shiftKey ? actions.nudgeDownLarge : actions.nudgeDown)?.();
          return;
        default:
          break;
      }

      if (lower === "v") {
        event.preventDefault();
        useEditorStore.getState().setTool("select");
        return;
      }
      if (lower === "t") {
        event.preventDefault();
        actions.addText?.();
        return;
      }
      if (lower === "h") {
        event.preventDefault();
        actions.addHeading?.();
        return;
      }
      if (lower === "n") {
        event.preventDefault();
        actions.addNote?.();
        return;
      }
      if (lower === "i") {
        event.preventDefault();
        actions.addImage?.();
        return;
      }
      if (lower === "r") {
        event.preventDefault();
        actions.addRectangle?.();
        return;
      }
      if (lower === "o") {
        event.preventDefault();
        actions.addEllipse?.();
        return;
      }
      if (lower === "l") {
        event.preventDefault();
        actions.addLine?.();
        return;
      }
      if (lower === "g") {
        event.preventDefault();
        actions.toggleGrid?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleRetry = () => {
    useDocumentStore.getState().setError(null);
    setLoadNonce((value) => value + 1);
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="flex flex-col items-center text-center animate-in-fade">
          <BrandMark size={40} />
          <Loader2 className="mt-8 size-5 animate-spin text-forge-600 dark:text-forge-300" />
          <p className="mt-4 text-[12px] font-medium">Opening your document…</p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Restoring pages and imported sources from this browser.
          </p>
        </div>
      </div>
    );
  }

  if (isMissing || !doc || doc.id !== routeId) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-7 text-center shadow-soft animate-in-up">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="display-serif mt-5 text-[28px] leading-tight">
            This document could not be opened.
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            {storeError ??
              "It may have been removed from this browser, or the link may be incomplete. Your other documents are still available."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={handleRetry} className="gap-2">
              <Loader2 className="size-4" />
              Try again
            </Button>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pageCount = doc.pages.length;
  const safePageIndex = activeIndex >= 0 ? activeIndex : 0;
  const active = doc.pages[safePageIndex];
  const zoomPercent = Math.round(zoom * 100);
  const leftToggleLabel = leftPanelOpen ? "Hide pages panel" : "Show pages panel";
  const rightToggleLabel = rightPanelOpen ? "Hide properties panel" : "Show properties panel";

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-card/85 px-2.5 backdrop-blur">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" asChild className="shrink-0">
              <Link to="/" aria-label="Back to dashboard">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to dashboard</TooltipContent>
        </Tooltip>

        <BrandMark size={26} className="hidden shrink-0 sm:grid" />

        <div className="flex min-w-0 flex-1 flex-col justify-center sm:max-w-[360px]">
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setTitleDraft(doc.title);
                event.currentTarget.blur();
              }
            }}
            maxLength={160}
            className="h-6 w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-1 text-[12.5px] font-semibold tracking-[-0.015em] outline-none transition-colors hover:border-border/70 hover:bg-card/70 focus:border-input focus:bg-card focus:ring-2 focus:ring-ring/20"
            aria-label="Document title"
          />
          <div className="flex items-center gap-1.5 px-1 text-[9.5px] text-muted-foreground/75">
            <SaveIndicator
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              autosave={autosave}
              onSave={() => void saveDocument(true)}
            />
            <span className="text-border/80">·</span>
            <span className="tabular-nums">
              Page {safePageIndex + 1} / {pageCount}
            </span>
            {editingText && (
              <>
                <span className="text-border/80">·</span>
                <span className="inline-flex items-center gap-1 text-forge-700 dark:text-forge-300">
                  <PencilLine className="size-2.5" />
                  Editing text
                </span>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto hidden items-center gap-0.5 md:flex">
          <HeaderIcon
            label="Undo (Ctrl+Z)"
            onClick={() => useDocumentStore.getState().undo()}
            disabled={!canUndo}
          >
            <Undo2 />
          </HeaderIcon>
          <HeaderIcon
            label="Redo (Ctrl+Shift+Z)"
            onClick={() => useDocumentStore.getState().redo()}
            disabled={!canRedo}
          >
            <Redo2 />
          </HeaderIcon>
          <span className="mx-1 h-5 w-px bg-border/70" />
          <HeaderIcon
            label="Zoom out"
            onClick={() => useEditorStore.getState().zoomOut()}
            disabled={zoom <= ZOOM_MIN}
          >
            <ZoomOut />
          </HeaderIcon>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => useEditorStore.getState().setZoom(1)}
                className="h-7 min-w-[52px] rounded-md px-1.5 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                aria-label="Reset zoom to 100%"
              >
                {zoomPercent}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reset to 100% (Ctrl+1)</TooltipContent>
          </Tooltip>
          <HeaderIcon
            label="Zoom in"
            onClick={() => useEditorStore.getState().zoomIn()}
            disabled={zoom >= ZOOM_MAX}
          >
            <ZoomIn />
          </HeaderIcon>
          <HeaderIcon label="Fit page (Ctrl+0)" onClick={() => fitToPage("page")}>
            <Maximize2 />
          </HeaderIcon>
        </div>

        <div className="flex flex-1 items-center justify-end gap-1">
          {!focusMode && (
            <>
              <div className="hidden items-center gap-0.5 lg:flex">
                <HeaderIcon
                  label={leftToggleLabel}
                  onClick={() => useEditorStore.getState().setLeftPanelOpen(!leftPanelOpen)}
                  active={!leftPanelOpen}
                >
                  {leftPanelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
                </HeaderIcon>
                <HeaderIcon
                  label={rightToggleLabel}
                  onClick={() => useEditorStore.getState().setRightPanelOpen(!rightPanelOpen)}
                  active={!rightPanelOpen}
                >
                  {rightPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
                </HeaderIcon>
                <span className="mx-1 h-5 w-px bg-border/70" />
              </div>
            </>
          )}

          {focusMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => useEditorStore.getState().toggleFocusMode()}
              className="gap-1.5 bg-card/70 text-[11px]"
            >
              <Minimize2 className="size-3.5" />
              <span className="hidden sm:inline">Exit focus</span>
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => useUIStore.getState().setShortcutsOpen(true)}
                className="hidden text-muted-foreground sm:inline-flex"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            onClick={() => setExportOpen(true)}
          >
            <FileOutput className="size-3.5" />
            <span>Export</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="bg-card/70"
                aria-label="More document actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Document</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void saveDocument(true)} className="gap-2">
                <Save />
                Save now
                <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
                  Ctrl S
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportOpen(true)} className="gap-2">
                <Download />
                Export PDF
                <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
                  Ctrl ⇧ E
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleExportProject()}
                className="gap-2"
              >
                <FileDown />
                Export project file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => useUIStore.getState().setShortcutsOpen(true)}
                className="gap-2"
              >
                <Keyboard />
                Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => useEditorStore.getState().toggleFocusMode()}
                className="gap-2"
              >
                <Maximize2 />
                {focusMode ? "Leave focus mode" : "Enter focus mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="gap-2">
                <Link to="/settings">
                  <Sparkles />
                  Storage & settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2">
                <Link to="/">
                  <ArrowLeft />
                  Close editor
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!focusMode && (
        <EditorToolbar
          onAddText={addText}
          onAddImage={openImagePicker}
          onAddTable={addTable}
          onAddShape={addShape}
          onAddHighlight={addHighlight}
          onAddSignature={() => setSignatureOpen(true)}
        />
      )}

      <div className="relative flex min-h-0 flex-1">
        {!focusMode && leftPanelOpen && (
          <PageSidebar className="hidden md:flex" />
        )}

        <EditorCanvas
          document={doc}
          onEditingChange={setEditingText}
          className="min-h-0"
        />

        {!focusMode && rightPanelOpen && (
          <PropertiesPanel className="hidden lg:flex" />
        )}

        {focusMode && (
          <div className="pointer-events-none absolute right-4 top-3 z-20">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-2.5 py-1 text-[9.5px] font-medium text-muted-foreground shadow-sm backdrop-blur">
              <span className="size-1.5 rounded-full bg-forge-600 dark:bg-forge-300" />
              Focus mode
            </span>
          </div>
        )}
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-2 overflow-hidden border-t border-border/70 bg-card/80 px-2.5 text-[9.5px] text-muted-foreground/80 backdrop-blur">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Local only</span>
        </span>
        <span className="text-border/80">·</span>
        <span className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5 text-muted-foreground/70"
            onClick={() => goToAdjacentPage(-1)}
            disabled={safePageIndex <= 0}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-3" />
          </Button>
          <span className="min-w-[68px] text-center tabular-nums">
            Page {safePageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5 text-muted-foreground/70"
            onClick={() => goToAdjacentPage(1)}
            disabled={safePageIndex >= pageCount - 1}
            aria-label="Next page"
          >
            <ChevronRight className="size-3" />
          </Button>
        </span>
        <span className="hidden text-border/80 sm:inline">·</span>
        <span className="hidden tabular-nums sm:inline">
          {active ? `${round(active.width, 1)} × ${round(active.height, 1)} pt` : ""}
        </span>
        <span className="hidden text-border/80 md:inline">·</span>
        <span className="hidden md:inline">
          {selectedElements.length > 0
            ? `${selectedElements.length} selected`
            : isTypingTarget(document.activeElement)
              ? "Editing"
              : "Ready"}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          {!autosave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="mr-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-amber-600 dark:text-amber-400">
                  <CloudOff className="size-3" />
                  <span className="hidden sm:inline">Autosave off</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Autosave is disabled in Settings. Use Ctrl+S or the save status to save manually.
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? "secondary" : "ghost"}
                size="icon-xs"
                className="size-5 text-muted-foreground/80"
                onClick={toggleGrid}
                aria-pressed={showGrid}
                aria-label="Toggle grid"
              >
                <Grid3X3 className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Toggle background grid</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapToGrid ? "secondary" : "ghost"}
                size="icon-xs"
                className="size-5 text-muted-foreground/80"
                onClick={toggleSnap}
                aria-pressed={snapToGrid}
                aria-label="Toggle snap to grid"
              >
                <Magnet className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Snap to grid and alignment guides is {snapToGrid ? "on" : "off"}
            </TooltipContent>
          </Tooltip>
          <span className="mx-1 h-3.5 w-px bg-border/70" />
          <span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
            {zoomPercent}%
          </span>
        </div>
      </footer>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          void handleImageFile(event.target.files?.[0] ?? null);
        }}
      />

      {preparingImage && (
        <div className="pointer-events-none fixed bottom-10 right-4 z-40 inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-[11px] text-muted-foreground shadow-lift">
          <Loader2 className="size-3.5 animate-spin" />
          Preparing image…
        </div>
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onCapture={handleSignatureCapture}
      />
      <ShortcutsDialog />
    </div>
  );
}
