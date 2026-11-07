import {
  AlignLeft,
  Circle,
  Heading1,
  Highlighter,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  PenTool,
  Square,
  Stamp,
  StickyNote,
  Table2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editorStore";

interface EditorToolbarProps {
  onAddText: (
    role: "heading" | "subheading" | "body" | "caption",
    options?: { paragraph?: boolean; note?: boolean },
  ) => void;
  onAddImage: (role: "image" | "logo") => void;
  onAddTable: () => void;
  onAddShape: (shape: "rectangle" | "ellipse" | "line") => void;
  onAddHighlight: () => void;
  onAddSignature: () => void;
}

function ToolButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "rounded-md text-muted-foreground",
            active && "text-foreground shadow-sm ring-1 ring-border/70",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({
  onAddText,
  onAddImage,
  onAddTable,
  onAddShape,
  onAddHighlight,
  onAddSignature,
}: EditorToolbarProps) {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-card/80 px-3 py-1.5 backdrop-blur">
      <ToolButton
        label="Select and move (V)"
        active={tool === "select"}
        onClick={() => setTool("select")}
      >
        <MousePointer2 />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton label="Add heading" onClick={() => onAddText("heading")}>
        <Heading1 />
      </ToolButton>
      <ToolButton label="Add text" onClick={() => onAddText("body")}>
        <Type />
      </ToolButton>
      <ToolButton
        label="Add paragraph"
        onClick={() => onAddText("body", { paragraph: true })}
      >
        <AlignLeft />
      </ToolButton>
      <ToolButton
        label="Add note or annotation"
        onClick={() => onAddText("body", { note: true })}
      >
        <StickyNote />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton label="Add image" onClick={() => onAddImage("image")}>
        <ImageIcon />
      </ToolButton>
      <ToolButton label="Add logo" onClick={() => onAddImage("logo")}>
        <Stamp />
      </ToolButton>
      <ToolButton label="Add table" onClick={onAddTable}>
        <Table2 />
      </ToolButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolButton label="Add rectangle" onClick={() => onAddShape("rectangle")}>
        <Square />
      </ToolButton>
      <ToolButton label="Add ellipse" onClick={() => onAddShape("ellipse")}>
        <Circle />
      </ToolButton>
      <ToolButton label="Add line" onClick={() => onAddShape("line")}>
        <Minus />
      </ToolButton>
      <ToolButton label="Add highlight" onClick={onAddHighlight}>
        <Highlighter />
      </ToolButton>
      <ToolButton label="Draw a signature" onClick={onAddSignature}>
        <PenTool />
      </ToolButton>
      <div className="ml-auto hidden items-center gap-1.5 pr-1 text-[10px] text-muted-foreground/80 lg:flex">
        <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px]">
          V
        </kbd>
        select
        <span className="mx-1 text-border">·</span>
        Double-click text to edit
        <span className="mx-1 text-border">·</span>
        <kbd className="rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px]">
          ?
        </kbd>
        shortcuts
      </div>
    </div>
  );
}
