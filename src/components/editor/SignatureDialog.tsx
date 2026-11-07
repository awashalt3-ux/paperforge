import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string) => void;
}

const INK_COLORS = [
  { value: "#18211f", label: "Ink" },
  { value: "#265249", label: "Forge green" },
  { value: "#1d4ed8", label: "Royal blue" },
  { value: "#7f1d1d", label: "Oxblood" },
];

const WIDTHS = [2, 3.2, 4.6];

export function SignatureDialog({ open, onOpenChange, onCapture }: SignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [lineWidth, setLineWidth] = useState(WIDTHS[1]);
  const [saving, setSaving] = useState(false);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  };

  useEffect(() => {
    if (!open) return;
    setHasInk(false);
    setSaving(false);
    const timer = window.setTimeout(resetCanvas, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = pointFromEvent(event);
    if (!canvas || !context || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(point.x, point.y);
    setHasInk(true);
  };

  const moveStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = pointFromEvent(event);
    const last = lastPointRef.current;
    if (!canvas || !context || !point || !last) return;
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.quadraticCurveTo(
      last.x,
      last.y,
      (last.x + point.x) / 2,
      (last.y + point.y) / 2,
    );
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const applySignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    setSaving(true);
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) return;
      const padding = 16;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropWidth = Math.min(width - cropX, maxX - minX + padding * 2);
      const cropHeight = Math.min(height - cropY, maxY - minY + padding * 2);
      const output = document.createElement("canvas");
      output.width = cropWidth;
      output.height = cropHeight;
      const outputContext = output.getContext("2d");
      if (!outputContext) throw new Error("Canvas unavailable");
      outputContext.drawImage(
        canvas,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );
      onCapture(output.toDataURL("image/png"));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-4 text-forge-600 dark:text-forge-300" />
            Draw a signature
          </DialogTitle>
          <DialogDescription>
            Sign with a mouse, trackpad, pen, or finger. The signature is inserted as a crisp,
            transparent image that you can resize and position.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
          <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-white">
            <canvas
              ref={canvasRef}
              width={720}
              height={260}
              className="block w-full cursor-crosshair touch-none"
              style={{ aspectRatio: "720 / 260" }}
              onPointerDown={startStroke}
              onPointerMove={moveStroke}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onPointerLeave={(event) => {
                if (drawingRef.current) endStroke(event);
              }}
              aria-label="Signature drawing area"
            />
            {!hasInk && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/55">
                <PenLine className="size-5" />
                <span className="text-[11px]">Sign here</span>
              </div>
            )}
            <span className="pointer-events-none absolute bottom-4 left-6 right-6 border-b border-dashed border-border/80" />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[11px]">Ink colour</Label>
              <div className="flex flex-wrap gap-1.5">
                {INK_COLORS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setColor(option.value)}
                    aria-label={option.label}
                    aria-pressed={color === option.value}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform hover:scale-105",
                      color === option.value
                        ? "border-foreground/70 ring-2 ring-ring/25 ring-offset-1 ring-offset-card"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: option.value }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px]">Stroke weight</Label>
              <div className="flex gap-1.5">
                {WIDTHS.map((width) => (
                  <Button
                    key={width}
                    type="button"
                    size="xs"
                    variant={lineWidth === width ? "secondary" : "outline"}
                    onClick={() => setLineWidth(width)}
                    aria-pressed={lineWidth === width}
                    className="flex-1 px-0"
                  >
                    <span
                      className="block rounded-full bg-foreground"
                      style={{ width: 16, height: width }}
                    />
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetCanvas}
              disabled={!hasInk}
              className="w-full gap-1.5"
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={applySignature} disabled={!hasInk || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Insert signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
