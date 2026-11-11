import { useNavigate } from "react-router-dom";
import {
  Copy,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import type { DocumentSummary } from "@/types/document";
import { DocumentThumbnail } from "@/components/pdf/DocumentThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatRelativeDate } from "@/lib/utils";
import { trashDaysRemaining } from "@/db/database";
import { useDocumentStore } from "@/store/documentStore";
import { toast } from "sonner";

interface DocumentCardProps {
  document: DocumentSummary;
  view: "grid" | "list";
  onRename: (document: DocumentSummary) => void;
  onDelete: (document: DocumentSummary) => void;
  onRestore?: (document: DocumentSummary) => void;
  onDestroy?: (document: DocumentSummary) => void;
  trashed?: boolean;
}

function DocumentMenu({
  document,
  onRename,
  onDelete,
  onRestore,
  onDestroy,
  trashed,
}: Pick<
  DocumentCardProps,
  "document" | "onRename" | "onDelete" | "onRestore" | "onDestroy" | "trashed"
>) {
  const navigate = useNavigate();
  const duplicateDocument = useDocumentStore((state) => state.duplicateDocument);

  if (trashed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="relative z-10 text-muted-foreground opacity-80 hover:opacity-100"
            aria-label={`Actions for ${document.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem onClick={() => onRestore?.(document)}>
            <RotateCcw />
            Restore document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDestroy?.(document)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
          >
            <XCircle />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="relative z-10 text-muted-foreground opacity-80 hover:opacity-100"
          aria-label={`Actions for ${document.title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => navigate(`/editor/${document.id}`)}>
          <ExternalLink />
          Open document
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRename(document)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            try {
              const copy = await duplicateDocument(document.id);
              toast.success(copy ? "Document duplicated" : "Could not duplicate document");
            } catch {
              toast.error("Could not duplicate document");
            }
          }}
        >
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(document)}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
        >
          <Trash2 />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentCard({
  document,
  view,
  onRename,
  onDelete,
  onRestore,
  onDestroy,
  trashed = false,
}: DocumentCardProps) {
  const navigate = useNavigate();
  const open = () => {
    if (trashed) return;
    navigate(`/editor/${document.id}`);
  };

  if (view === "list") {
    return (
      <div
        className={cn(
          "group flex items-center gap-4 rounded-xl border border-transparent bg-card/60 px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-card",
          trashed ? "cursor-default opacity-90" : "cursor-pointer",
        )}
        onClick={open}
        role={trashed ? undefined : "button"}
        tabIndex={trashed ? undefined : 0}
        onKeyDown={(event) => {
          if (!trashed && event.key === "Enter") open();
        }}
      >
        <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/55">
          <DocumentThumbnail summary={document} maxWidth={38} maxHeight={50} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[12.5px] font-medium">{document.title}</p>
            {document.templateId && (
              <Badge variant="slate" className="hidden shrink-0 sm:inline-flex">
                Template
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {trashed && document.deletedAt
              ? `Deleted ${formatRelativeDate(document.deletedAt).toLowerCase()} · ${trashDaysRemaining(document.deletedAt)} day${
                  trashDaysRemaining(document.deletedAt) === 1 ? "" : "s"
                } left`
              : `Edited ${formatRelativeDate(document.updatedAt).toLowerCase()}`}{" "}
            · {document.pageCount} page{document.pageCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {trashed ? (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5"
              onClick={(event) => {
                event.stopPropagation();
                onRestore?.(document);
              }}
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(event) => {
                event.stopPropagation();
                onRename(document);
              }}
              aria-label="Rename document"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          <DocumentMenu
            document={document}
            onRename={onRename}
            onDelete={onDelete}
            onRestore={onRestore}
            onDestroy={onDestroy}
            trashed={trashed}
          />
        </div>
        <span className="w-24 text-right text-[10.5px] text-muted-foreground/80">
          {new Date(document.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200",
        trashed
          ? "cursor-default border-border/60 opacity-85"
          : "cursor-pointer border-border/70 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift",
      )}
      onClick={open}
      role={trashed ? undefined : "button"}
      tabIndex={trashed ? undefined : 0}
      onKeyDown={(event) => {
        if (!trashed && event.key === "Enter") open();
      }}
    >
      <div className="relative flex h-[190px] items-center justify-center overflow-hidden border-b border-border/60 bg-[#f1f1ed] dark:bg-muted/30">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_1px_1px,hsl(var(--foreground)/.07)_1px,transparent_0)] [background-size:16px_16px]" />
        <div className="relative transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-[1.015]">
          <DocumentThumbnail summary={document} maxWidth={162} maxHeight={166} />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-md border border-border/70 bg-card/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shadow-sm backdrop-blur">
            {document.pageCount} {document.pageCount === 1 ? "page" : "pages"}
          </span>
          {document.templateId && (
            <span className="rounded-md border border-forge-600/15 bg-forge-600/[0.08] px-1.5 py-0.5 text-[9px] font-semibold text-forge-700 backdrop-blur dark:text-forge-300">
              Template
            </span>
          )}
          {trashed && (
            <span className="rounded-md border border-amber-500/25 bg-amber-500/[0.12] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-700 shadow-sm backdrop-blur dark:text-amber-300">
              Trash
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="rounded-md border border-border/70 bg-card/85 shadow-sm backdrop-blur">
            <DocumentMenu
              document={document}
              onRename={onRename}
              onDelete={onDelete}
              onRestore={onRestore}
              onDestroy={onDestroy}
              trashed={trashed}
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/[0.035] to-transparent dark:from-black/20" />
      </div>
      <div className="flex items-start gap-3 p-3.5">
        <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground">
          <FileText className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-snug tracking-[-0.01em]">
            {document.title}
          </p>
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            {trashed && document.deletedAt
              ? `Deleted ${formatRelativeDate(document.deletedAt).toLowerCase()} · ${trashDaysRemaining(document.deletedAt)}d left`
              : `Edited ${formatRelativeDate(document.updatedAt).toLowerCase()}`}
          </p>
        </div>
        {trashed ? (
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 gap-1"
            onClick={(event) => {
              event.stopPropagation();
              onRestore?.(document);
            }}
          >
            <RotateCcw className="size-3" />
            Restore
          </Button>
        ) : (
          <span className="pt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/55">
            PDF
          </span>
        )}
      </div>
    </div>
  );
}
