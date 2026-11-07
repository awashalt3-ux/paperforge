import { useMemo, useState } from "react";
import {
  ChevronUp,
  Copy,
  GripVertical,
  MoreHorizontal,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { PaperPage } from "@/types/document";
import { PagePreview } from "@/components/pdf/PagePreview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { rotatePageData } from "@/utils/documentFactory";
import { getPresetLabel, ptToMm } from "@/utils/pageSizes";
import { cn } from "@/lib/utils";

const THUMBNAIL_WIDTH = 108;

function PageMeta({ page }: { page: PaperPage }) {
  const preset = getPresetLabel(page.width, page.height);
  const orientation = page.width > page.height ? "Landscape" : "Portrait";
  return (
    <span className="text-[9px] text-muted-foreground/80">
      {preset} · {orientation}
    </span>
  );
}

export function PageSidebar({ className }: { className?: string }) {
  const document = useDocumentStore((state) => state.activeDocument);
  const addPage = useDocumentStore((state) => state.addPage);
  const duplicatePage = useDocumentStore((state) => state.duplicatePage);
  const deletePage = useDocumentStore((state) => state.deletePage);
  const reorderPages = useDocumentStore((state) => state.reorderPages);
  const replacePage = useDocumentStore((state) => state.replacePage);

  const activePageId = useEditorStore((state) => state.activePageId);
  const goToPage = useEditorStore((state) => state.goToPage);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const pages = document?.pages ?? [];
  const activeIndex = useMemo(
    () => pages.findIndex((page) => page.id === activePageId),
    [pages, activePageId],
  );

  if (!document) return null;

  const handleAddPage = () => {
    const page = addPage(activePageId ?? pages[pages.length - 1]?.id);
    if (!page) {
      toast.error("A new page could not be added.");
      return;
    }
    goToPage(page.id);
  };

  const handleDuplicate = (pageId: string) => {
    const page = duplicatePage(pageId);
    if (!page) {
      toast.error("This page could not be duplicated.");
      return;
    }
    goToPage(page.id);
    toast.success("Page duplicated");
  };

  const handleRotate = (page: PaperPage) => {
    const rotated = rotatePageData(page);
    replacePage(page.id, rotated, { historyKey: `rotate-page-${page.id}` });
    goToPage(page.id);
    toast.success("Page rotated 90°");
  };

  const handleDelete = (page: PaperPage) => {
    const index = pages.findIndex((item) => item.id === page.id);
    const next = pages[index + 1] ?? pages[index - 1];
    const deleted = deletePage(page.id);
    if (!deleted) {
      toast.error("A document must keep at least one page.");
      return;
    }
    if (next) goToPage(next.id);
    toast.success("Page deleted. Undo is available.");
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    reorderPages(dragIndex, targetIndex);
    setDragIndex(null);
    setDropIndex(null);
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[184px] shrink-0 flex-col border-r border-border/70 bg-sidebar/70 backdrop-blur-sm",
        className,
      )}
      aria-label="Document pages"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-semibold tracking-[-0.01em]">Pages</span>
          <span className="text-[9.5px] text-muted-foreground">{pages.length}</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleAddPage}
              aria-label="Add page"
              className="text-muted-foreground"
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Add page</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-3">
          {pages.map((page, index) => {
            const isActive = page.id === activePageId;
            const isDropTarget = dropIndex === index && dragIndex !== index;
            return (
              <div
                key={page.id}
                draggable
                onDragStart={(event) => {
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropIndex(index);
                }}
                onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={cn(
                  "group relative rounded-lg border p-1.5 transition-colors",
                  isActive
                    ? "border-forge-600/45 bg-card shadow-sm dark:border-forge-300/40"
                    : "border-transparent hover:border-border/80 hover:bg-card/55",
                  isDropTarget && "border-forge-500 ring-2 ring-forge-500/25",
                )}
              >
                <button
                  type="button"
                  onClick={() => goToPage(page.id)}
                  className="block w-full cursor-pointer rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Go to page ${index + 1}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="relative mx-auto flex justify-center">
                    <div
                      className={cn(
                        "overflow-hidden rounded-[2px] bg-white ring-1 transition-shadow",
                        isActive
                          ? "ring-forge-600/50 paper-shadow"
                          : "ring-black/5 group-hover:shadow-sm",
                      )}
                    >
                      <PagePreview page={page} width={THUMBNAIL_WIDTH} lazy />
                    </div>
                  </div>
                </button>

                <div className="mt-1.5 flex items-center gap-1 px-0.5">
                  <GripVertical className="size-2.5 shrink-0 cursor-grab text-muted-foreground/35" />
                  <span
                    className={cn(
                      "text-[10px] font-medium tabular-nums",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="ml-auto flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-6 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                          aria-label={`Page ${index + 1} actions`}
                        >
                          <MoreHorizontal className="size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuItem onClick={() => handleDuplicate(page.id)} className="gap-2">
                          <Copy />
                          Duplicate page
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRotate(page)} className="gap-2">
                          <RotateCw />
                          Rotate 90°
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const pageIndex = pages.findIndex((item) => item.id === page.id);
                            if (pageIndex > 0) reorderPages(pageIndex, pageIndex - 1);
                          }}
                          disabled={index === 0}
                          className="gap-2"
                        >
                          <ChevronUp />
                          Move page up
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(page)}
                          disabled={pages.length <= 1}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 />
                          Delete page
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between px-0.5">
                  <PageMeta page={page} />
                  <span className="text-[8.5px] text-muted-foreground/55">
                    {Math.round(ptToMm(page.width))}×{Math.round(ptToMm(page.height))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 p-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddPage}
          className="h-8 w-full justify-center gap-1.5 bg-card/60 text-[11px]"
        >
          <Plus className="size-3.5" />
          Add page
        </Button>
        {activeIndex >= 0 && (
          <p className="mt-2 text-center text-[9px] text-muted-foreground/65">
            Page {activeIndex + 1} of {pages.length} selected
          </p>
        )}
      </div>
    </aside>
  );
}
