import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EditorTool, PaperElement } from "@/types/document";
import { clamp } from "@/lib/utils";

interface WorkspaceView {
  activePageId: string | null;
  zoom: number;
}

interface EditorState {
  tool: EditorTool;
  zoom: number;
  selectedIds: string[];
  activeDocumentId: string | null;
  activePageId: string | null;
  scrollRequest: number;
  editRequest: { elementId: string; nonce: number } | null;
  clipboard: PaperElement[];
  focusMode: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  workspace: Record<string, WorkspaceView>;
  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
  setActivePage: (pageId: string | null) => void;
  goToPage: (pageId: string) => void;
  requestScrollToPage: () => void;
  requestEdit: (elementId: string) => void;
  setClipboard: (elements: PaperElement[]) => void;
  toggleFocusMode: () => void;
  setLeftPanelOpen: (value: boolean) => void;
  setRightPanelOpen: (value: boolean) => void;
  loadDocumentView: (documentId: string, firstPageId: string | null) => void;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.5;

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      tool: "select",
      zoom: 1,
      selectedIds: [],
      activeDocumentId: null,
      activePageId: null,
      scrollRequest: 0,
      editRequest: null,
      clipboard: [],
      focusMode: false,
      leftPanelOpen: true,
      rightPanelOpen: true,
      workspace: {},

      setTool: (tool) =>
        set({
          tool,
          selectedIds: tool === "select" ? get().selectedIds : [],
        }),
      setZoom: (zoom) =>
        set((state) => {
          const next = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
          return {
            zoom: next,
            workspace: state.activeDocumentId
              ? {
                  ...state.workspace,
                  [state.activeDocumentId]: {
                    activePageId: state.activePageId,
                    zoom: next,
                  },
                }
              : state.workspace,
          };
        }),
      zoomIn: () => get().setZoom(get().zoom + 0.1),
      zoomOut: () => get().setZoom(get().zoom - 0.1),
      setSelectedIds: (selectedIds) => set({ selectedIds }),
      toggleSelectedId: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((selected) => selected !== id)
            : [...state.selectedIds, id],
        })),
      clearSelection: () => set({ selectedIds: [] }),
      setActivePage: (activePageId) =>
        set((state) => {
          const current = state.activeDocumentId
            ? state.workspace[state.activeDocumentId]
            : undefined;
          return {
            activePageId,
            selectedIds:
              activePageId === state.activePageId ? state.selectedIds : [],
            workspace:
              state.activeDocumentId && current
                ? {
                    ...state.workspace,
                    [state.activeDocumentId]: {
                      ...current,
                      activePageId,
                    },
                  }
                : state.workspace,
          };
        }),
      goToPage: (pageId) =>
        set((state) => {
          const current = state.activeDocumentId
            ? state.workspace[state.activeDocumentId]
            : undefined;
          return {
            activePageId: pageId,
            selectedIds: [],
            workspace:
              state.activeDocumentId && current
                ? {
                    ...state.workspace,
                    [state.activeDocumentId]: {
                      ...current,
                      activePageId: pageId,
                    },
                  }
                : state.workspace,
            scrollRequest: state.scrollRequest + 1,
          };
        }),
      requestScrollToPage: () =>
        set((state) => ({ scrollRequest: state.scrollRequest + 1 })),
      requestEdit: (elementId) =>
        set((state) => ({
          editRequest: { elementId, nonce: (state.editRequest?.nonce ?? 0) + 1 },
        })),
      setClipboard: (clipboard) => set({ clipboard }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),

      loadDocumentView: (documentId, firstPageId) =>
        set((state) => {
          const existing = state.workspace[documentId];
          const activePageId = existing?.activePageId ?? firstPageId;
          return {
            activeDocumentId: documentId,
            activePageId,
            selectedIds: [],
            tool: "select",
            zoom: existing?.zoom ?? 1,
            workspace: {
              ...state.workspace,
              [documentId]: {
                activePageId: activePageId ?? firstPageId,
                zoom: existing?.zoom ?? 1,
              },
            },
            scrollRequest: state.scrollRequest + 1,
          };
        }),
    }),
    {
      name: "paperforge-editor",
      version: 1,
      partialize: (state) => ({
        workspace: state.workspace,
        focusMode: state.focusMode,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    },
  ),
);
