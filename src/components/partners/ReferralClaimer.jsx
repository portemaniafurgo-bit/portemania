"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { claimReferral } from "@/lib/partners";
import {
  clearRefCode,
  readStoredRefCode,
  readUrlRefCode,
  storeRefCode,
} from "@/lib/referral";

// Estado de módulo (no de componente): sobrevive a los dobles montajes del
// modo estricto, a los eventos de sesión repetidos y a la navegación.
let urlCode = null; // último ?ref= válido visto en una página de entrada
let inFlight = false;
let retryTimer = null;
let failures = 0; // intentos fallidos en esta carga de la página (del usuario actual)
let currentUserId = null; // usuario al que pertenecen retryTimer y failures
const settled = new Set(); // "usuario:código" ya resueltos en esta carga

// Reintentos tras un error no definitivo: 3 s, 10 s, 30 s, 30 s… y, tras 5
// fallos, nada más hasta la próxima carga de la página.
const BACKOFF_MS = [3_000, 10_000, 30_000];
const MAX_FAILURES = 5;

/**
 * Cambio de usuario o cierre de sesión: se cancela el reintento pendiente y
 * se reinicia la cuenta de fallos (son del usuario anterior).
 */
function switchUser(userId) {
  if (currentUserId === userId) return;
  currentUserId = userId;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  failures = 0;
}

function attempt(userId) {
  if (inFlight || retryTimer || failures >= MAX_FAILURES) return;
  const code = urlCode || readStoredRefCode();
  if (!code) return;
  const key = `${userId}:${code}`;
  if (settled.has(key)) return;

  inFlight = true;
  claimReferral(code)
    .then((result) => {
      if (result === "done") {
        settled.add(key);
        clearRefCode();
        if (urlCode === code) urlCode = null;
        return;
      }
      // La sesión cambió mientras se esperaba la respuesta: ese fallo era del
      // usuario anterior y no se programa nada.
      if (currentUserId !== userId) return;
      // "retry": se conserva el código y se reintenta con espera creciente.
      failures += 1;
      if (failures < MAX_FAILURES) {
        const wait = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)];
        retryTimer = setTimeout(() => {
          retryTimer = null;
          attempt(userId);
        }, wait);
      }
    })
    .catch(() => {})
    .finally(() => {
      inFlight = false;
    });
}

/**
 * Guarda el ?ref=<código> que llega a una página de entrada (portada, enlace
 * del comercial, registro, acceso, pedir) y, cuando hay sesión, atribuye el
 * usuario al comercial UNA vez (partner_claim_referral). Silencioso: no enseña
 * nada, nunca bloquea ni rompe el login.
 */
export default function ReferralClaimer() {
  const { isAuthenticated, user } = useAuth();
  const pathname = usePathname();
  const userId = user?.id;

  useEffect(() => {
    // readUrlRefCode ya ignora el ?ref= fuera de las páginas de entrada.
    const code = readUrlRefCode();
    if (code) {
      urlCode = code;
      storeRefCode(code);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      switchUser(null);
      return;
    }
    switchUser(userId);
    attempt(userId);
  }, [isAuthenticated, userId, pathname]);

  return null;
}
