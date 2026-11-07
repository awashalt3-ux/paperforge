import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  FilePlus2,
  FileText,
  FolderArchive,
  Grid2X2,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import type { DocumentSummary } from "@/types/document";
import { DocumentCard } from "@/components/pdf/DocumentCard";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PagePreview } from "@/components/pdf/PagePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";
import { TEMPLATE_DEFINITIONS, getTemplatePreviewPage, instantiateTemplate } from "@/templates";
import { importProjectFile } from "@/services/projects";
import { cn, formatRelativeDate } from "@/lib/utils";

type Filter = "all" | "templates" | "blank";
type Sort = "recent" | "name" | "pages";

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function RenameDocumentDialog({
  document,
  onClose,
}: {
  document: DocumentSummary | null;
  onClose: () => void;
}) {
  const renameDocument = useDocumentStore((state) => state.renameDocument);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (document) setTitle(document.title);
  }, [document]);

  const submit = async () => {
    if (!document || !title.trim()) return;
    setBusy(true);
    try {
      await renameDocument(document.id, title);
      toast.success("Document renamed");
      onClose();
    } catch {
      toast.error("Could not rename this document.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename document</DialogTitle>
          <DialogDescription>Give this PDF a name you&apos;ll recognise later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rename-document">Document name</Label>
          <Input
            id="rename-document"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !title.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateStrip() {
  const navigate = useNavigate();
  const createFromDocument = useDocumentStore((state) => state.createFromDocument);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const useTemplate = async (templateId: string) => {
    setCreatingId(templateId);
    try {
      const document = instantiateTemplate(templateId);
      if (!document) throw new Error("Template unavailable");
      await createFromDocument(document);
      toast.success("Template ready to edit");
      navigate(`/editor/${document.id}`);
    } catch {
      toast.error("This template could not be created.");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="micro-label">Start with a foundation</p>
          <h2 className="display-serif mt-1.5 text-[26px]">A considered head start.</h2>
        </div>
        <Button variant="ghost" size="sm" asChild className="hidden text-muted-foreground sm:flex">
          <Link to="/templates">
            Browse all templates
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TEMPLATE_DEFINITIONS.slice(0, 4).map((template) => {
          const preview = getTemplatePreviewPage(template.id);
          if (!preview) return null;
          const previewWidth = preview.width > preview.height ? 172 : 94;
          return (
            <div
              key={template.id}
              className="group flex min-h-[226px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift"
            >
              <div className="relative flex h-[148px] items-center justify-center overflow-hidden border-b border-border/60 bg-[#f3f1ec] dark:bg-muted/25">
                <div className="absolute inset-0 surface-grid opacity-40" />
                <div className="relative transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-0.4deg]">
                  <div className="paper-shadow overflow-hidden rounded-[2px] bg-white">
                    <PagePreview page={preview} width={previewWidth} lazy={false} />
                  </div>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium">{template.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{template.category}</p>
                </div>
                <Button
                  size="xs"
                  variant="soft"
                  disabled={creatingId !== null}
                  onClick={() => void useTemplate(template.id)}
                >
                  {creatingId === template.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Use
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const documents = useDocumentStore((state) => state.documents);
  const initialized = useDocumentStore((state) => state.initialized);
  const isLoading = useDocumentStore((state) => state.isLoading);
  const deleteDocument = useDocumentStore((state) => state.deleteDocument);
  const refreshDocuments = useDocumentStore((state) => state.refreshDocuments);
  const openCreateDialog = useUIStore((state) => state.setCreateDialogOpen);
  const openImportDialog = useUIStore((state) => state.setImportDialogOpen);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem("paperforge-view") === "list" ? "list" : "grid";
  });
  const [renameTarget, setRenameTarget] = useState<DocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importingProject, setImportingProject] = useState(false);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem("paperforge-view", view);
  }, [view]);

  const pages = useMemo(
    () => documents.reduce((total, document) => total + document.pageCount, 0),
    [documents],
  );
  const templateDocuments = useMemo(
    () => documents.filter((document) => document.templateId).length,
    [documents],
  );

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = documents.filter((document) => {
      if (filter === "templates" && !document.templateId) return false;
      if (filter === "blank" && document.templateId) return false;
      if (normalized && !document.title.toLowerCase().includes(normalized)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "pages") return b.pageCount - a.pageCount;
      return b.updatedAt - a.updatedAt;
    });
  }, [documents, filter, query, sort]);

  const handleImportProject = async (file: File | null) => {
    if (!file) return;
    setImportingProject(true);
    try {
      const document = await importProjectFile(file);
      await refreshDocuments();
      toast.success("Project imported");
      navigate(`/editor/${document.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The project could not be imported.");
    } finally {
      setImportingProject(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] px-5 pb-20 pt-7 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="animate-in-up">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.11)]" />
            Local workspace
            <span className="text-border">/</span>
            {timeGreeting()}
          </div>
          <h1 className="display-serif mt-3 text-[44px] leading-[0.98] sm:text-[54px]">
            Make paper
            <br />
            feel <span className="italic text-forge-700 dark:text-forge-300">alive.</span>
          </h1>
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
            Design a new document, shape an existing PDF, or start from a template. Everything is
            processed and saved on this device.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 animate-in-up delay-1">
          <Button variant="outline" className="h-10 bg-card/70" onClick={() => openImportDialog(true)}>
            <Upload className="size-4" />
            Import PDF
          </Button>
          <Button className="h-10" onClick={() => openCreateDialog(true)}>
            <Plus className="size-4" />
            New document
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 bg-card/70">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More document actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => openCreateDialog(true)}
                className="gap-2"
              >
                <FilePlus2 />
                Blank PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openImportDialog(true)} className="gap-2">
                <UploadCloud />
                Import PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => projectInputRef.current?.click()}
                disabled={importingProject}
                className="gap-2"
              >
                {importingProject ? <Loader2 className="animate-spin" /> : <FolderArchive />}
                Import project file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/tools" className="gap-2">
                  <Sparkles />
                  Open PDF tools
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="gap-2">
                  <ShieldCheck />
                  Storage & settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={projectInputRef}
            type="file"
            accept=".json,.paperforge,application/json"
            className="hidden"
            onChange={(event) => {
              void handleImportProject(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </header>

      <section className="mt-9 grid gap-3 sm:grid-cols-3 lg:max-w-[760px] animate-in-up delay-2">
        {[
          {
            label: "Documents",
            value: documents.length,
            detail: `${templateDocuments} from templates`,
            icon: FileText,
          },
          {
            label: "Pages forged",
            value: pages,
            detail: "Stored locally",
            icon: LayoutList,
          },
          {
            label: "Private workspace",
            value: "100%",
            detail: "On-device processing",
            icon: ShieldCheck,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3.5"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-muted/65 text-muted-foreground">
                <Icon className="size-4" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold tracking-tight">{stat.value}</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">{stat.detail}</p>
              </div>
            </div>
          );
        })}
      </section>

      <TemplateStrip />

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="micro-label">The shelf</p>
            <h2 className="display-serif mt-1.5 text-[26px]">Your documents</h2>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-[11px]">
                  All
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-[11px]">
                  Templates
                </TabsTrigger>
                <TabsTrigger value="blank" className="text-[11px]">
                  Built from scratch
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] flex-1 sm:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents"
              className="h-9 bg-card/60 pl-9 text-[12px]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 bg-card/60 text-muted-foreground">
                <Clock3 className="size-3.5" />
                {sort === "recent" ? "Recently edited" : sort === "name" ? "Name" : "Page count"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSort("recent")}>Recently edited</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("name")}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("pages")}>Page count</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-border/70 bg-card/60 p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              <Grid2X2 className="size-3.5" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setView("list")}
              aria-label="List view"
            >
              <LayoutList className="size-3.5" />
            </Button>
          </div>
        </div>

        {!initialized || (isLoading && documents.length === 0) ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[286px] animate-pulse rounded-xl border border-border/60 bg-card/50"
              />
            ))}
          </div>
        ) : visibleDocuments.length > 0 ? (
          view === "grid" ? (
            <div className={cn("mt-5 grid gap-3", "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4")}>
              {visibleDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  view="grid"
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-card/40 p-1">
              {visibleDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  view="list"
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border/80 bg-card/35 px-6 py-14 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
              <FileText className="size-5" />
            </div>
            <h3 className="display-serif mt-4 text-2xl">
              {documents.length === 0 ? "The shelf is waiting." : "No documents found."}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
              {documents.length === 0
                ? "Start with a blank page, bring in an existing PDF, or choose a template above."
                : "Try a different search term or filter. Your other documents are still here."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {documents.length === 0 ? (
                <>
                  <Button variant="outline" onClick={() => openImportDialog(true)}>
                    <UploadCloud className="size-4" />
                    Import PDF
                  </Button>
                  <Button onClick={() => openCreateDialog(true)}>
                    <Plus className="size-4" />
                    New document
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-16 overflow-hidden rounded-2xl border border-forge-900/10 bg-[#193b33] px-6 py-7 text-[#e9f2ee] shadow-soft sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#8cc7b8] ring-1 ring-white/10">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em]">
                Your work never leaves this browser.
              </p>
              <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-[#a9c8c0]">
                Documents, imported PDFs, and signatures are stored in IndexedDB on this device.
                No account, no upload, no cloud processing.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-white/15 bg-white/[0.06] text-[#e9f2ee] hover:border-white/25 hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to="/settings">
              Manage local data
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      <RenameDocumentDialog document={renameTarget} onClose={() => setRenameTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this document?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” and any imported PDF pages it uses will be permanently removed from this browser. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete document"
        destructive
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await deleteDocument(deleteTarget.id);
            toast.success("Document deleted");
            setDeleteTarget(null);
          } catch {
            toast.error("The document could not be deleted.");
          } finally {
            setDeleting(false);
          }
        }}
      />

    </div>
  );
}
