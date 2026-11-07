import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type DefaultPageSize = "a4" | "a5" | "letter";

interface PreferencesState {
  theme: ThemeMode;
  defaultPageSize: DefaultPageSize;
  defaultOrientation: "portrait" | "landscape";
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  autosave: boolean;
  reduceMotion: boolean;
  setTheme: (theme: ThemeMode) => void;
  setDefaultPageSize: (size: DefaultPageSize) => void;
  setDefaultOrientation: (orientation: "portrait" | "landscape") => void;
  setShowGrid: (value: boolean) => void;
  setSnapToGrid: (value: boolean) => void;
  setGridSize: (value: number) => void;
  setAutosave: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "light",
      defaultPageSize: "a4",
      defaultOrientation: "portrait",
      showGrid: false,
      snapToGrid: true,
      gridSize: 10,
      autosave: true,
      reduceMotion: false,
      setTheme: (theme) => set({ theme }),
      setDefaultPageSize: (defaultPageSize) => set({ defaultPageSize }),
      setDefaultOrientation: (defaultOrientation) => set({ defaultOrientation }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
      setGridSize: (gridSize) => set({ gridSize }),
      setAutosave: (autosave) => set({ autosave }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    { name: "paperforge-preferences", version: 1 },
  ),
);

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
  document.documentElement.style.colorScheme = resolved;
}
