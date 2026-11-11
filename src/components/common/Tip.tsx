import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import type { Tip } from "@/lib/tips";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "paperforge-dismissed-tips";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-80)));
  } catch {
    // Storage can be unavailable in private browsing; tips simply reappear.
  }
}

export function useDismissedTips() {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const dismiss = (id: string) => {
    setDismissed((current) => {
      const next = current.includes(id) ? current : [...current, id];
      writeDismissed(next);
      return next;
    });
  };

  const reset = () => {
    setDismissed([]);
    writeDismissed([]);
  };

  return { dismissed, dismiss, reset };
}

interface TipCardProps {
  tip: Tip;
  onDismiss?: () => void;
  className?: string;
}

/** A quiet inline hint with a dismiss affordance. */
export function TipCard({ tip, onDismiss, className }: TipCardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-forge-600/12 bg-forge-600/[0.045] px-3 py-2.5 dark:border-forge-300/12 dark:bg-forge-300/[0.05]",
        className,
      )}
    >
      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-forge-700 dark:text-forge-300" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-foreground/85">{tip.title}</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">{tip.body}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-background/70 hover:text-foreground"
          aria-label={`Dismiss tip: ${tip.title}`}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/** Shows a single rotating tip for a context, unless every tip is dismissed. */
export function ContextTip({
  tips,
  className,
  intervalMs = 0,
}: {
  tips: Tip[];
  className?: string;
  intervalMs?: number;
}) {
  const { dismissed, dismiss } = useDismissedTips();
  const remaining = tips.filter((tip) => !dismissed.includes(tip.id));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (remaining.length <= 1 || !intervalMs) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % remaining.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [remaining.length, intervalMs]);

  useEffect(() => {
    if (index >= remaining.length) setIndex(0);
  }, [index, remaining.length]);

  const tip = remaining[index];
  if (!tip) return null;

  return (
    <TipCard
      tip={tip}
      onDismiss={() => {
        dismiss(tip.id);
        setIndex(0);
      }}
      className={className}
    />
  );
}
