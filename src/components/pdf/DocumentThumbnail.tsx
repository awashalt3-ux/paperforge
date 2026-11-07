import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import type { DocumentSummary, PaperPage } from "@/types/document";
import { getDocument } from "@/db/database";
import { PagePreview } from "@/components/pdf/PagePreview";
import { cn } from "@/lib/utils";

interface DocumentThumbnailProps {
  summary: DocumentSummary;
  maxWidth: number;
  maxHeight: number;
  className?: string;
}

export function DocumentThumbnail({
  summary,
  maxWidth,
  maxHeight,
  className,
}: DocumentThumbnailProps) {
  const [page, setPage] = useState<PaperPage | null>(null);
  const [loading, setLoading] = useState(!summary.thumbnail);
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (summary.thumbnail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getDocument(summary.id)
      .then((document) => {
        if (!cancelled) setPage(document?.pages[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setPage(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [summary.id, summary.thumbnail, summary.updatedAt]);

  if (summary.thumbnail && !thumbnailError) {
    return (
      <img
        src={summary.thumbnail}
        alt={`Preview of ${summary.title}`}
        onError={() => setThumbnailError(true)}
        className={cn("max-h-full max-w-full object-contain paper-shadow", className)}
        style={{ maxWidth, maxHeight }}
      />
    );
  }

  if (page) {
    const scale = Math.min(maxWidth / page.width, maxHeight / page.height);
    const width = Math.max(24, page.width * scale);
    return (
      <div className={cn("paper-shadow overflow-hidden rounded-[2px] bg-white", className)}>
        <PagePreview page={page} width={width} lazy={false} />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-sm bg-white paper-shadow",
          className,
        )}
        style={{ width: maxWidth * 0.72, height: Math.min(maxHeight, maxWidth * 1.3) }}
      >
        <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border bg-white/70 text-muted-foreground",
        className,
      )}
      style={{ width: maxWidth * 0.72, height: Math.min(maxHeight, maxWidth * 1.3) }}
    >
      <FileText className="size-5 opacity-40" />
      <span className="text-[9px] font-medium uppercase tracking-widest opacity-50">Blank</span>
    </div>
  );
}
