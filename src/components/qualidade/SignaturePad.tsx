/**
 * SignaturePad — canvas leve para captura de assinatura digital.
 *
 * Sem dependências externas. Suporta mouse e touch.
 * Expõe `toBlob()` e `clear()` via ref imperativo.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  toBlob: () => Promise<Blob | null>;
}

interface Props {
  height?: number;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { height = 180, className = "" },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // HiDPI setup
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f172a";
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = pointFromEvent(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = pointFromEvent(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastRef.current) return;
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (empty) setEmpty(false);
  }

  function end() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setEmpty(true);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => empty,
    clear,
    toBlob: () =>
      new Promise<Blob | null>((resolve) => {
        const c = canvasRef.current;
        if (!c) return resolve(null);
        c.toBlob((b) => resolve(b), "image/png");
      }),
  }));

  return (
    <div className={`rounded-md border bg-background ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height, touchAction: "none" }}
        className="block rounded-md"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="flex items-center justify-between px-2 py-1.5 border-t text-xs text-muted-foreground">
        <span>Assine no campo acima</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 gap-1">
          <Eraser className="h-3 w-3" /> Limpar
        </Button>
      </div>
    </div>
  );
});
