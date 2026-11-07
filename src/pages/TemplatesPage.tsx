import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  Layers,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PagePreview } from "@/components/pdf/PagePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";
import {
  TEMPLATE_DEFINITIONS,
  getTemplatePreviewPage,
  instantiateTemplate,
  type TemplateDefinition,
} from "@/templates";
import { cn } from "@/lib/utils";

function TemplatePreview({
  template,
  maxWidth = 360,
}: {
  template: TemplateDefinition;
  maxWidth?: number;
}) {
  const page = getTemplatePreviewPage(template.id);
  if (!page) return null;
  const scale = Math.min(maxWidth / page.width, 520 / page.height);
  return (
    <div className="paper-shadow overflow-hidden rounded-[2px] bg-white">
      <PagePreview page={page} width={Math.max(120, page.width * scale)} lazy={false} />
    </div>
  );
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const createFromDocument = useDocumentStore((state) => state.createFromDocument);
  const openCreateDialog = useUIStore((state) => state.setCreateDialogOpen);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [preview, setPreview] = useState<TemplateDefinition | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(TEMPLATE_DEFINITIONS.map((t) => t.category)))],
    [],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return TEMPLATE_DEFINITIONS.filter((template) => {
      if (category !== "All" && template.category !== category) return false;
      if (!term) return true;
      return (
        template.title.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [category, query]);

  const useTemplate = async (template: TemplateDefinition) => {
    setCreatingId(template.id);
    try {
      const document = instantiateTemplate(template.id);
      if (!document) throw new Error("Template unavailable");
      await createFromDocument(document);
      toast.success(`${template.title} created`);
      navigate(`/editor/${document.id}`);
    } catch {
      toast.error("This template could not be created.");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1380px] px-5 pb-20 pt-8 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="micro-label">The template library</p>
          <h1 className="display-serif mt-2 text-[44px] leading-none sm:text-[52px]">
            Begin with intention.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Eight editable documents made with considered typography and real structure. Pick a
            foundation, then make every word and colour your own.
          </p>
        </div>
        <Button variant="outline" className="h-10 bg-card/70" onClick={() => openCreateDialog(true)}>
          <Plus className="size-4" />
          Start from blank
        </Button>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-[300px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
            className="h-9 bg-card/70 pl-9 text-[12px]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                category === item
                  ? "border-forge-700/20 bg-forge-700 text-white dark:border-forge-300/20 dark:bg-forge-300 dark:text-forge-950"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-foreground/15 hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10.5px] text-muted-foreground">
          {visible.length} template{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length > 0 ? (
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((template) => {
            const page = getTemplatePreviewPage(template.id);
            const aspect = page ? page.width / page.height : 0.707;
            return (
              <article
                key={template.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lift"
              >
                <div className="relative flex h-[390px] items-center justify-center overflow-hidden border-b border-border/60 bg-[#efeee9] p-8 dark:bg-muted/25">
                  <div className="absolute inset-0 surface-grid opacity-30" />
                  <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-forge-600/[0.05] blur-2xl" />
                  <div
                    className="relative transition-transform duration-500 group-hover:-translate-y-2 group-hover:rotate-[-0.5deg]"
                    style={{ filter: "drop-shadow(0 20px 26px rgba(20,30,26,.13))" }}
                  >
                    <TemplatePreview template={template} maxWidth={300} />
                  </div>
                  <div className="absolute left-4 top-4 flex gap-1.5">
                    <span className="rounded-md border border-border/70 bg-card/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shadow-sm backdrop-blur">
                      {template.category}
                    </span>
                    {aspect > 1 && (
                      <span className="rounded-md border border-forge-600/15 bg-forge-600/[0.08] px-2 py-0.5 text-[9px] font-semibold text-forge-700 shadow-sm backdrop-blur dark:text-forge-300">
                        Landscape
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex translate-y-2 justify-center pb-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-card/90 shadow-md backdrop-blur"
                      onClick={() => setPreview(template)}
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[15px] font-semibold tracking-[-0.015em]">
                        {template.title}
                      </h2>
                      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      {template.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-5">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => void useTemplate(template)}
                      disabled={creatingId !== null}
                    >
                      {creatingId === template.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      Use template
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreview(template)}
                      className="text-muted-foreground"
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-border/80 bg-card/35 px-6 py-16 text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground/50" />
          <h2 className="display-serif mt-4 text-2xl">No template matches that.</h2>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Try another category or clear the search.
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <section className="mt-16 rounded-2xl border border-border/70 bg-card/50 p-6 sm:p-8">
        <div className="grid gap-7 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-forge-600 dark:text-forge-300" />
              <p className="micro-label">Everything is editable</p>
            </div>
            <h2 className="display-serif mt-2 text-2xl">Templates are a starting point, not a cage.</h2>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
              Text, images, tables, colours, and page structure can all be changed. You can also add
              pages, import a PDF, or sign a document before exporting a print-ready file.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            {[
              { icon: Check, text: "Vector PDF export" },
              { icon: Layers, text: "Real page structure" },
              { icon: ArrowRight, text: "Fully local" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.text} className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-forge-600 dark:text-forge-300" />
                  {item.text}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="display-serif text-2xl">{preview.title}</DialogTitle>
                <DialogDescription>{preview.description}</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center rounded-xl bg-[#efeee9] p-6 dark:bg-muted/25">
                <TemplatePreview template={preview} maxWidth={480} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1.5">
                  {preview.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted/60 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    const target = preview;
                    setPreview(null);
                    void useTemplate(target);
                  }}
                  disabled={creatingId !== null}
                >
                  {creatingId === preview.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Use this template
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
