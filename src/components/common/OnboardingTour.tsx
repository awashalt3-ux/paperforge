import { useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface OnboardingState {
  completed: boolean;
  tourOpen: boolean;
  startTour: () => void;
  closeTour: () => void;
  complete: () => void;
  reset: () => void;
}

/**
 * Onboarding state. Kept in localStorage and separate from document preferences
 * so importing a project or clearing the library never re-triggers the tour.
 *
 * The tour is opt-in: a quiet welcome card invites the user, and the modal only
 * opens when they ask for it. Nothing blocks the workspace on first load.
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      tourOpen: false,
      startTour: () => set({ tourOpen: true }),
      closeTour: () => set({ tourOpen: false }),
      complete: () => set({ completed: true, tourOpen: false }),
      reset: () => set({ completed: false, tourOpen: false }),
    }),
    { name: "paperforge-onboarding", version: 2 },
  ),
);

const STEPS = [
  {
    icon: Compass,
    title: "Welcome to Paperforge",
    body: "A complete PDF studio that runs entirely in this browser. Nothing you make is uploaded, and there is no account to create.",
  },
  {
    icon: Sparkles,
    title: "Start any way you like",
    body: "Create a blank page, import an existing PDF, or open a template. Everything stays editable — real text, shapes, tables, and images.",
  },
  {
    icon: CheckCircle2,
    title: "Finish and deliver",
    body: "Export a print-ready PDF with vector text, save PNG or JPEG images, print, or run one of the nine PDF tools. Autosave keeps your work safe.",
  },
];

/** A dismissible invitation shown on the dashboard until the tour is seen. */
export function WelcomeCard({ className }: { className?: string }) {
  const completed = useOnboardingStore((state) => state.completed);
  const complete = useOnboardingStore((state) => state.complete);
  const startTour = useOnboardingStore((state) => state.startTour);

  if (completed) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-forge-600/15 bg-gradient-to-br from-forge-600/[0.07] via-card/70 to-card/60 p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-forge-600/10 text-forge-700 dark:bg-forge-300/12 dark:text-forge-300">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold tracking-[-0.01em]">First time here?</p>
          <p className="mt-1 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
            Take a 30-second tour of the studio, or jump straight in. The help guide is always a
            click away if you want the details later.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="xs" onClick={startTour} className="gap-1.5">
              Take the tour
              <ArrowRight className="size-3" />
            </Button>
            <Button variant="ghost" size="xs" onClick={complete}>
              Maybe later
            </Button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={complete}
        className="absolute right-2.5 top-2.5 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-background/70 hover:text-foreground"
        aria-label="Dismiss the welcome card"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function OnboardingTour() {
  const open = useOnboardingStore((state) => state.tourOpen);
  const closeTour = useOnboardingStore((state) => state.closeTour);
  const complete = useOnboardingStore((state) => state.complete);
  const openCreate = useUIStore((state) => state.setCreateDialogOpen);
  const openHelp = useUIStore((state) => state.setHelpOpen);
  const [step, setStep] = useState(0);

  const finish = (destination: "none" | "help" | "create") => {
    setStep(0);
    if (destination === "help") {
      closeTour();
      window.setTimeout(() => openHelp(true), 80);
      return;
    }
    complete();
    if (destination === "create") window.setTimeout(() => openCreate(true), 80);
  };

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish("none");
      }}
    >
      <DialogContent hideClose className="max-w-[480px] gap-0 overflow-hidden p-0">
        <DialogHeader className="relative flex-row items-start gap-3 space-y-0 border-b border-border/60 bg-gradient-to-br from-forge-800 via-forge-700 to-forge-900 px-6 py-5 text-forge-50">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/12 ring-1 ring-white/15">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 text-left">
            <DialogDescription className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-forge-200/80">
              Getting started · {step + 1} of {STEPS.length}
            </DialogDescription>
            <DialogTitle className="display-serif mt-1 text-[22px] leading-tight text-white">
              {current.title}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => finish("none")}
            className="ml-auto shrink-0 rounded-md p-1 text-forge-200/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Skip the tour"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>

        <div className="px-6 py-5">
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{current.body}</p>
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((item, index) => (
              <span
                key={item.title}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step
                    ? "w-6 bg-forge-600 dark:bg-forge-300"
                    : index < step
                      ? "w-1.5 bg-forge-600/40 dark:bg-forge-300/40"
                      : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-5 py-3.5">
          <button
            type="button"
            onClick={() => finish("help")}
            className="rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Read the full guide
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => finish("none")}>
              Skip
            </Button>
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (!isLast) {
                  setStep((value) => value + 1);
                  return;
                }
                finish("create");
              }}
            >
              {isLast ? "Create my first PDF" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
