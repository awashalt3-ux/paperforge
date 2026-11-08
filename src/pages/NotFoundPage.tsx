import { Link } from "react-router-dom";
import { ArrowLeft, Compass, FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="relative grid min-h-[calc(100vh-0px)] place-items-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-40" />
      <div className="pointer-events-none absolute -left-24 top-16 size-72 rounded-full bg-forge-600/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 size-80 rounded-full bg-forge-700/[0.05] blur-3xl" />

      <div className="relative w-full max-w-2xl">
        <div className="paper-shadow overflow-hidden rounded-3xl border border-border/70 bg-card/80 backdrop-blur">
          <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
            <div className="relative flex flex-col justify-between gap-8 border-b border-border/60 bg-gradient-to-br from-forge-700 to-forge-900 p-8 text-forge-50 md:border-b-0 md:border-r">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-forge-100 ring-1 ring-white/15">
                  <FileQuestion className="size-5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forge-200/90">
                  Paperforge
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-forge-200/80">
                  Erreur 404
                </p>
                <p className="display-serif mt-3 text-7xl leading-none tracking-[-0.04em] text-white">
                  404
                </p>
                <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-forge-100/85">
                  Cette page n&apos;existe pas ou a été déplacée. Vos documents restent en
                  sécurité sur le tableau de bord.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] text-forge-200/70">
                <Compass className="size-3.5" />
                <span>paperforge.wasmer.app</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-6 p-8">
              <div>
                <p className="micro-label">Page introuvable</p>
                <h1 className="display-serif mt-2 text-3xl leading-tight tracking-[-0.02em]">
                  Rien ici pour l&apos;instant.
                </h1>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  L&apos;adresse demandée ne correspond à aucun document, modèle ou outil. Choisissez
                  une destination ci-dessous pour reprendre votre travail.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <Button asChild className="justify-start">
                  <Link to="/">
                    <Home className="size-4" />
                    Retour au tableau de bord
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start bg-card/60">
                  <Link to="/templates">
                    <Compass className="size-4" />
                    Parcourir les modèles
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start text-muted-foreground">
                  <Link to="/tools">
                    <ArrowLeft className="size-4" />
                    Outils PDF
                  </Link>
                </Button>
              </div>

              <p className="text-[10.5px] leading-relaxed text-muted-foreground/70">
                Astuce : utilisez les raccourcis clavier <span className="font-mono">Ctrl+K</span> pour
                rechercher rapidement un document.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
