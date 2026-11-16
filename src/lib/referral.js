/**
 * Código de invitación de un comercial (ClicyVoy Partners).
 *
 * Quien llega por clicyvoy.es/comercial/<código> o con ?ref=<código> en
 * cualquier URL queda "invitado" por ese comercial hasta que inicia sesión.
 * El código se guarda en el navegador (sessionStorage + localStorage, 30 días)
 * y NO en una cookie: es estrictamente funcional, sirve para atribuir el
 * servicio que el visitante ha pedido. Además viaja en la URL de vuelta del
 * login con Google (`withRef`), igual que el pedido en curso viaja en
 * requestIntent.js, para que funcione aunque el almacenamiento esté bloqueado.
 */

export const REFERRAL_KEY = "clicyvoy_ref_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Misma forma que exige el servidor: 3–30 de minúsculas, cifras y guiones, con
// al menos 3 letras o cifras seguidas.
const SLUG_RE = /^[a-z0-9-]{3,30}$/;
const SLUG_CORE = /[a-z0-9]{3}/;

/** Normaliza y valida la forma del código. Devuelve el código o null. */
export function normalizeRefCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return SLUG_RE.test(code) && SLUG_CORE.test(code) ? code : null;
}

/**
 * Páginas en las que se acepta un ?ref=: las de entrada (portada, enlace del
 * comercial, registro, acceso de clientes y pedir). En el resto se ignora.
 */
export function acceptsRefOn(pathname) {
  const p = String(pathname || "");
  return (
    p === "/" ||
    p.startsWith("/comercial/") ||
    p === "/register" ||
    p === "/login-clientes" ||
    p === "/solicitar" ||
    p === "/new-request" ||
    // Vuelta del login con Google sin pedido en curso (lleva ?ref= por si el
    // navegador bloquea el almacenamiento).
    p === "/dashboard"
  );
}

function storages() {
  if (typeof window === "undefined") return [];
  const out = [];
  try {
    if (window.sessionStorage) out.push(window.sessionStorage);
  } catch {}
  try {
    if (window.localStorage) out.push(window.localStorage);
  } catch {}
  return out;
}

/** Guarda el código (si tiene forma válida) con caducidad de 30 días. */
export function storeRefCode(value) {
  const code = normalizeRefCode(value);
  if (!code) return null;
  const payload = JSON.stringify({ code, expires: Date.now() + TTL_MS });
  for (const s of storages()) {
    try {
      s.setItem(REFERRAL_KEY, payload);
    } catch {}
  }
  return code;
}

/** Código guardado y vigente, o null. Borra lo caducado o mal formado. */
export function readStoredRefCode() {
  for (const s of storages()) {
    let raw = null;
    try {
      raw = s.getItem(REFERRAL_KEY);
    } catch {
      continue;
    }
    if (!raw) continue;
    try {
      const { code, expires } = JSON.parse(raw);
      const valid = normalizeRefCode(code);
      if (valid && Number(expires) > Date.now()) return valid;
    } catch {}
    try {
      s.removeItem(REFERRAL_KEY);
    } catch {}
  }
  return null;
}

export function clearRefCode() {
  for (const s of storages()) {
    try {
      s.removeItem(REFERRAL_KEY);
    } catch {}
  }
}

/** Código presente en la URL actual (?ref=), validado y en una página de entrada, o null. */
export function readUrlRefCode() {
  if (typeof window === "undefined") return null;
  try {
    if (!acceptsRefOn(window.location.pathname)) return null;
    return normalizeRefCode(new URLSearchParams(window.location.search).get("ref"));
  } catch {
    return null;
  }
}

/** Código vigente: el de la URL actual o, si no hay, el guardado. */
export function currentRefCode() {
  return readUrlRefCode() || readStoredRefCode();
}

/**
 * Añade ?ref=<código> a una ruta (relativa o absoluta) si hay un código
 * vigente y la ruta no lo lleva ya. Sin código, devuelve la ruta tal cual.
 */
export function withRef(path, code = currentRefCode()) {
  const valid = normalizeRefCode(code);
  if (!valid || !path) return path;
  try {
    const isAbsolute = /^https?:\/\//i.test(path);
    const url = new URL(path, "https://x.invalid");
    if (url.searchParams.has("ref")) return path;
    url.searchParams.set("ref", valid);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
}
