import { create } from "zustand";

interface UIState {
  createDialogOpen: boolean;
  importDialogOpen: boolean;
  shortcutsOpen: boolean;
  commandOpen: boolean;
  helpOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  setImportDialogOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  createDialogOpen: false,
  importDialogOpen: false,
  shortcutsOpen: false,
  commandOpen: false,
  helpOpen: false,
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),
  setImportDialogOpen: (importDialogOpen) => set({ importDialogOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
