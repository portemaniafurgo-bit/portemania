"use client";

import { Smartphone } from "lucide-react";

/**
 * «¿Quieres negociar el precio? Eso vive en la app.»
 *
 * Decisión de negocio (27/08/2026): la negociación de precios se quita de la
 * web y queda solo en la app Android — es lo que empuja la descarga. La web se
 * queda con el flujo clásico a precio cerrado y este banner en su lugar.
 */
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.clicyvoy.app";

export default function AppBanner({ text }) {
  return (
    <a
      href={PLAY_URL}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          {text || "¿Quieres proponer tu precio y negociar con los conductores?"}
        </p>
        <p className="text-xs text-muted-foreground">
          Descarga la app de ClicyVoy: la negociación en vivo solo está ahí.
        </p>
      </div>
      {/* Insignia oficial de Google Play (SVG propio: la imagen externa la
          bloquearía el CSP y las marcas de Google piden usar su insignia) */}
      <span className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2">
        <svg viewBox="0 0 512 512" className="w-5 h-5" aria-hidden="true">
          <path fill="#00d7fe" d="M99 34l229 132-51 51L60 44c10-11 25-15 39-10z" />
          <path fill="#00f076" d="M60 44l217 173-51 51L47 78c-3-13 2-26 13-34z" />
          <path fill="#ffce00" d="M328 166l84 48c22 13 22 45 0 58l-84 48-63-77z" />
          <path fill="#fd3a6a" d="M47 434l179-166 51 51L99 478c-14 5-29 1-39-10z" />
        </svg>
        <span className="text-left leading-tight">
          <span className="block text-[9px] uppercase tracking-wide text-white/70">Disponible en</span>
          <span className="block text-sm font-semibold text-white">Google Play</span>
        </span>
      </span>
    </a>
  );
}
