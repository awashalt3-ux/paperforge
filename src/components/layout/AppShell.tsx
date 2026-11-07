import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
  Upload,
  Wrench,
  Plus,
} from "lucide-react";
import { Brand, BrandMark } from "@/components/common/Brand";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/tools", label: "PDF tools", icon: Wrench },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

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
  const documents = useDocumentStore((state) => state.documents);
  const initialize = useDocumentStore((state) => state.initialize);
  const openCreateDialog = useUIStore((state) => state.setCreateDialogOpen);
  const openImportDialog = useUIStore((state) => state.setImportDialogOpen);
  const recent = documents.slice(0, 4);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    // Reset scroll on route changes for a predictable app feel.
    const main = document.getElementById("app-scroll");
    main?.scrollTo({ top: 0 });
  }, [location.pathname]);

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

        <nav className={cn("mt-4 flex flex-1 flex-col gap-0.5 px-2.5", collapsed && "items-center px-2")}>
          {!collapsed && (
            <div className="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
              Workspace
            </div>
          )}
          {nav.map((item) => {
            const Icon = item.icon;
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "group flex h-9 items-center gap-2.5 rounded-lg text-[12.5px] font-medium transition-colors",
                    collapsed ? "w-9 justify-center" : "w-full px-2.5",
                    isActive
                      ? "bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,20,0.05)] ring-1 ring-border/60"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )
                }
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
              <span>v1.0</span>
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
