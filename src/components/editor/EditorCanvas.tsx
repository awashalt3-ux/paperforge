import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import Konva from "konva";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { AlertTriangle, Loader2 } from "lucide-react";
import type {
  ImageElement,
  PaperDocument,
  PaperElement,
  PaperPage,
  ShapeElement,
  TableElement,
  TextElement,
} from "@/types/document";
import { useDocumentStore } from "@/store/documentStore";
import { useEditorStore } from "@/store/editorStore";
import { usePreferencesStore } from "@/store/preferencesStore";
import { usePdfPageImage } from "@/hooks/usePdfPageImage";
import { cssFontFamily } from "@/utils/elementDefaults";
import { cn, round } from "@/lib/utils";

interface EditorCanvasProps {
  document: PaperDocument;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
}

interface PageStageProps {
  document: PaperDocument;
  page: PaperPage;
  index: number;
  zoom: number;
  isFirst: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be decoded."));
    image.src = src;
  });
  imageCache.set(src, loading);
  loading.catch(() => imageCache.delete(src));
  return loading;
}

function useHtmlImage(src: string | null | undefined): {
  image: HTMLImageElement | null;
  failed: boolean;
} {
  const [state, setState] = useState<{ image: HTMLImageElement | null; failed: boolean }>({
    image: null,
    failed: false,
  });
  useEffect(() => {
    if (!src) {
      setState({ image: null, failed: false });
      return;
    }
    let cancelled = false;
    setState({ image: null, failed: false });
    loadHtmlImage(src)
      .then((image) => {
        if (!cancelled) setState({ image, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ image: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return state;
}

function isTransparent(color: string | undefined): boolean {
  return !color || color === "transparent" || color === "none";
}

function elementBox(element: PaperElement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  if (!element.rotation) {
    return {
      left: element.x,
      top: element.y,
      right: element.x + element.width,
      bottom: element.y + element.height,
    };
  }
  const radians = (element.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    { x: 0, y: 0 },
    { x: element.width, y: 0 },
    { x: element.width, y: element.height },
    { x: 0, y: element.height },
  ].map((point) => ({
    x: element.x + point.x * cos - point.y * sin,
    y: element.y + point.x * sin + point.y * cos,
  }));
  return {
    left: Math.min(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    right: Math.max(...corners.map((point) => point.x)),
    bottom: Math.max(...corners.map((point) => point.y)),
  };
}

function roundedClip(
  width: number,
  height: number,
  radius: number,
): (context: Konva.Context) => void {
  return (context) => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(r, 0);
    context.lineTo(width - r, 0);
    context.quadraticCurveTo(width, 0, width, r);
    context.lineTo(width, height - r);
    context.quadraticCurveTo(width, height, width - r, height);
    context.lineTo(r, height);
    context.quadraticCurveTo(0, height, 0, height - r);
    context.lineTo(0, r);
    context.quadraticCurveTo(0, 0, r, 0);
    context.closePath();
  };
}

function TextNode({ element }: { element: TextElement }) {
  const background = isTransparent(element.backgroundColor)
    ? undefined
    : element.backgroundColor;
  return (
    <>
      {background && (
        <Rect
          width={element.width}
          height={element.height}
          fill={background}
          listening={false}
        />
      )}
      <Text
        x={0}
        y={0}
        text={element.text}
        width={element.width}
        height={element.height}
        padding={element.padding}
        fontFamily={cssFontFamily(element.fontFamily)}
        fontSize={element.fontSize}
        fontStyle={`${element.italic ? "italic " : ""}${element.fontWeight}`}
        fill={element.color}
        align={element.align}
        lineHeight={element.lineHeight}
        letterSpacing={element.letterSpacing}
        textDecoration={element.underline ? "underline" : ""}
        wrap="word"
        ellipsis={false}
        verticalAlign="top"
        listening={false}
        perfectDrawEnabled={false}
      />
    </>
  );
}

function ImageNode({ element }: { element: ImageElement }) {
  const { image, failed } = useHtmlImage(element.src);
  const imageRatio = image ? image.naturalWidth / image.naturalHeight : 1;
  const boxRatio = element.width / Math.max(1, element.height);

  let crop: { x: number; y: number; width: number; height: number } | undefined;
  let drawX = 0;
  let drawY = 0;
  let drawWidth = element.width;
  let drawHeight = element.height;

  if (image) {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (element.fit === "contain") {
      if (imageRatio >= boxRatio) {
        drawWidth = element.width;
        drawHeight = element.width / imageRatio;
      } else {
        drawHeight = element.height;
        drawWidth = element.height * imageRatio;
      }
      drawX = (element.width - drawWidth) / 2;
      drawY = (element.height - drawHeight) / 2;
    } else if (element.fit === "cover") {
      if (imageRatio >= boxRatio) {
        const cropWidth = naturalHeight * boxRatio;
        crop = {
          x: (naturalWidth - cropWidth) / 2,
          y: 0,
          width: cropWidth,
          height: naturalHeight,
        };
      } else {
        const cropHeight = naturalWidth / boxRatio;
        crop = {
          x: 0,
          y: (naturalHeight - cropHeight) / 2,
          width: naturalWidth,
          height: cropHeight,
        };
      }
    }
  }

  return (
    <>
      {!image && (
        <Rect
          width={element.width}
          height={element.height}
          fill="#eef2f0"
          listening={false}
        />
      )}
      {!image && (
        <Text
          width={element.width}
          height={element.height}
          text={failed ? "Image unavailable" : "Loading image…"}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(8, Math.min(12, element.width / 18))}
          fill="#8b9491"
          listening={false}
        />
      )}
      {image && (
        <KonvaImage
          image={image}
          x={drawX}
          y={drawY}
          width={drawWidth}
          height={drawHeight}
          crop={crop}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </>
  );
}

function ShapeNode({ element }: { element: ShapeElement }) {
  const fill = isTransparent(element.fill) ? undefined : element.fill;
  const stroke =
    element.strokeWidth > 0 && !isTransparent(element.stroke)
      ? element.stroke
      : undefined;
  const dash = element.dash && element.dash.length > 0 ? element.dash : undefined;
  const blend = element.purpose === "highlight" ? "multiply" : undefined;

  if (element.shape === "line") {
    return (
      <Line
        points={[0, 0, element.width, element.height]}
        stroke={stroke ?? fill ?? "#265249"}
        strokeWidth={Math.max(0.5, element.strokeWidth)}
        dash={dash}
        lineCap="round"
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  if (element.shape === "ellipse") {
    return (
      <Ellipse
        x={element.width / 2}
        y={element.height / 2}
        radiusX={Math.max(0.5, element.width / 2)}
        radiusY={Math.max(0.5, element.height / 2)}
        fill={fill}
        stroke={stroke}
        strokeWidth={element.strokeWidth}
        dash={dash}
        globalCompositeOperation={blend}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  return (
    <Rect
      width={element.width}
      height={element.height}
      fill={fill}
      stroke={stroke}
      strokeWidth={element.strokeWidth}
      cornerRadius={element.cornerRadius}
      dash={dash}
      globalCompositeOperation={blend}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

function TableNode({ element }: { element: TableElement }) {
  const columns = Math.max(1, ...element.rows.map((row) => row.length));
  const weights =
    element.columnWeights?.length === columns
      ? element.columnWeights
      : Array(columns).fill(1);
  const totalWeight = Math.max(0.0001, weights.reduce((sum, weight) => sum + weight, 0));
  const rowHeights =
    element.rowHeights?.length === element.rows.length
      ? element.rowHeights
      : Array(element.rows.length).fill(element.height / Math.max(1, element.rows.length));
  const totalRowHeight = Math.max(0.0001, rowHeights.reduce((sum, height) => sum + height, 0));
  const columnWidths = weights.map((weight) => (weight / totalWeight) * element.width);
  const xOffsets = columnWidths.reduce<number[]>((offsets, width, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + columnWidths[index - 1]);
    return offsets;
  }, []);
  const border = element.borderWidth > 0 ? element.borderWidth : 0;
  const font = cssFontFamily(element.fontFamily);

  let yTop = 0;
  return (
    <>
      {element.rows.map((row, rowIndex) => {
        const rowHeight =
          ((rowHeights[rowIndex] ?? 0) / totalRowHeight) * element.height;
        const isHeader = rowIndex === 0 && element.headerRow;
        const currentY = yTop;
        yTop += rowHeight;
        return (
          <Group key={rowIndex}>
            {Array.from({ length: columns }).map((_, columnIndex) => {
              const cellX = xOffsets[columnIndex];
              const cellWidth = columnWidths[columnIndex];
              const text = row[columnIndex] ?? "";
              return (
                <Group
                  key={columnIndex}
                  clipX={cellX}
                  clipY={currentY}
                  clipWidth={cellWidth}
                  clipHeight={rowHeight}
                >
                  <Rect
                    x={cellX}
                    y={currentY}
                    width={cellWidth}
                    height={rowHeight}
                    fill={
                      isHeader && !isTransparent(element.headerBackground)
                        ? element.headerBackground
                        : undefined
                    }
                    stroke={isTransparent(element.borderColor) ? undefined : element.borderColor}
                    strokeWidth={border}
                    listening={false}
                  />
                  <Text
                    x={cellX + element.cellPadding}
                    y={currentY + element.cellPadding}
                    width={Math.max(1, cellWidth - element.cellPadding * 2)}
                    height={Math.max(1, rowHeight - element.cellPadding * 2)}
                    text={text}
                    fontFamily={font}
                    fontSize={element.fontSize}
                    fontStyle={isHeader ? "600" : "400"}
                    fill={isHeader ? element.headerColor : element.color}
                    lineHeight={1.22}
                    wrap="word"
                    ellipsis
                    verticalAlign="top"
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                </Group>
              );
            })}
          </Group>
        );
      })}
    </>
  );
}

interface ElementNodeProps {
  element: PaperElement;
  selected: boolean;
  editing: boolean;
  interactive: boolean;
  onSelect: (element: PaperElement, event: Konva.KonvaEventObject<MouseEvent>) => void;
  onStartEdit: (element: PaperElement) => void;
  onDragStart: (element: PaperElement, node: Konva.Group) => void;
  onDragMove: (element: PaperElement, node: Konva.Group) => void;
  onDragEnd: (element: PaperElement, node: Konva.Group) => void;
  registerNode: (node: Konva.Group | null) => void;
}

function ElementNode({
  element,
  selected,
  editing,
  interactive,
  onSelect,
  onStartEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  registerNode,
}: ElementNodeProps) {
  const nodeRef = useRef<Konva.Group>(null);
  const [hovered, setHovered] = useState(false);
  const clipped = element.type === "text" || element.type === "table";

  useEffect(() => {
    registerNode(nodeRef.current);
    return () => registerNode(null);
  }, [registerNode]);

  const radius =
    element.type === "image"
      ? element.cornerRadius
      : element.type === "shape" && element.shape === "rectangle"
        ? element.cornerRadius
        : 0;
  const clip = useMemo(
    () =>
      radius > 0 ? roundedClip(element.width, element.height, radius) : undefined,
    [radius, element.width, element.height],
  );

  return (
    <Group
      ref={nodeRef}
      id={element.id}
      name="element-node"
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      opacity={element.opacity}
      visible={element.visible && !editing}
      draggable={interactive && !element.locked}
      listening={interactive && !element.locked}
      clipX={clipped ? 0 : undefined}
      clipY={clipped ? 0 : undefined}
      clipWidth={clipped ? element.width : undefined}
      clipHeight={clipped ? element.height : undefined}
      onMouseDown={(event) => onSelect(element, event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={(event) => {
        const node = event.target as Konva.Group;
        onDragStart(element, node);
      }}
      onDragMove={(event) => {
        const node = event.target as Konva.Group;
        onDragMove(element, node);
      }}
      onDragEnd={(event) => {
        const node = event.target as Konva.Group;
        onDragEnd(element, node);
      }}
      onDblClick={() => onStartEdit(element)}
      onDblTap={() => onStartEdit(element)}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill="rgba(0,0,0,0.001)"
        listening={interactive && !element.locked}
      />
      {clip && (
        <Group clipFunc={clip}>
          {element.type === "text" && <TextNode element={element} />}
          {element.type === "image" && <ImageNode element={element} />}
        </Group>
      )}
      {!clip && element.type === "text" && <TextNode element={element} />}
      {!clip && element.type === "image" && <ImageNode element={element} />}
      {element.type === "shape" && <ShapeNode element={element} />}
      {element.type === "table" && <TableNode element={element} />}
      {selected && (
        <Rect
          width={element.width}
          height={element.height}
          stroke="#2b6559"
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={[3, 3]}
          listening={false}
          opacity={0.55}
        />
      )}
      {hovered && interactive && !selected && !element.locked && (
        <Rect
          width={element.width}
          height={element.height}
          stroke="#2b6559"
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
          opacity={0.35}
        />
      )}
    </Group>
  );
}

function PageStage({
  document,
  page,
  index,
  zoom,
  isFirst,
  onEditingChange,
}: PageStageProps) {
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const toggleSelectedId = useEditorStore((state) => state.toggleSelectedId);
  const setActivePage = useEditorStore((state) => state.setActivePage);
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const activePageId = useEditorStore((state) => state.activePageId);
  const editRequest = useEditorStore((state) => state.editRequest);
  const showGrid = usePreferencesStore((state) => state.showGrid);
  const snapToGrid = usePreferencesStore((state) => state.snapToGrid);
  const gridSize = usePreferencesStore((state) => state.gridSize);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const updateElements = useDocumentStore((state) => state.updateElements);
  const setThumbnail = useDocumentStore((state) => state.setThumbnail);

  const stageRef = useRef<Konva.Stage>(null);
  const overlayLayerRef = useRef<Konva.Layer>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const marqueeRef = useRef<Konva.Rect>(null);
  const guideXRef = useRef<Konva.Line>(null);
  const guideYRef = useRef<Konva.Line>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const nodeRefCallbacks = useRef(
    new Map<string, (node: Konva.Group | null) => void>(),
  );
  const dragRef = useRef<{
    ids: string[];
    startPositions: Map<string, { x: number; y: number }>;
    startDragged: { x: number; y: number };
    startBounds: { left: number; top: number; right: number; bottom: number };
  } | null>(null);
  const marqueeActiveRef = useRef(false);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const marqueeAdditiveRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editingRef = useRef<{ id: string; cancelled: boolean } | null>(null);

  const active = activePageId === page.id;
  const isEditingPage = editingId !== null;
  const selectedOnPage = useMemo(
    () => page.elements.filter((element) => selectedIds.includes(element.id)),
    [page.elements, selectedIds],
  );

  const source = usePdfPageImage(page.source, page.width * 2);
  const { image: sourceImage, failed: sourceFailed } = useHtmlImage(source.src);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const getNodeCallback = useCallback((id: string) => {
    const existing = nodeRefCallbacks.current.get(id);
    if (existing) return existing;
    const callback = (node: Konva.Group | null) => registerNode(id, node);
    nodeRefCallbacks.current.set(id, callback);
    return callback;
  }, [registerNode]);

  // Attach the transformer to the current selection.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes =
      tool === "select" && !editingId
        ? selectedOnPage
            .filter((element) => !element.locked)
            .map((element) => nodeRefs.current.get(element.id))
            .filter((node): node is Konva.Group => Boolean(node))
        : [];
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedOnPage, tool, editingId]);

  const showGuides = (vertical: number | null, horizontal: number | null) => {
    const layer = overlayLayerRef.current;
    const verticalLine = guideXRef.current;
    const horizontalLine = guideYRef.current;
    if (!layer || !verticalLine || !horizontalLine) return;
    if (vertical === null) {
      verticalLine.visible(false);
    } else {
      verticalLine.visible(true);
      verticalLine.points([vertical, 0, vertical, page.height]);
    }
    if (horizontal === null) {
      horizontalLine.visible(false);
    } else {
      horizontalLine.visible(true);
      horizontalLine.points([0, horizontal, page.width, horizontal]);
    }
    layer.batchDraw();
  };

  const hideGuides = () => showGuides(null, null);

  const handleSelect = (
    element: PaperElement,
    event: Konva.KonvaEventObject<MouseEvent>,
  ) => {
    event.cancelBubble = true;
    if (tool !== "select") setTool("select");
    setActivePage(page.id);
    const additive = Boolean(event.evt?.shiftKey || event.evt?.metaKey || event.evt?.ctrlKey);
    if (additive) {
      toggleSelectedId(element.id);
      return;
    }
    const current = useEditorStore.getState().selectedIds;
    if (!current.includes(element.id)) setSelectedIds([element.id]);
  };

  const startEditing = (element: PaperElement) => {
    if (element.type !== "text" || element.locked) return;
    setActivePage(page.id);
    setSelectedIds([element.id]);
    editingRef.current = { id: element.id, cancelled: false };
    setDraft(element.text);
    setEditingId(element.id);
    onEditingChange?.(true);
  };

  const stopEditing = (commit: boolean) => {
    const editing = editingRef.current;
    if (!editing) return;
    editingRef.current = null;
    const element = page.elements.find((item) => item.id === editing.id);
    const textarea = textareaRef.current;
    const value = textarea ? textarea.value : draft;
    if (commit && !editing.cancelled && element && element.type === "text") {
      const maxHeight = Math.max(12, page.height - element.y);
      const measured = textarea ? textarea.scrollHeight / zoom : element.height;
      const height = Math.min(maxHeight, Math.max(12, measured + 1));
      if (value !== element.text || Math.abs(height - element.height) > 0.5) {
        updateElement<TextElement>(
          editing.id,
          { text: value, height: round(height, 2) },
          { historyKey: `edit-text-${editing.id}` },
        );
      }
    }
    setEditingId(null);
    onEditingChange?.(false);
  };

  // Enter on a selected text element asks this page to open its inline editor.
  useEffect(() => {
    if (!editRequest) return;
    const target = page.elements.find((item) => item.id === editRequest.elementId);
    if (target?.type === "text" && !target.locked) {
      startEditing(target);
    }
    // The request is one-shot; only its nonce should re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest?.nonce]);

  useEffect(() => {
    if (!editingId) return;
    const timer = window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(24, textarea.scrollHeight)}px`;
    }, 20);
    return () => window.clearTimeout(timer);
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    const element = page.elements.find((item) => item.id === editingId);
    if (!element) {
      editingRef.current = null;
      setEditingId(null);
      onEditingChange?.(false);
    }
  }, [editingId, page.elements, onEditingChange]);

  // Drag calculations with snapping and alignment guides.
  const handleDragStart = (element: PaperElement, node: Konva.Group) => {
    const state = useEditorStore.getState();
    const ids = state.selectedIds.includes(element.id)
      ? state.selectedIds
      : [element.id];
    if (!state.selectedIds.includes(element.id)) setSelectedIds([element.id]);
    const startPositions = new Map<string, { x: number; y: number }>();
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const id of ids) {
      const targetNode = nodeRefs.current.get(id);
      if (!targetNode) continue;
      startPositions.set(id, { x: targetNode.x(), y: targetNode.y() });
      const targetElement = page.elements.find((item) => item.id === id);
      if (!targetElement) continue;
      const box = elementBox(targetElement);
      left = Math.min(left, box.left);
      top = Math.min(top, box.top);
      right = Math.max(right, box.right);
      bottom = Math.max(bottom, box.bottom);
    }
    dragRef.current = {
      ids,
      startPositions,
      startDragged: { x: node.x(), y: node.y() },
      startBounds:
        Number.isFinite(left) && Number.isFinite(top)
          ? { left, top, right, bottom }
          : { left: element.x, top: element.y, right: element.x + element.width, bottom: element.y + element.height },
    };
    setActivePage(page.id);
  };

  const handleDragMove = (element: PaperElement, node: Konva.Group) => {
    const drag = dragRef.current;
    if (!drag) return;
    let dx = node.x() - drag.startDragged.x;
    let dy = node.y() - drag.startDragged.y;
    const start = drag.startBounds;
    const bounds = {
      left: start.left + dx,
      top: start.top + dy,
      right: start.right + dx,
      bottom: start.bottom + dy,
    };
    const threshold = 6 / zoom;
    const selectedSet = new Set(drag.ids);
    const others = page.elements.filter(
      (item) => item.visible && !selectedSet.has(item.id) && !item.locked,
    );
    const xCandidates: number[] = [0, page.width / 2, page.width];
    const yCandidates: number[] = [0, page.height / 2, page.height];
    for (const other of others) {
      const box = elementBox(other);
      xCandidates.push(box.left, (box.left + box.right) / 2, box.right);
      yCandidates.push(box.top, (box.top + box.bottom) / 2, box.bottom);
    }

    let snapX: { delta: number; guide: number } | null = null;
    for (const candidate of xCandidates) {
      for (const edge of [bounds.left, (bounds.left + bounds.right) / 2, bounds.right]) {
        const delta = candidate - edge;
        if (
          Math.abs(delta) <= threshold &&
          (!snapX || Math.abs(delta) < Math.abs(snapX.delta))
        ) {
          snapX = { delta, guide: candidate };
        }
      }
    }
    let snapY: { delta: number; guide: number } | null = null;
    for (const candidate of yCandidates) {
      for (const edge of [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom]) {
        const delta = candidate - edge;
        if (
          Math.abs(delta) <= threshold &&
          (!snapY || Math.abs(delta) < Math.abs(snapY.delta))
        ) {
          snapY = { delta, guide: candidate };
        }
      }
    }
    if (snapX) dx += snapX.delta;
    else if (snapToGrid && gridSize > 0) {
      dx += Math.round(bounds.left / gridSize) * gridSize - bounds.left;
    }
    if (snapY) dy += snapY.delta;
    else if (snapToGrid && gridSize > 0) {
      dy += Math.round(bounds.top / gridSize) * gridSize - bounds.top;
    }

    for (const id of drag.ids) {
      const targetNode = nodeRefs.current.get(id);
      const startPosition = drag.startPositions.get(id);
      if (!targetNode || !startPosition) continue;
      targetNode.position({
        x: startPosition.x + dx,
        y: startPosition.y + dy,
      });
    }
    showGuides(snapX?.guide ?? null, snapY?.guide ?? null);
    overlayLayerRef.current?.batchDraw();
  };

  const handleDragEnd = (element: PaperElement, node: Konva.Group) => {
    const drag = dragRef.current;
    dragRef.current = null;
    hideGuides();
    if (!drag) return;
    const updates = drag.ids
      .map((id) => {
        const targetNode = nodeRefs.current.get(id);
        if (!targetNode) return null;
        return {
          id,
          patch: {
            x: round(targetNode.x(), 2),
            y: round(targetNode.y(), 2),
          },
        };
      })
      .filter((update): update is { id: string; patch: { x: number; y: number } } =>
        Boolean(update),
      );
    if (updates.length > 0) {
      updateElements(updates, {
        historyKey: `move-${drag.ids.slice().sort().join("-")}`,
      });
    }
  };

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = transformer.nodes() as Konva.Group[];
    if (nodes.length === 0) return;
    const updates = nodes.map((node) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const width = Math.max(1, node.width() * scaleX);
      const height = Math.max(1, node.height() * scaleY);
      const rotation = ((node.rotation() % 360) + 360) % 360;
      node.scaleX(1);
      node.scaleY(1);
      return {
        id: node.id(),
        patch: {
          x: round(node.x(), 2),
          y: round(node.y(), 2),
          width: round(width, 2),
          height: round(height, 2),
          rotation: round(rotation, 1),
        },
      };
    });
    transformer.getLayer()?.batchDraw();
    updateElements(updates, {
      historyKey: `resize-${updates.map((update) => update.id).sort().join("-")}`,
    });
  };

  // Marquee selection.
  const finishMarquee = useCallback(() => {
    if (!marqueeActiveRef.current) return;
    marqueeActiveRef.current = false;
    marqueeRef.current?.visible(false);
    overlayLayerRef.current?.batchDraw();
    const box = marqueeBoxRef.current;
    marqueeBoxRef.current = null;
    marqueeStartRef.current = null;
    if (!box || box.width < 2 || box.height < 2) return;
    const selected = page.elements
      .filter((element) => element.visible)
      .filter((element) => {
        const bounds = elementBox(element);
        return (
          bounds.right >= box.x &&
          bounds.left <= box.x + box.width &&
          bounds.bottom >= box.y &&
          bounds.top <= box.y + box.height
        );
      })
      .map((element) => element.id);
    const current = useEditorStore.getState().selectedIds;
    const next = marqueeAdditiveRef.current
      ? Array.from(new Set([...current, ...selected]))
      : selected;
    setSelectedIds(next);
  }, [page.elements, setSelectedIds]);

  const finishMarqueeRef = useRef(finishMarquee);
  finishMarqueeRef.current = finishMarquee;

  useEffect(() => {
    const onPointerUp = () => finishMarqueeRef.current();
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, []);

  const pagePointer = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return { x: pointer.x / zoom, y: pointer.y / zoom };
  };

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (event.target !== event.target.getStage()) return;
    if (event.evt.button !== 0) return;
    if (tool !== "select") return;
    event.cancelBubble = false;
    setActivePage(page.id);
    const point = pagePointer(event.target.getStage() as Konva.Stage);
    if (!point) return;
    const additive = Boolean(event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey);
    marqueeAdditiveRef.current = additive;
    if (!additive) setSelectedIds([]);
    marqueeActiveRef.current = true;
    marqueeStartRef.current = point;
    marqueeBoxRef.current = { x: point.x, y: point.y, width: 0, height: 0 };
    const rect = marqueeRef.current;
    if (rect) {
      rect.visible(true);
      rect.position({ x: point.x, y: point.y });
      rect.size({ width: 0, height: 0 });
      overlayLayerRef.current?.batchDraw();
    }
  };

  const handleStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marqueeActiveRef.current) return;
    const stage = event.target.getStage();
    if (!stage) return;
    const point = pagePointer(stage);
    const start = marqueeStartRef.current;
    if (!point || !start) return;
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.abs(point.x - start.x);
    const height = Math.abs(point.y - start.y);
    marqueeBoxRef.current = { x, y, width, height };
    const rect = marqueeRef.current;
    if (rect) {
      rect.position({ x, y });
      rect.size({ width, height });
      overlayLayerRef.current?.batchDraw();
    }
  };

  const handleStageMouseUp = () => {
    finishMarquee();
  };

  // Capture a compact thumbnail from the first page when the document settles.
  const updatedAt = document.updatedAt;
  useEffect(() => {
    if (!isFirst || editingId) return;
    const timer = window.setTimeout(() => {
      const stage = stageRef.current;
      const overlay = overlayLayerRef.current;
      if (!stage || !overlay) return;
      if (page.source && !sourceImage) return;
      overlay.hide();
      stage.draw();
      try {
        const pixelRatio = Math.max(0.02, 240 / Math.max(1, page.width * zoom));
        const dataUrl = stage.toDataURL({
          pixelRatio,
          mimeType: "image/png",
        });
        void setThumbnail(document.id, dataUrl);
      } catch {
        // Thumbnails are a convenience; editing must continue if capture fails.
      } finally {
        overlay.show();
        stage.draw();
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [
    isFirst,
    editingId,
    updatedAt,
    document.id,
    page.id,
    page.source,
    page.background,
    page.elements,
    page.width,
    page.height,
    sourceImage,
    setThumbnail,
    zoom,
  ]);

  const editingElement = editingId
    ? (page.elements.find((element) => element.id === editingId) as TextElement | undefined)
    : undefined;

  const gridStyle = showGrid
    ? {
        backgroundImage: `linear-gradient(to right, rgba(38,82,73,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(38,82,73,0.10) 1px, transparent 1px)`,
        backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
      }
    : undefined;

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-page-index={index}
      data-page-id={page.id}
    >
      <div className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground/60">
        <span className={cn(active && "text-forge-700 dark:text-forge-300")}>
          Page {String(index + 1).padStart(2, "0")}
        </span>
        {active && <span className="size-1 rounded-full bg-forge-600 dark:bg-forge-300" />}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-[2px] ring-1 transition-shadow",
          active
            ? "paper-shadow ring-forge-600/25 dark:ring-forge-300/20"
            : "paper-shadow ring-black/5",
        )}
        style={{
          width: page.width * zoom,
          height: page.height * zoom,
          backgroundColor: page.background,
          ...gridStyle,
        }}
      >
        <Stage
          ref={stageRef}
          width={page.width * zoom}
          height={page.height * zoom}
          scaleX={zoom}
          scaleY={zoom}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
        >
          <Layer listening={false}>
            {sourceImage && (
              <KonvaImage
                image={sourceImage}
                x={0}
                y={0}
                width={page.width}
                height={page.height}
                listening={false}
                perfectDrawEnabled={false}
              />
            )}
          </Layer>
          <Layer>
            {page.elements.map((element) => (
              <ElementNode
                key={element.id}
                element={element}
                selected={selectedIds.includes(element.id) && active}
                editing={editingId === element.id}
                interactive={tool === "select" && !isEditingPage}
                onSelect={handleSelect}
                onStartEdit={startEditing}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                registerNode={getNodeCallback(element.id)}
              />
            ))}
          </Layer>
          <Layer ref={overlayLayerRef}>
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              flipEnabled={false}
              anchorSize={7 / zoom}
              anchorCornerRadius={1.5 / zoom}
              anchorStrokeWidth={1 / zoom}
              borderStrokeWidth={1 / zoom}
              borderStroke="#2b6559"
              anchorStroke="#2b6559"
              anchorFill="#ffffff"
              rotateAnchorOffset={18 / zoom}
              padding={2 / zoom}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 4 || newBox.height < 4 ? oldBox : newBox
              }
              onTransformEnd={handleTransformEnd}
            />
            <Rect
              ref={marqueeRef}
              visible={false}
              fill="rgba(43,101,89,0.08)"
              stroke="#2b6559"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 3 / zoom]}
              listening={false}
            />
            <Line
              ref={guideXRef}
              visible={false}
              stroke="#2b6559"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 4 / zoom]}
              listening={false}
            />
            <Line
              ref={guideYRef}
              visible={false}
              stroke="#2b6559"
              strokeWidth={1 / zoom}
              dash={[4 / zoom, 4 / zoom]}
              listening={false}
            />
          </Layer>
        </Stage>

        {page.source && source.loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/45">
            <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] text-muted-foreground shadow-sm">
              <Loader2 className="size-3 animate-spin" />
              Rendering source page
            </span>
          </div>
        )}
        {page.source && (source.error || sourceFailed) && (
          <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[9px] text-amber-800 shadow-sm ring-1 ring-amber-200">
            <AlertTriangle className="size-3" />
            Source preview unavailable
          </div>
        )}

        {editingElement && (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.max(24, event.currentTarget.scrollHeight)}px`;
            }}
            onBlur={() => stopEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (editingRef.current) editingRef.current.cancelled = true;
                stopEditing(false);
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                stopEditing(true);
              }
            }}
            className="absolute z-30 resize-none overflow-hidden rounded-[2px] border border-forge-600/60 bg-transparent shadow-[0_0_0_3px_rgba(43,101,89,0.10)] outline-none"
            style={{
              left: editingElement.x * zoom,
              top: editingElement.y * zoom,
              width: editingElement.width * zoom,
              minHeight: Math.max(24, editingElement.height * zoom),
              transform: `rotate(${editingElement.rotation}deg)`,
              transformOrigin: "top left",
              fontFamily: cssFontFamily(editingElement.fontFamily),
              fontSize: editingElement.fontSize * zoom,
              fontWeight: editingElement.fontWeight,
              fontStyle: editingElement.italic ? "italic" : "normal",
              textDecoration: editingElement.underline ? "underline" : "none",
              color: editingElement.color,
              textAlign: editingElement.align,
              lineHeight: editingElement.lineHeight,
              letterSpacing: editingElement.letterSpacing * zoom,
              padding: editingElement.padding * zoom,
              backgroundColor: isTransparent(editingElement.backgroundColor)
                ? "rgba(255,255,255,0.94)"
                : editingElement.backgroundColor,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}
            spellCheck
            aria-label="Edit text"
          />
        )}
      </div>
      <div className="text-[9px] text-muted-foreground/45">
        {round(page.width)} × {round(page.height)} pt
      </div>
    </div>
  );
}

function PagePlaceholder({
  page,
  index,
  zoom,
  active,
}: {
  page: PaperPage;
  index: number;
  zoom: number;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2" aria-hidden="true">
      <div className="flex h-[14px] items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground/60">
        <span className={cn(active && "text-forge-700 dark:text-forge-300")}>
          Page {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div
        className={cn(
          "relative overflow-hidden rounded-[2px] ring-1",
          active
            ? "paper-shadow ring-forge-600/25 dark:ring-forge-300/20"
            : "paper-shadow ring-black/5",
        )}
        style={{
          width: page.width * zoom,
          height: page.height * zoom,
          backgroundColor: page.background,
        }}
      >
        <div className="absolute inset-0 shimmer opacity-70" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-card/80 px-2.5 py-1 text-[9.5px] text-muted-foreground/70 shadow-sm">
            Loading page…
          </span>
        </div>
      </div>
      <div className="flex h-[12px] items-center text-[9px] text-muted-foreground/45">
        {round(page.width)} × {round(page.height)} pt
      </div>
    </div>
  );
}

function PageSlot({
  document,
  page,
  index,
  zoom,
  isFirst,
  onEditingChange,
  scrollRoot,
  registerPageRef,
}: PageStageProps & {
  scrollRoot: RefObject<HTMLDivElement>;
  registerPageRef: (pageId: string, node: HTMLDivElement | null) => void;
}) {
  const active = useEditorStore((state) => state.activePageId === page.id);
  const [mounted, setMounted] = useState(index === 0);
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (active || index === 0) setMounted(true);
  }, [active, index]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setMounted(true);
          } else if (!isFirst && !editing) {
            setMounted(false);
          }
        }
      },
      {
        root: scrollRoot.current,
        rootMargin: "900px 0px",
        threshold: 0,
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollRoot, isFirst, editing]);

  const setWrapperRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapperRef.current = node;
      registerPageRef(page.id, node);
    },
    [page.id, registerPageRef],
  );

  const handleEditingChange = useCallback(
    (value: boolean) => {
      setEditing(value);
      onEditingChange?.(value);
    },
    [onEditingChange],
  );

  return (
    <div ref={setWrapperRef}>
      {mounted ? (
        <PageStage
          document={document}
          page={page}
          index={index}
          zoom={zoom}
          isFirst={isFirst}
          onEditingChange={handleEditingChange}
        />
      ) : (
        <PagePlaceholder page={page} index={index} zoom={zoom} active={active} />
      )}
    </div>
  );
}

export function EditorCanvas({ document, className, onEditingChange }: EditorCanvasProps) {
  const zoom = useEditorStore((state) => state.zoom);
  const activePageId = useEditorStore((state) => state.activePageId);
  const scrollRequest = useEditorStore((state) => state.scrollRequest);
  const setZoom = useEditorStore((state) => state.setZoom);
  const pageRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const registerPageRef = useCallback((pageId: string, node: HTMLDivElement | null) => {
    if (node) pageRefs.current.set(pageId, node);
    else pageRefs.current.delete(pageId);
  }, []);

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, [role=button]")) {
        return;
      }
      setSpaceHeld(true);
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = useEditorStore.getState().zoom;
      setZoom(current + (event.deltaY < 0 ? 0.08 : -0.08));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  useEffect(() => {
    if (!panning) return;
    const onMove = (event: PointerEvent) => {
      const pan = panRef.current;
      const container = scrollRef.current;
      if (!pan || !container) return;
      container.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
      container.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
    };
    const onUp = () => {
      panRef.current = null;
      setPanning(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panning]);

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!(event.button === 1 || (spaceHeld && event.button === 0))) return;
    const container = scrollRef.current;
    if (!container) return;
    event.preventDefault();
    event.stopPropagation();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    setPanning(true);
  };

  useEffect(() => {
    if (!activePageId) return;
    const element = pageRefs.current.get(activePageId);
    const container = scrollRef.current;
    if (!element || !container) return;
    const top = Math.max(0, element.offsetTop - 22);
    container.scrollTo({ top, behavior: "smooth" });
  }, [scrollRequest, activePageId]);

  return (
    <div
      ref={scrollRef}
      id="editor-scroll"
      className={cn(
        "editor-canvas relative min-w-0 flex-1 overflow-auto",
        spaceHeld || panning ? "cursor-grab" : "",
        panning && "cursor-grabbing select-none",
        className,
      )}
      onPointerDownCapture={beginPan}
    >
      <div className="mx-auto flex w-max min-w-full flex-col items-center gap-10 px-8 py-10">
        {document.pages.map((page, index) => (
          <PageSlot
            key={page.id}
            document={document}
            page={page}
            index={index}
            zoom={zoom}
            isFirst={index === 0}
            onEditingChange={onEditingChange}
            scrollRoot={scrollRef}
            registerPageRef={registerPageRef}
          />
        ))}
        <div className="h-16" />
      </div>
    </div>
  );
}
