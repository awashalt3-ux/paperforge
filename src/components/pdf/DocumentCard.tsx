import { useNavigate } from "react-router-dom";
import {
  Copy,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
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
import { useDocumentStore } from "@/store/documentStore";
import { toast } from "sonner";

interface DocumentCardProps {
  document: DocumentSummary;
  view: "grid" | "list";
  onRename: (document: DocumentSummary) => void;
  onDelete: (document: DocumentSummary) => void;
}

function DocumentMenu({
  document,
  onRename,
  onDelete,
}: Pick<DocumentCardProps, "document" | "onRename" | "onDelete">) {
  const navigate = useNavigate();
  const duplicateDocument = useDocumentStore((state) => state.duplicateDocument);

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
      <DropdownMenuContent align="end" className="w-48">
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
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentCard({ document, view, onRename, onDelete }: DocumentCardProps) {
  const navigate = useNavigate();

  if (view === "list") {
    return (
      <div
        className="group flex cursor-pointer items-center gap-4 rounded-xl border border-transparent bg-card/60 px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-card"
        onClick={() => navigate(`/editor/${document.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") navigate(`/editor/${document.id}`);
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
            {document.pageCount} page{document.pageCount === 1 ? "" : "s"} · Edited{" "}
            {formatRelativeDate(document.updatedAt).toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          <DocumentMenu document={document} onRename={onRename} onDelete={onDelete} />
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
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lift"
      onClick={() => navigate(`/editor/${document.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") navigate(`/editor/${document.id}`);
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
        </div>
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="rounded-md border border-border/70 bg-card/85 shadow-sm backdrop-blur">
            <DocumentMenu document={document} onRename={onRename} onDelete={onDelete} />
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
            Edited {formatRelativeDate(document.updatedAt).toLowerCase()}
          </p>
        </div>
        <span className="pt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/55">
          PDF
        </span>
      </div>
    </div>
  );
}
