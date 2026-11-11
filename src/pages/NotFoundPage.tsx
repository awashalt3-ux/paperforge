import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Command,
  FileText,
  Home,
  LayoutTemplate,
  LifeBuoy,
  Search,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { DESTINATIONS } from "@/lib/navigation";
import { useDocumentStore } from "@/store/documentStore";
import { useUIStore } from "@/store/uiStore";
import { cn, formatRelativeDate } from "@/lib/utils";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Animated dashed path with a travelling dot, purely decorative. */
function ForgeMotif({ animate }: { animate: boolean }) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden
      className="absolute inset-0 size-full text-forge-300/45 dark:text-forge-400/35"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="4 6"
        className={animate ? "animate-forge-dash" : undefined}
      >
        <circle cx="100" cy="100" r="72" opacity="0.5" />
        <circle cx="100" cy="100" r="52" opacity="0.32" />
        <path d="M28 100h34M138 100h34M100 28v34M100 138v34" opacity="0.45" />
      </g>
      <g stroke="currentColor" strokeWidth="0.75" opacity="0.22">
        <path d="M100 16v168M16 100h168" strokeDasharray="2 10" />
      </g>
    </svg>
  );
}

export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const initialize = useDocumentStore((state) => state.initialize);
  const documents = useDocumentStore((state) => state.documents);
  const setCommandOpen = useUIStore((state) => state.setCommandOpen);
  const setCreateOpen = useUIStore((state) => state.setCreateDialogOpen);
  const setImportOpen = useUIStore((state) => state.setImportDialogOpen);
  const [query, setQuery] = useState("");
  const animate = !reducedMotion;

  useDocumentTitle("Page introuvable 404");

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const recent = useMemo(() => documents.slice(0, 3), [documents]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return documents
      .filter((document) => document.title.toLowerCase().includes(term))
      .slice(0, 4);
  }, [documents, query]);

  const requestedPath = `${location.pathname}${location.search}`;

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-5 pb-28 pt-10 sm:px-8 md:pb-12">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 surface-grid opacity-35" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-28 top-8 size-[22rem] rounded-full bg-forge-600/10 blur-[80px] dark:bg-forge-400/10",
          animate && "animate-forge-drift",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-24 bottom-0 size-[26rem] rounded-full bg-forge-500/[0.07] blur-[90px] dark:bg-forge-300/[0.06]",
          animate && "animate-forge-drift [animation-delay:2.5s]",
        )}
      />

      <div className="relative w-full max-w-[1040px]">
        {/* Breadcrumb trail */}
        <div className="mb-5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground/80 animate-in-fade">
          <Link to="/" className="transition-colors hover:text-foreground">
            Workspace
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {requestedPath.length > 52 ? `${requestedPath.slice(0, 52)}…` : requestedPath}
          </span>
        </div>

        <div className="grid overflow-hidden rounded-3xl border border-border/70 bg-card/85 shadow-lift backdrop-blur md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {/* Left: the forge panel */}
          <section className="relative flex flex-col justify-between gap-9 overflow-hidden bg-gradient-to-br from-forge-800 via-forge-700 to-forge-900 p-8 text-forge-50 sm:p-9">
            <ForgeMotif animate={animate} />
            <div className="relative flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Command className="size-4" />
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-forge-200/85">
                Paperforge
              </span>
            </div>

            <div className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-forge-200/70">
                Erreur 404
              </p>
              <p
                className={cn(
                  "display-serif mt-2 select-none text-[92px] leading-[0.82] tracking-[-0.05em] text-white/95",
                  animate && "animate-forge-pop",
                )}
              >
                404
              </p>
              <p className="mt-5 max-w-[19rem] text-[12.5px] leading-relaxed text-forge-100/80">
                Cette adresse ne mène nulle part. Vos documents, eux, restent enregistrés dans ce
                navigateur.
              </p>
            </div>

            <div className="relative flex items-center gap-2 text-[10px] text-forge-200/65">
              <span
                className={cn(
                  "size-1.5 rounded-full bg-forge-300",
                  animate && "animate-pulse",
                )}
              />
              <span>Local-first · rien n&apos;est envoyé</span>
            </div>
          </section>

          {/* Right: recovery actions */}
          <section className="flex flex-col gap-6 p-7 sm:p-8">
            <div className="animate-forge-rise">
              <p className="micro-label">Page introuvable</p>
              <h1 className="display-serif mt-2 text-[30px] leading-[1.1] tracking-[-0.025em]">
                Rien ici pour l&apos;instant.
              </h1>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                L&apos;adresse demandée ne correspond à aucun document, modèle ou outil. Reprenez
                votre travail par ici.
              </p>
            </div>

            {/* Inline search */}
            <div className="animate-forge-rise [animation-delay:60ms]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Chercher un document…"
                  aria-label="Search your documents"
                  className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-[12.5px] text-foreground shadow-[0_1px_1px_rgba(15,23,20,0.03)] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring/50 focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {query.trim() && (
                <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-card">
                  {matches.length > 0 ? (
                    matches.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => navigate(`/editor/${document.id}`)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent/70"
                      >
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-[12px]">{document.title}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeDate(document.updatedAt)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2.5 text-[11.5px] text-muted-foreground">
                      Aucun document nommé « {query.trim()} ».
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Primary actions */}
            <div className="grid gap-2 animate-forge-rise [animation-delay:120ms]">
              <Button asChild className="justify-between">
                <Link to="/">
                  <span className="flex items-center gap-2">
                    <Home className="size-4" />
                    Retour au tableau de bord
                  </span>
                  <ArrowRight className="size-3.5 opacity-70" />
                </Link>
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-start bg-card/60">
                  <Link to="/templates">
                    <LayoutTemplate className="size-4" />
                    Modèles
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start bg-card/60">
                  <Link to="/tools">
                    <Wrench className="size-4" />
                    Outils PDF
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start bg-card/60">
                  <Link to="/help">
                    <LifeBuoy className="size-4" />
                    Aide
                  </Link>
                </Button>
              </div>
            </div>

            {/* Recent documents */}
            {recent.length > 0 && (
              <div className="animate-forge-rise [animation-delay:180ms]">
                <p className="micro-label mb-2">Reprendre</p>
                <div className="space-y-1">
                  {recent.map((document) => (
                    <Link
                      key={document.id}
                      to={`/editor/${document.id}`}
                      className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
                    >
                      <FileText className="size-3.5 shrink-0 text-muted-foreground/60" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/80 group-hover:text-foreground">
                        {document.title}
                      </span>
                      <ArrowLeft className="size-3 shrink-0 -rotate-180 text-transparent transition-colors group-hover:text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quick create + palette */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4 text-[11px] text-muted-foreground animate-forge-rise [animation-delay:240ms]">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-md px-1.5 py-0.5 font-medium text-forge-700 transition-colors hover:bg-forge-600/10 dark:text-forge-300 dark:hover:bg-forge-300/10"
              >
                Nouveau PDF
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="rounded-md px-1.5 py-0.5 font-medium text-forge-700 transition-colors hover:bg-forge-600/10 dark:text-forge-300 dark:hover:bg-forge-300/10"
              >
                Importer un PDF
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-forge-700 transition-colors hover:bg-forge-600/10 dark:text-forge-300 dark:hover:bg-forge-300/10"
              >
                Recherche complète
                <kbd className="rounded border border-border/80 bg-muted/50 px-1 py-0.5 font-mono text-[9px]">
                  Ctrl K
                </kbd>
              </button>
            </div>
          </section>
        </div>

        {/* Destination shortcuts */}
        <nav
          aria-label="Suggested destinations"
          className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 animate-forge-rise [animation-delay:300ms]"
        >
          {DESTINATIONS.map((destination) => {
            const Icon = destination.icon;
            const active = destination.to === location.pathname;
            return (
              <Link
                key={destination.to}
                to={destination.to}
                className={cn(
                  "group flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/60 p-3 transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:bg-card hover:shadow-soft",
                  active && "border-forge-600/25 bg-card",
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted/70 text-muted-foreground transition-colors group-hover:bg-forge-600/10 group-hover:text-forge-700 dark:group-hover:bg-forge-300/10 dark:group-hover:text-forge-300">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-medium">{destination.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                    {destination.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <p className="mt-5 text-center text-[10px] text-muted-foreground/60">
          Si vous êtes arrivé ici depuis un lien, il est peut-être incomplet ou périmé.
        </p>
      </div>
    </div>
  );
}
