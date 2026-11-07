import { useState } from "react";
import { AlertTriangle, FileWarning, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaperElement, PaperPage, TableElement, TextElement } from "@/types/document";
import { cssFontFamily } from "@/utils/elementDefaults";
import { useInViewport, usePdfPageImage } from "@/hooks/usePdfPageImage";

interface PagePreviewProps {
  page: PaperPage;
  width: number;
  className?: string;
  lazy?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

function textStyle(element: TextElement, scale: number): React.CSSProperties {
  return {
    position: "absolute",
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    minHeight: element.height * scale,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: "top left",
    opacity: element.opacity,
    fontFamily: cssFontFamily(element.fontFamily),
    fontSize: element.fontSize * scale,
    fontWeight: element.fontWeight,
    fontStyle: element.italic ? "italic" : "normal",
    textDecoration: element.underline ? "underline" : "none",
    color: element.color,
    textAlign: element.align,
    lineHeight: element.lineHeight,
    letterSpacing: element.letterSpacing * scale,
    padding: element.padding * scale,
    whiteSpace: "pre-wrap",
    overflow: "hidden",
    overflowWrap: "break-word",
    backgroundColor: element.backgroundColor,
    zIndex: 1,
  };
}

function renderElement(element: PaperElement, scale: number) {
  if (!element.visible) return null;
  const base: React.CSSProperties = {
    position: "absolute",
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: "top left",
    opacity: element.opacity,
  };

  if (element.type === "text") {
    return <div key={element.id} style={textStyle(element, scale)}>{element.text}</div>;
  }

  if (element.type === "image") {
    return (
      <img
        key={element.id}
        src={element.src}
        alt={element.alt ?? ""}
        draggable={false}
        style={{
          ...base,
          objectFit: element.fit === "fill" ? "fill" : element.fit,
          borderRadius: element.cornerRadius * scale,
          background: element.role === "logo" ? "transparent" : undefined,
        }}
      />
    );
  }

  if (element.type === "shape") {
    if (element.shape === "line") {
      return (
        <svg
          key={element.id}
          width={Math.max(1, element.width * scale)}
          height={Math.max(1, element.height * scale)}
          style={{ ...base, overflow: "visible" }}
        >
          <line
            x1={0}
            y1={0}
            x2={element.width * scale}
            y2={element.height * scale}
            stroke={element.stroke === "transparent" ? element.fill : element.stroke}
            strokeWidth={Math.max(0.5, element.strokeWidth * scale)}
            strokeDasharray={element.dash?.map((d) => d * scale).join(" ")}
            strokeLinecap="round"
          />
        </svg>
      );
    }
    return (
      <div
        key={element.id}
        style={{
          ...base,
          backgroundColor:
            element.fill === "transparent" ? "transparent" : element.fill,
          border:
            element.strokeWidth > 0 && element.stroke !== "transparent"
              ? `${Math.max(0.5, element.strokeWidth * scale)}px solid ${element.stroke}`
              : undefined,
          borderRadius:
            element.shape === "ellipse" ? "50%" : element.cornerRadius * scale,
        }}
      />
    );
  }

  if (element.type === "table") {
    return (
      <div key={element.id} style={{ ...base, overflow: "hidden" }}>
        <TablePreview table={element as TableElement} scale={scale} />
      </div>
    );
  }

  return null;
}

function TablePreview({ table, scale }: { table: TableElement; scale: number }) {
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const rowCount = table.rows.length;
  const weights = table.columnWeights?.length === columns ? table.columnWeights : Array(columns).fill(1);
  const rowHeights =
    table.rowHeights?.length === rowCount
      ? table.rowHeights
      : Array(rowCount).fill(table.height / rowCount);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderTop: `${table.borderWidth * scale}px solid ${table.borderColor}`,
        borderLeft: `${table.borderWidth * scale}px solid ${table.borderColor}`,
      }}
    >
      {table.rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: "flex",
            height: (rowHeights[rowIndex] / table.height) * 100 + "%",
            minHeight: 0,
            backgroundColor:
              rowIndex === 0 && table.headerRow ? table.headerBackground : "transparent",
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                width: (weights[colIndex] / totalWeight) * 100 + "%",
                borderRight: `${table.borderWidth * scale}px solid ${table.borderColor}`,
                borderBottom: `${table.borderWidth * scale}px solid ${table.borderColor}`,
                padding: table.cellPadding * scale,
                fontFamily: cssFontFamily(table.fontFamily),
                fontSize: table.fontSize * scale,
                color:
                  rowIndex === 0 && table.headerRow ? table.headerColor : table.color,
                fontWeight: rowIndex === 0 && table.headerRow ? 600 : 400,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {row[colIndex] ?? ""}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PagePreview({
  page,
  width,
  className,
  lazy = true,
  interactive = false,
  onClick,
}: PagePreviewProps) {
  const { ref, inView } = useInViewport<HTMLDivElement>("480px");
  const shouldLoad = !lazy || inView;
  const source = usePdfPageImage(page.source, width * 2, shouldLoad);
  const [sourceFailed, setSourceFailed] = useState(false);
  const scale = width / page.width;
  const height = page.height * scale;
  const missingSource = page.source && source.error;

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-white",
        interactive && "cursor-pointer",
        className,
      )}
      style={{ width, height, backgroundColor: page.background }}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive && onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") onClick();
            }
          : undefined
      }
    >
      {page.source && source.src && !sourceFailed && (
        <img
          src={source.src}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full"
          onError={() => setSourceFailed(true)}
        />
      )}
      {page.source && source.loading && !source.src && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
          <Loader2 className="size-4 animate-spin text-muted-foreground/60" />
        </div>
      )}
      {missingSource && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/40 p-2 text-center">
          {sourceFailed ? (
            <FileWarning className="size-4 text-muted-foreground" />
          ) : (
            <AlertTriangle className="size-4 text-amber-600" />
          )}
          <span className="text-[8px] leading-tight text-muted-foreground">
            Source preview unavailable
          </span>
        </div>
      )}
      {page.elements.map((element) => renderElement(element, scale))}
    </div>
  );
}

export function PagePreviewFrame({
  page,
  width,
  className,
}: {
  page: PaperPage;
  width: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "paper-shadow overflow-hidden rounded-[2px] bg-white ring-1 ring-black/5",
        className,
      )}
    >
      <PagePreview page={page} width={width} />
    </div>
  );
}
