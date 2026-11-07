import { create } from "zustand";
import type {
  DocumentSummary,
  PaperDocument,
  PaperElement,
  PaperPage,
  PageSourceRef,
  PdfMetadata,
  StoredPdfAsset,
} from "@/types/document";
import {
  deleteDocumentCascade,
  duplicateDocumentRecord,
  getDocument,
  listDocumentSummaries,
  putDocument,
  putPdfAsset,
  updateDocumentThumbnail,
  db,
} from "@/db/database";
import {
  createBlankDocument,
  createBlankPage,
  createMetadata,
  duplicatePage as duplicatePageFactory,
  type CreateDocumentOptions,
} from "@/utils/documentFactory";
import { createDocumentId } from "@/utils/id";
import { paperDocumentSchema } from "@/utils/validation";
import { createId } from "@/utils/id";
import { usePreferencesStore } from "@/store/preferencesStore";

export type SaveStatus = "idle" | "saved" | "saving" | "unsaved" | "error";

export interface CommitOptions {
  history?: boolean;
  historyKey?: string;
}

export type ElementUpdate = {
  id: string;
  patch: Partial<PaperElement>;
};

interface DocumentState {
  documents: DocumentSummary[];
  activeDocument: PaperDocument | null;
  historyPast: PaperDocument[];
  historyFuture: PaperDocument[];
  initialized: boolean;
  isLoading: boolean;
  isImporting: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  error: string | null;

  initialize: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  createDocument: (options: CreateDocumentOptions) => Promise<PaperDocument>;
  createFromDocument: (
    document: PaperDocument,
    assets?: StoredPdfAsset[],
  ) => Promise<PaperDocument>;
  openDocument: (id: string) => Promise<PaperDocument | null>;
  closeDocument: () => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  duplicateDocument: (id: string) => Promise<PaperDocument | null>;
  renameDocument: (id: string, title: string) => Promise<void>;
  renameActiveDocument: (title: string) => void;
  setThumbnail: (id: string, thumbnail: string) => Promise<void>;
  setError: (error: string | null) => void;
  setImporting: (value: boolean) => void;
  saveNow: () => Promise<void>;

  undo: () => void;
  redo: () => void;

  updateActive: (
    updater: (document: PaperDocument) => PaperDocument,
    options?: CommitOptions,
  ) => void;
  updateElement: <T extends PaperElement>(
    id: string,
    patch: Partial<T>,
    options?: CommitOptions,
  ) => void;
  updateElements: (updates: ElementUpdate[], options?: CommitOptions) => void;
  addElement: (pageId: string, element: PaperElement, options?: CommitOptions) => void;
  addElements: (pageId: string, elements: PaperElement[], options?: CommitOptions) => void;
  deleteElements: (ids: string[]) => void;
  reorderElements: (
    ids: string[],
    action: "forward" | "backward" | "front" | "back",
  ) => void;
  setElementsLocked: (ids: string[], locked: boolean) => void;

  addPage: (afterPageId?: string, width?: number, height?: number) => PaperPage | null;
  duplicatePage: (pageId: string) => PaperPage | null;
  deletePage: (pageId: string) => boolean;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  updatePage: (pageId: string, patch: Partial<Omit<PaperPage, "elements">>) => void;
  replacePage: (pageId: string, page: PaperPage, options?: CommitOptions) => void;
  setPageSource: (pageId: string, source?: PageSourceRef) => void;
  setMetadata: (patch: Partial<PdfMetadata>) => void;
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastHistoryKey: string | null = null;
let lastHistoryAt = 0;
const HISTORY_LIMIT = 60;
const AUTOSAVE_DELAY = 500;

function cloneDocument(document: PaperDocument): PaperDocument {
  return structuredClone(document);
}

function summarize(document: PaperDocument): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    pageCount: document.pages.length,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    thumbnail: document.thumbnail,
    templateId: document.templateId,
  };
}

function mergeSummary(
  summaries: DocumentSummary[],
  document: PaperDocument,
): DocumentSummary[] {
  const next = summaries.filter((item) => item.id !== document.id);
  next.push(summarize(document));
  return next.sort((a, b) => b.updatedAt - a.updatedAt);
}

function shouldPushHistory(
  previous: PaperDocument,
  past: PaperDocument[],
  options: CommitOptions,
): PaperDocument[] {
  if (options.history === false) return past;
  const now = Date.now();
  const key = options.historyKey;
  const coalesce =
    key !== undefined && key === lastHistoryKey && now - lastHistoryAt < 900;
  lastHistoryKey = key ?? null;
  lastHistoryAt = now;
  if (coalesce) return past;
  return [...past, cloneDocument(previous)].slice(-HISTORY_LIMIT);
}

