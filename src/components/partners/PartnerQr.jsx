"use client";

import { useMemo } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/partners";

/** Camino SVG con un cuadrado por módulo oscuro (margen de 4 módulos). */
function buildQr(text) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const margin = 4;
    let d = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
      }
    }
    return { d, total: size + margin * 2 };
  } catch {
    return null;
  }
}

/** QR del enlace del comercial, con botón para descargarlo (SVG, se imprime nítido). */
export default function PartnerQr({ value, fileName = "qr-clicyvoy.svg" }) {
  const qr = useMemo(() => buildQr(value), [value]);
  if (!qr) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.total} ${qr.total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qr.d}" fill="#000"/></svg>`;

  const download = () => downloadBlob(fileName, new Blob([svg], { type: "image/svg+xml" }));

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${qr.total} ${qr.total}`}
        shapeRendering="crispEdges"
        className="w-40 h-40 rounded-lg border border-border"
        role="img"
        aria-label="Código QR de tu enlace"
      >
        <rect width="100%" height="100%" fill="#fff" />
        <path d={qr.d} fill="#000" />
      </svg>
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={download}>
        <Download className="w-3.5 h-3.5" /> Descargar QR
      </Button>
    </div>
  );
}
