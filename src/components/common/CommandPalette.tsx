import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CornerDownLeft,
  FileText,
  Search,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DESTINATIONS, PDF_TOOL_LINKS } from "@/lib/navigation";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";
import { cn, formatRelativeDate } from "@/lib/utils";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  group: "Documents" | "Go to" | "PDF tools" | "Actions";
  icon: typeof FileText;
  run: () => void;
  keywords?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function CommandPalette() {
  const open = useUIStore((state) => state.commandOpen);
  const setOpen = useUIStore((state) => state.setCommandOpen);
  const setCreateOpen = useUIStore((state) => state.setCreateDialogOpen);
  const setImportOpen = useUIStore((state) => state.setImportDialogOpen);
  const documents = useDocumentStore((state) => state.documents);
  const initialize = useDocumentStore((state) => state.initialize);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Global shortcut: Ctrl/Cmd+K opens, and a second press closes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUIStore.getState().setCommandOpen(!useUIStore.getState().commandOpen);
        return;
      }
      if (event.key === "Escape" && useUIStore.getState().commandOpen) {
        useUIStore.getState().setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const close = () => setOpen(false);
    const go = (to: string) => {
      close();
      navigate(to);
    };

    const actions: PaletteItem[] = [
      {
        id: "action-new",
        label: "Create a new PDF",
        hint: "Blank document",
        group: "Actions",
        icon: FileText,
        keywords: "new create blank document",
        run: () => {
          close();
          window.setTimeout(() => setCreateOpen(true), 60);
        },
      },
      {
        id: "action-import",
        label: "Import an existing PDF",
        hint: "Open in the editor",
        group: "Actions",
        icon: FileText,
        keywords: "import upload open existing",
        run: () => {
          close();
          window.setTimeout(() => setImportOpen(true), 60);
        },
      },
    ];

    const destinations: PaletteItem[] = DESTINATIONS.map((destination) => ({
      id: `nav-${destination.to}`,
      label: destination.label,
      hint: destination.description,
      group: "Go to",
      icon: destination.icon,
      keywords: `${destination.label} ${destination.description}`,
      run: () => go(destination.to),
    }));

    const tools: PaletteItem[] = PDF_TOOL_LINKS.map((tool) => ({
      id: `tool-${tool.id}`,
      label: tool.label,
      hint: tool.description,
      group: "PDF tools",
      icon: FileText,
      keywords: `${tool.label} ${tool.description} tool`,
      run: () => go(`/tools?tool=${tool.id}`),
    }));

    const recentDocuments: PaletteItem[] = documents.slice(0, 8).map((document) => ({
      id: `doc-${document.id}`,
      label: document.title,
      hint: `${document.pageCount} page${document.pageCount === 1 ? "" : "s"} · ${formatRelativeDate(document.updatedAt)}`,
      group: "Documents",
      icon: FileText,
      keywords: `document pdf ${document.title}`,
      run: () => go(`/editor/${document.id}`),
    }));

    return [...actions, ...destinations, ...tools, ...recentDocuments];
  }, [documents, navigate, setCreateOpen, setImportOpen, setOpen]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    const tokens = term.split(/\s+/);
    return items.filter((item) => {
      const haystack = `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const node = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      filtered[activeIndex]?.run();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  };

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="top-[12%] max-w-[600px] translate-y-0 gap-0 overflow-hidden p-0"
        aria-label="Command palette"
      >
        <DialogTitle className="sr-only">Search Paperforge</DialogTitle>

        <div className="flex items-center gap-3 border-b border-border/70 px-4">
          <Search className="size-4 shrink-0 text-muted-foreground/70" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onListKeyDown}
            placeholder="Search documents, pages, tools…"
            aria-label="Search documents, tools and actions"
            className="h-14 w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-border/90 bg-muted/50 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground sm:block">
              Ctrl K
            </kbd>
          )}
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-[13px] font-medium">No match for “{query}”</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Try a document name, a page tool, or “new”.
              </p>
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const active = index === activeIndex;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-2.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={item.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active ? "bg-accent text-accent-foreground" : "text-foreground/85",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md",
                        active
                          ? "bg-forge-600/10 text-forge-700 dark:bg-forge-300/15 dark:text-forge-200"
                          : "bg-muted/70 text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {active ? (
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground/70" />
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 text-transparent" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-muted/25 px-3.5 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/80 bg-card px-1 py-0.5 font-mono text-[9px]">↑</kbd>
              <kbd className="rounded border border-border/80 bg-card px-1 py-0.5 font-mono text-[9px]">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/80 bg-card px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/80 bg-card px-1 py-0.5 font-mono text-[9px]">esc</kbd>
              close
            </span>
          </span>
          <span className="hidden sm:block">Paperforge search</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
