"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PenLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Firma del receptor en el momento de la entrega.
 *
 * Obligatoria en los envíos de paquete y en las entregas para tiendas: sin ella
 * el conductor no puede cerrar el servicio. Funciona con dedo en el móvil y con
 * ratón en el escritorio.
 */
export default function SignaturePad({ defaultName = "", onConfirm, submitting }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Lienzo a resolución de pantalla: sin esto la firma sale pixelada en móvil.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  };

  const startStroke = (event) => {
    event.preventDefault();
    drawing.current = true;
    const { x, y } = pointFrom(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveStroke = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const { x, y } = pointFrom(event);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const endStroke = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirm = () => {
    if (!hasDrawn || !name.trim()) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) onConfirm({ blob, name: name.trim() });
    }, "image/png");
  };

  return (
    <div className="bg-card rounded-2xl border-2 border-primary/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-primary" />
        <p className="font-semibold text-foreground">Firma del receptor</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Este servicio se entrega firmado. Pide a quien recibe que firme en el recuadro.
      </p>

      <div className="space-y-2">
        <Label>Nombre de quien recibe</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellidos"
          className="h-11 rounded-xl"
        />
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-40 rounded-xl border-2 border-dashed border-border bg-white touch-none"
          onMouseDown={startStroke}
          onMouseMove={moveStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onTouchStart={startStroke}
          onTouchMove={moveStroke}
          onTouchEnd={endStroke}
        />
        {!hasDrawn && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
            Firma aquí
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="rounded-xl gap-2" onClick={clear} disabled={!hasDrawn}>
          <RotateCcw className="w-4 h-4" />
          Borrar
        </Button>
        <Button
          className="rounded-xl flex-1 h-12 gap-2"
          onClick={confirm}
          disabled={!hasDrawn || !name.trim() || submitting}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
          Confirmar entrega
        </Button>
      </div>
    </div>
  );
}
