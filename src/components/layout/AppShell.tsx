import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  HelpCircle,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  Upload,
  Plus,
} from "lucide-react";
import { Brand, BrandMark } from "@/components/common/Brand";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatRelativeDate, isTypingTarget } from "@/lib/utils";
import { DESTINATIONS } from "@/lib/navigation";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";

const nav = DESTINATIONS;

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("paperforge-sidebar") === "collapsed";
  });
  useEffect(() => {
    window.localStorage.setItem("paperforge-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

export function AppShell() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();
  const documents = useDocumentStore((state) => state.documents);
  const initialize = useDocumentStore((state) => state.initialize);
  const openCreateDialog = useUIStore((state) => state.setCreateDialogOpen);
  const openImportDialog = useUIStore((state) => state.setImportDialogOpen);
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);
  const setHelpOpen = useUIStore((state) => state.setHelpOpen);
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);
  const recent = documents.slice(0, 4);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    // Reset scroll on route changes for a predictable app feel.
    const main = document.getElementById("app-scroll");
    main?.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Global help shortcut: "?" opens the shortcut reference outside the editor.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (event.key === "?") {
        event.preventDefault();
        useUIStore.getState().setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // "G then D/T/P/H/S" navigation, mirroring the labels in the palette.
  useEffect(() => {
    let pending = false;
    let timer = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        pending = false;
        return;
      }
      if (event.key.toLowerCase() === "g") {
        pending = true;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          pending = false;
        }, 1200);
        return;
      }
      if (!pending) return;
      pending = false;
      const map: Record<string, string> = {
        d: "/",
        t: "/templates",
        p: "/tools",
        h: "/help",
        s: "/settings",
      };
      const target = map[event.key.toLowerCase()];
      if (!target) return;
      event.preventDefault();
      navigate(target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/70 bg-sidebar/80 transition-[width] duration-300 md:flex",
          collapsed ? "w-[72px]" : "w-[236px]",
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-border/60", collapsed ? "justify-center px-0" : "justify-between px-5")}>
          <Link to="/" aria-label="Paperforge home" className="flex items-center">
            {collapsed ? <BrandMark /> : <Brand />}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setCollapsed(true)}
              className="text-muted-foreground/70"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          )}
        </div>

        <div className={cn("flex flex-col gap-2 px-3 pb-2 pt-4", collapsed && "items-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => openCreateDialog(true)}
                className={cn(
                  "h-9 gap-2 bg-primary shadow-[0_1px_2px_rgba(15,23,20,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]",
                  collapsed ? "w-9 p-0" : "w-full justify-start px-3",
                )}
              >
                <Plus className="size-4" />
                {!collapsed && <span>New PDF</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">New PDF</TooltipContent>}
          </Tooltip>
          {!collapsed && (
            <Button
              variant="outline"
              onClick={() => openImportDialog(true)}
              className="h-9 w-full justify-start gap-2 border-border/80 bg-card/60 px-3 font-normal text-foreground/80"
            >
              <Upload className="size-3.5" />
              <span>Import PDF</span>
            </Button>
          )}
        </div>

        <div className={cn("px-3 pb-2", collapsed && "flex justify-center px-2")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Search documents and tools"
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-card/50 text-[12px] text-muted-foreground transition-colors hover:border-foreground/15 hover:text-foreground",
                  collapsed ? "w-9 justify-center" : "w-full px-2.5",
                )}
              >
                <Search className="size-3.5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Search…</span>
                    <kbd className="rounded border border-border/80 bg-muted/50 px-1 py-0.5 font-mono text-[8.5px] text-muted-foreground/80">
                      Ctrl K
                    </kbd>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Search</TooltipContent>}
          </Tooltip>
        </div>

        <nav className={cn("mt-4 flex flex-1 flex-col gap-0.5 px-2.5", collapsed && "items-center px-2")}>
          {!collapsed && (
            <div className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
              Workspace
            </div>
          )}
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-2.5 rounded-lg text-[12.5px] font-medium transition-colors",
                  collapsed ? "w-9 justify-center" : "w-full px-2.5",
                  isActive
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,20,0.05)] ring-1 ring-border/60"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-[15px] shrink-0" strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.to === "/tools" && (
                  <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    9
                  </span>
                )}
              </NavLink>
            );
            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}

          {!collapsed && recent.length > 0 && (
            <div className="mt-6 space-y-0.5">
              <div className="mb-1.5 px-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                Recent
              </div>
              {recent.map((document) => (
                <Link
                  key={document.id}
                  to={`/editor/${document.id}`}
                  className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
                >
                  <FileText className="mt-0.5 size-3 shrink-0 text-muted-foreground/55" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-medium text-foreground/75 group-hover:text-foreground">
                      {document.title}
                    </span>
                    <span className="mt-0.5 block text-[9.5px] text-muted-foreground/70">
                      {formatRelativeDate(document.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className={cn("border-t border-border/60 p-3", collapsed && "flex flex-col items-center")}>
          <div className={cn("mb-2 flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "xs"}
                  onClick={() => setHelpOpen(true)}
                  className={cn(
                    "gap-1.5 text-muted-foreground",
                    !collapsed && "flex-1 justify-start px-1.5",
                  )}
                  aria-label="Open quick help"
                >
                  <HelpCircle className="size-3.5" />
                  {!collapsed && <span className="text-[10.5px] font-medium">Quick help</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                Quick help and shortcuts
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShortcutsOpen(true)}
                  className="text-muted-foreground/70"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>
          </div>
          {!collapsed && (
            <div className="mb-2.5 flex items-start gap-2.5 rounded-lg border border-forge-600/10 bg-forge-600/[0.045] p-2.5 dark:bg-forge-300/[0.04]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-forge-600 dark:text-forge-300" />
              <div>
                <p className="text-[10.5px] font-medium leading-snug text-foreground/80">
                  Private by design
                </p>
                <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">
                  Everything stays in this browser.
                </p>
              </div>
            </div>
          )}
          <ThemeToggle compact={collapsed} />
          {!collapsed && (
            <div className="mt-2 flex items-center justify-between px-2 text-[9px] font-medium text-muted-foreground/55">
              <span>v{__APP_VERSION__}</span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Local storage
              </span>
            </div>
          )}
        </div>

        {collapsed && (
          <div className="border-t border-border/60 p-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="text-muted-foreground"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-lg md:hidden">
        <Link to="/" aria-label="Paperforge home">
          <Brand />
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openCreateDialog(true)}
            aria-label="New PDF"
          >
            <Plus className="size-4" />
          </Button>
          <ThemeToggle compact />
        </div>
      </header>

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300",
          collapsed ? "md:pl-[72px]" : "md:pl-[236px]",
        )}
      >
        <main id="app-scroll" className="min-h-screen">
          <Outlet />
        </main>
      </div>

      {/* Mobile navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/70 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[9px] font-medium",
                  isActive ? "text-forge-700 dark:text-forge-300" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-4" strokeWidth={1.8} />
              <span>{item.label === "PDF tools" ? "Tools" : item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}