function scheduleSave(get: () => DocumentState, set: (partial: Partial<DocumentState>) => void): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = null;
  set({ saveStatus: "unsaved" });
  if (!usePreferencesStore.getState().autosave) return;
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void persistActive(get, set);
  }, AUTOSAVE_DELAY);
}

async function persistActive(
  get: () => DocumentState,
  set: (partial: Partial<DocumentState>) => void,
): Promise<void> {
  const document = get().activeDocument;
  if (!document) return;
  const snapshot = cloneDocument(document);
  set({ saveStatus: "saving" });
  try {
    await putDocument(snapshot);
    const latest = get().activeDocument;
    if (latest?.id === snapshot.id) {
      set({
        saveStatus: latest.updatedAt === snapshot.updatedAt ? "saved" : "unsaved",
        lastSavedAt: Date.now(),
        documents: mergeSummary(get().documents, latest),
      });
    }
  } catch (error) {
    set({
      saveStatus: "error",
      error: error instanceof Error ? error.message : "Autosave failed.",
    });
  }
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocument: null,
  historyPast: [],
  historyFuture: [],
  initialized: false,
  isLoading: false,
  isImporting: false,
  saveStatus: "idle",
  lastSavedAt: null,
  error: null,

  initialize: async () => {
    if (get().initialized) return;
    try {
      const documents = await listDocumentSummaries();
      set({ documents, initialized: true, error: null });
    } catch (error) {
      set({
        initialized: true,
        error:
          error instanceof Error
            ? `Paperforge could not open local storage: ${error.message}`
            : "Paperforge could not open local storage.",
      });
    }
  },

  refreshDocuments: async () => {
    try {
      const documents = await listDocumentSummaries();
      set({ documents });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not load documents." });
    }
  },

  createDocument: async (options) => {
    const document = createBlankDocument(options);
    await putDocument(document);
    set((state) => ({
      documents: mergeSummary(state.documents, document),
      activeDocument: document,
      historyPast: [],
      historyFuture: [],
      saveStatus: "saved",
      error: null,
    }));
    return document;
  },

  createFromDocument: async (document, assets = []) => {
    await db.transaction("rw", db.documents, db.pdfAssets, async () => {
      await db.documents.put(document);
      for (const asset of assets) {
        await db.pdfAssets.put(asset);
      }
    });
    set((state) => ({
      documents: mergeSummary(state.documents, document),
      activeDocument: document,
      historyPast: [],
      historyFuture: [],
      saveStatus: "saved",
      error: null,
    }));
    return document;
  },

  openDocument: async (id) => {
    if (get().activeDocument?.id === id) return get().activeDocument;
    await get().saveNow();
    set({ isLoading: true, error: null });
    try {
      const record = await getDocument(id);
      if (!record) {
        set({ isLoading: false, error: "This document no longer exists." });
        return null;
      }
      const parsed = paperDocumentSchema.safeParse(record);
      if (!parsed.success) {
        set({
          isLoading: false,
          error: "This document is damaged and could not be opened safely.",
        });
        return null;
      }
      const document = parsed.data as PaperDocument;
      lastHistoryKey = null;
      lastHistoryAt = 0;
      set({
        activeDocument: document,
        historyPast: [],
        historyFuture: [],
        isLoading: false,
        saveStatus: "saved",
        lastSavedAt: document.updatedAt,
      });
      return document;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Could not open the document.",
      });
      return null;
    }
  },

  closeDocument: async () => {
    await get().saveNow();
    set({ activeDocument: null, historyPast: [], historyFuture: [] });
  },

  deleteDocument: async (id) => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    await deleteDocumentCascade(id);
    set((state) => ({
      documents: state.documents.filter((document) => document.id !== id),
      activeDocument:
        state.activeDocument?.id === id ? null : state.activeDocument,
      error: null,
    }));
  },

  duplicateDocument: async (id) => {
    const source = get().documents.find((document) => document.id === id);
    const newId = createDocumentId();
    const title = `${source?.title ?? "Untitled"} (copy)`;
    const copy = await duplicateDocumentRecord(id, newId, title);
    if (copy) {
      set((state) => ({ documents: mergeSummary(state.documents, copy) }));
    }
    return copy;
  },

  renameDocument: async (id, title) => {
    const clean = title.trim();
    if (!clean) return;
    const now = Date.now();
    await db.documents.update(id, { title: clean, updatedAt: now });
    set((state) => {
      const active =
        state.activeDocument?.id === id
          ? {
              ...state.activeDocument,
              title: clean,
              updatedAt: now,
              metadata: { ...state.activeDocument.metadata, title: clean },
            }
          : state.activeDocument;
      return {
        activeDocument: active,
        documents: state.documents
          .map((document) =>
            document.id === id ? { ...document, title: clean, updatedAt: now } : document,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      };
    });
  },

  renameActiveDocument: (title) => {
    const clean = title.trim();
    if (!clean) return;
    get().updateActive(
      (document) => ({
        ...document,
        title: clean,
        metadata: { ...document.metadata, title: clean },
      }),
      { historyKey: "rename-document" },
    );
  },

  setThumbnail: async (id, thumbnail) => {
    if (!thumbnail) return;
    await updateDocumentThumbnail(id, thumbnail);
    set((state) => ({
      documents: state.documents.map((document) =>
        document.id === id ? { ...document, thumbnail } : document,
      ),
      activeDocument:
        state.activeDocument?.id === id
          ? { ...state.activeDocument, thumbnail }
          : state.activeDocument,
    }));
  },

  setError: (error) => set({ error }),
  setImporting: (value) => set({ isImporting: value }),

  saveNow: async () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    await persistActive(get, set);
  },

  undo: () => {
    const { historyPast, activeDocument, historyFuture } = get();
    if (!activeDocument || historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    lastHistoryKey = null;
    set({
      activeDocument: previous,
      historyPast: historyPast.slice(0, -1),
      historyFuture: [cloneDocument(activeDocument), ...historyFuture].slice(0, HISTORY_LIMIT),
      documents: mergeSummary(get().documents, previous),
      saveStatus: "unsaved",
    });
    scheduleSave(get, set);
  },

  redo: () => {
    const { historyFuture, activeDocument, historyPast } = get();
    if (!activeDocument || historyFuture.length === 0) return;
    const next = historyFuture[0];
    lastHistoryKey = null;
    set({
      activeDocument: next,
      historyPast: [...historyPast, cloneDocument(activeDocument)].slice(-HISTORY_LIMIT),
      historyFuture: historyFuture.slice(1),
      documents: mergeSummary(get().documents, next),
      saveStatus: "unsaved",
    });
    scheduleSave(get, set);
  },

  updateActive: (updater, options = {}) => {
    const previous = get().activeDocument;
    if (!previous) return;
    const draft = cloneDocument(previous);
    const next = updater(draft);
    next.updatedAt = Date.now();
    if (next.pages.length === 0) return;
    const past = shouldPushHistory(previous, get().historyPast, options);
    set({
      activeDocument: next,
      historyPast: past,
      historyFuture: options.history === false ? get().historyFuture : [],
      documents: mergeSummary(get().documents, next),
      error: null,
    });
    scheduleSave(get, set);
  },

  updateElement: (id, patch, options) => {
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.elements.some((element) => element.id === id)
            ? {
                ...page,
                elements: page.elements.map((element) =>
                  element.id === id
                    ? ({ ...element, ...patch } as PaperElement)
                    : element,
                ),
              }
            : page,
        ),
      }),
      options ?? { historyKey: `element-${id}` },
    );
  },

  updateElements: (updates, options) => {
    if (updates.length === 0) return;
    const map = new Map(updates.map((update) => [update.id, update.patch]));
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) => ({
          ...page,
          elements: page.elements.map((element) => {
            const patch = map.get(element.id);
            return patch ? ({ ...element, ...patch } as PaperElement) : element;
          }),
        })),
      }),
      options ?? { historyKey: `elements-${updates.map((u) => u.id).join("-")}` },
    );
  },

  addElement: (pageId, element, options) => {
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.id === pageId ? { ...page, elements: [...page.elements, element] } : page,
        ),
      }),
      options ?? { historyKey: `add-${element.id}` },
    );
  },

  addElements: (pageId, elements, options) => {
    if (elements.length === 0) return;
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.id === pageId ? { ...page, elements: [...page.elements, ...elements] } : page,
        ),
      }),
      options ?? { historyKey: `add-many-${pageId}` },
    );
  },

  deleteElements: (ids) => {
    if (ids.length === 0) return;
    const setIds = new Set(ids);
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) => ({
          ...page,
          elements: page.elements.filter((element) => !setIds.has(element.id)),
        })),
      }),
      { historyKey: `delete-${ids.join("-")}` },
    );
  },

  reorderElements: (ids, action) => {
    if (ids.length === 0) return;
    const setIds = new Set(ids);
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) => {
          if (!page.elements.some((element) => setIds.has(element.id))) return page;
          const elements = [...page.elements];
          if (action === "front") {
            const moved = elements.filter((el) => setIds.has(el.id));
            const rest = elements.filter((el) => !setIds.has(el.id));
            return { ...page, elements: [...rest, ...moved] };
          }
          if (action === "back") {
            const moved = elements.filter((el) => setIds.has(el.id));
            const rest = elements.filter((el) => !setIds.has(el.id));
            return { ...page, elements: [...moved, ...rest] };
          }
          if (action === "forward") {
            for (let index = elements.length - 2; index >= 0; index -= 1) {
              if (setIds.has(elements[index].id) && !setIds.has(elements[index + 1].id)) {
                [elements[index], elements[index + 1]] = [elements[index + 1], elements[index]];
              }
            }
            return { ...page, elements };
          }
          for (let index = 1; index < elements.length; index += 1) {
            if (setIds.has(elements[index].id) && !setIds.has(elements[index - 1].id)) {
              [elements[index], elements[index - 1]] = [elements[index - 1], elements[index]];
            }
          }
          return { ...page, elements };
        }),
      }),
      { historyKey: `reorder-${ids.join("-")}` },
    );
  },

  setElementsLocked: (ids, locked) => {
    const setIds = new Set(ids);
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) => ({
          ...page,
          elements: page.elements.map((element) =>
            setIds.has(element.id) ? { ...element, locked } : element,
          ),
        })),
      }),
      { historyKey: `lock-${ids.join("-")}` },
    );
  },

  addPage: (afterPageId, width, height) => {
    const current = get().activeDocument;
    if (!current) return null;
    const reference =
      current.pages.find((page) => page.id === afterPageId) ??
      current.pages[current.pages.length - 1];
    const page = createBlankPage(
      width ?? reference?.width ?? 595.28,
      height ?? reference?.height ?? 841.89,
      reference?.background ?? "#ffffff",
    );
    get().updateActive(
      (document) => {
        const index = document.pages.findIndex((item) => item.id === reference?.id);
        const insertAt = index >= 0 ? index + 1 : document.pages.length;
        const pages = [...document.pages];
        pages.splice(insertAt, 0, page);
        return { ...document, pages };
      },
      { historyKey: `add-page-${page.id}` },
    );
    return page;
  },

  duplicatePage: (pageId) => {
    const document = get().activeDocument;
    const source = document?.pages.find((page) => page.id === pageId);
    if (!source) return null;
    const page = duplicatePageFactory(source, true);
    get().updateActive(
      (draft) => {
        const index = draft.pages.findIndex((item) => item.id === pageId);
        const pages = [...draft.pages];
        pages.splice(index + 1, 0, page);
        return { ...draft, pages };
      },
      { historyKey: `duplicate-page-${page.id}` },
    );
    return page;
  },

  deletePage: (pageId) => {
    const document = get().activeDocument;
    if (!document || document.pages.length <= 1) return false;
    if (!document.pages.some((page) => page.id === pageId)) return false;
    get().updateActive(
      (draft) => ({
        ...draft,
        pages: draft.pages.filter((page) => page.id !== pageId),
      }),
      { historyKey: `delete-page-${pageId}` },
    );
    return true;
  },

  reorderPages: (fromIndex, toIndex) => {
    const document = get().activeDocument;
    if (
      !document ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= document.pages.length ||
      toIndex >= document.pages.length
    ) {
      return;
    }
    get().updateActive(
      (draft) => {
        const pages = [...draft.pages];
        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved);
        return { ...draft, pages };
      },
      { historyKey: `reorder-pages-${fromIndex}-${toIndex}` },
    );
  },

  updatePage: (pageId, patch) => {
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((page) =>
          page.id === pageId ? { ...page, ...patch } : page,
        ),
      }),
      { historyKey: `page-${pageId}-${Object.keys(patch).join("-")}` },
    );
  },

  replacePage: (pageId, page, options) => {
    get().updateActive(
      (document) => ({
        ...document,
        pages: document.pages.map((current) => (current.id === pageId ? page : current)),
      }),
      options ?? { historyKey: `replace-page-${pageId}` },
    );
  },

  setPageSource: (pageId, source) => {
    get().updatePage(pageId, { source });
  },

  setMetadata: (patch) => {
    get().updateActive(
      (document) => ({
        ...document,
        metadata: { ...document.metadata, ...patch },
      }),
      { historyKey: `metadata-${Object.keys(patch).join("-")}` },
    );
  },
}));

// Save the working document if the tab is being hidden or closed.
if (typeof window !== "undefined") {
  const flush = () => {
    const state = useDocumentStore.getState();
    if (state.activeDocument) {
      void state.saveNow();
    }
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

export function createImportedDocument(title: string, pages: PaperPage[]): PaperDocument {
  const now = Date.now();
  return {
    id: createDocumentId(),
    title,
    pages,
    createdAt: now,
    updatedAt: now,
    metadata: createMetadata(title),
  };
}

export function makePdfAsset(
  documentId: string,
  name: string,
  bytes: ArrayBuffer,
  pageCount: number,
  mimeType = "application/pdf",
): StoredPdfAsset {
  return {
    id: createId("asset"),
    documentId,
    name,
    mimeType,
    bytes,
    pageCount,
    createdAt: Date.now(),
  };
}
