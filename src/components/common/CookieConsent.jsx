"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Google Analytics 4 con consentimiento previo.
 *
 * La analítica pone cookies, y en España (AEPD / LSSI) eso exige el "sí" del
 * visitante ANTES de cargarla: por eso el script de GA solo se inyecta cuando
 * el usuario acepta. Sin NEXT_PUBLIC_GA_MEASUREMENT_ID (el G-XXXX de la
 * propiedad) no se carga nada ni se enseña el banner.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const STORAGE_KEY = "cookie_consent_v1";

function loadAnalytics() {
  if (!GA_ID || typeof window === "undefined" || window.__gaLoaded) return;
  window.__gaLoaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, { anonymize_ip: true });
}

export default function CookieConsent() {
  // null = sin decidir (se enseña el banner); "granted" | "denied".
  const [choice, setChoice] = useState("pending");

  useEffect(() => {
    if (!GA_ID) return;
    let stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (stored === "granted") loadAnalytics();
    setChoice(stored || null);
  }, []);

  const decide = (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    setChoice(value);
    if (value === "granted") loadAnalytics();
  };

  if (!GA_ID || choice !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <p className="text-sm text-foreground">
        Usamos cookies de análisis (Google Analytics) para saber cómo se usa la web y mejorarla.
        Puedes aceptarlas o seguir solo con las necesarias.{" "}
        <Link href="/privacidad" className="text-primary underline">
          Más información
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("granted")}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Aceptar
        </button>
        <button
          type="button"
          onClick={() => decide("denied")}
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Solo necesarias
        </button>
      </div>
    </div>
  );
}
