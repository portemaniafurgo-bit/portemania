import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "./supabase";
import { euro } from "./money";

/**
 * ClicyVoy Partners (comerciales) en la app. Es una copia de la lógica de la
 * web (`src/lib/partners.js` y `src/lib/referral.js`), no un import: la app
 * empaqueta solo lo suyo.
 *
 * Todo pasa por las funciones de la base de datos (migración 0028); las tablas
 * son de solo lectura. Las funciones responden {ok:false, reason} cuando
 * rechazan algo: el texto para la persona sale SIEMPRE de reasonMessage().
 *
 * ⚠️ La app está publicada con una base de datos que puede no tener todavía
 * estos objetos. Todo degrada en silencio: sin la fila `partner_program` no se
 * enseña nada del programa, y sin las funciones el panel muestra una pantalla
 * neutra («no disponible»).
 *
 * Las llamadas van escritas con su nombre literal (`supabase.rpc("…")`,
 * `.from("…").select("…")`) para que `npm run check:db` las vea.
 */

export const PROGRAM_KEY = "partner_program";
export const SITE_URL = "https://clicyvoy.es";

// Misma regla que el servidor: 3–30 de minúsculas, cifras y guiones, con al
// menos 3 letras o cifras seguidas.
const SLUG_SHAPE = /^[a-z0-9-]{3,30}$/;
const SLUG_CORE = /[a-z0-9]{3}/;

export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG_SHAPE.test(slug) && SLUG_CORE.test(slug);
}

/** Normaliza y valida la forma del código. Devuelve el código o null. */
export function normalizeRefCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  return isValidSlug(code) ? code : null;
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// Únicos dominios de los que se acepta un enlace pegado.
const INVITE_HOSTS = new Set(["clicyvoy.es", "www.clicyvoy.es", "clicyvoy.vercel.app"]);
// "dominio[:puerto][/ruta?consulta#…]", con o sin http(s):// delante.
const URL_LIKE = /^(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?([/?#][^\s]*)?$/i;

/**
 * Código de invitación escrito o pegado por la persona: el código a secas
 * («laura-garcia») o un enlace de ClicyVoy (clicyvoy.es, www.clicyvoy.es o
 * clicyvoy.vercel.app) con /comercial/<código> o ?ref=<código>. Cualquier otra
 * cosa se trata como código a secas y tiene que cumplir la forma del servidor.
 * Devuelve el código con forma válida o null.
 */
export function parseInviteCode(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const url = raw.match(URL_LIKE);
  if (url && INVITE_HOSTS.has(url[1].toLowerCase())) {
    const rest = url[2] || "";
    const path = rest.match(/^\/comercial\/([^/?#]+)/i);
    if (path) return normalizeRefCode(safeDecode(path[1]));
    const ref = rest.match(/[?&]ref=([^&#]+)/i);
    if (ref) return normalizeRefCode(safeDecode(ref[1]));
    return null;
  }
  return normalizeRefCode(raw);
}

/**
 * Valores por defecto de partner_program_settings() en el servidor: se usan
 * SOLO cuando una clave falta o es ilegible, igual que allí.
 */
export const PROGRAM_DEFAULTS = {
  enabled: true,
  first_pct: 5,
  repeat_pct: 2,
  hold_days: 15,
  min_payout: 20,
  payout_interval_days: 30,
  claim_window_days: 30,
  hold_same_driver: true,
  max_price_quote_ratio: 2,
  max_auto_base: 300,
  max_auto_cash_base: 150,
};

// clave: [mínimo, máximo], los del servidor.
const PROGRAM_RANGES = {
  first_pct: [0, 50],
  repeat_pct: [0, 50],
  hold_days: [0, 365],
  min_payout: [0, 100000],
  payout_interval_days: [0, 365],
  claim_window_days: [0, 3650],
  max_price_quote_ratio: [1, 100],
  max_auto_base: [0, 100000],
  max_auto_cash_base: [0, 100000],
};

/** Sí/no como lo lee el servidor: booleano o el texto "true"/"false". */
function readProgramBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

/**
 * Ajustes saneados igual que partner_program_settings(): fila ausente o que no
 * es un objeto = null (programa apagado). "enabled" ausente = encendido;
 * ilegible = apagado. Números fuera de rango o ilegibles = valor por defecto.
 */
export function normalizeProgram(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = { ...PROGRAM_DEFAULTS };
  if ("enabled" in value) out.enabled = readProgramBool(value.enabled, false);
  const hold = value.hold_same_driver ?? value.hold_same_driver_cash;
  if (hold !== undefined && hold !== null) out.hold_same_driver = readProgramBool(hold, true);
  for (const [key, [min, max]] of Object.entries(PROGRAM_RANGES)) {
    const text = String(value[key] ?? "").trim();
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(text)) {
      const n = Number(text);
      if (n >= min && n <= max) out[key] = n;
    }
  }
  return out;
}

// ------------------------------------------------------------
// Textos
// ------------------------------------------------------------

/** Importe con dos decimales siempre («12,50 €», «20,00 €»): son comisiones. */
export function formatEuro(value) {
  return euro(value, 2);
}

/**
 * Fecha legible. "AAAA-MM-DD" (fecha sin hora) se construye con sus números,
 * como ese día en hora local: leída como texto sería medianoche UTC y en
 * España podría caer el día anterior.
 */
export function formatDate(value, pattern = "d MMM yyyy") {
  if (!value) return "—";
  try {
    let date;
    const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
    if (m) date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
    else date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return format(date, pattern, { locale: es });
  } catch {
    return "—";
  }
}

/** Mes corto de un "AAAA-MM" para las barras: «nov». */
export function formatMonth(value) {
  const m = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})/) : null;
  if (!m) return "";
  try {
    return format(new Date(Number(m[1]), Number(m[2]) - 1, 1, 12), "MMM", { locale: es });
  } catch {
    return "";
  }
}

export function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

/** Enlace público del comercial (siempre el dominio real). */
export function partnerLink(slug) {
  return `${SITE_URL}/comercial/${slug}`;
}

/** "clicyvoy.es/comercial/<slug>" para enseñar en pantalla. */
export function partnerLinkLabel(slug) {
  return `${SITE_URL.replace(/^https?:\/\//, "")}/comercial/${slug || "tu-nombre"}`;
}

/** Propuesta de nombre de enlace a partir del nombre público. */
export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/** Texto en español para cada motivo de rechazo de las funciones. */
export function reasonMessage(reason, extra = {}) {
  switch (reason) {
    case "not_authenticated":
      return "Tu sesión ha caducado. Vuelve a entrar e inténtalo de nuevo.";
    case "disabled":
      return "El programa de comerciales no está disponible ahora mismo.";
    case "already_partner":
      return "Ya tienes un perfil de comercial.";
    case "bad_name":
      return "Escribe un nombre de entre 2 y 60 caracteres.";
    case "bad_slug":
      return "El nombre del enlace solo puede llevar minúsculas, números y guiones (de 3 a 30), con al menos 3 letras o números seguidos.";
    case "reserved_slug":
      return "Ese nombre de enlace no se puede usar. Prueba con otro.";
    case "slug_taken":
      return "Ese nombre de enlace ya lo usa otra persona. Prueba con otro.";
    case "not_partner":
      return "Todavía no tienes perfil de comercial.";
    case "bad_holder":
      return "Escribe el nombre completo del titular de la cuenta.";
    case "bad_iban":
      return "El IBAN no parece correcto. Revísalo (en España empieza por ES y lleva 22 números).";
    case "inactive":
      return "Tu perfil de comercial está bloqueado. Escríbenos si crees que es un error.";
    case "no_payout_data":
      return "Antes de pedir el cobro, añade el titular y el IBAN de tu cuenta.";
    case "pending_request":
      return "Ya tienes una solicitud de cobro en curso. Te avisaremos cuando esté pagada.";
    case "too_soon":
      if (!extra.next_request_at) return "Todavía no puedes pedir otro cobro.";
      return `${
        Number(extra.interval_days) > 0
          ? `Solo se puede pedir un cobro cada ${extra.interval_days} días.`
          : "Todavía no puedes pedir otro cobro."
      } Podrás pedir el siguiente el ${formatDate(extra.next_request_at, "d 'de' MMMM")}.`;
    case "below_minimum":
      return `Necesitas al menos ${formatEuro(extra.min_payout ?? PROGRAM_DEFAULTS.min_payout)} disponibles para pedir el cobro.`;
    case "unknown_code":
      return "Ese enlace de invitación no existe o ya no está activo.";
    case "already_referred":
      return "Esta cuenta ya está asociada a otro comercial.";
    case "own_link":
      return "No puedes usar tu propio enlace.";
    case "has_orders":
      return "Esta cuenta ya tenía pedidos antes de usar el enlace.";
    case "not_new":
      return "El enlace solo vale para cuentas nuevas.";
    default:
      return "No se ha podido completar. Inténtalo de nuevo en un momento.";
  }
}

// ------------------------------------------------------------
// Errores
// ------------------------------------------------------------

/**
 * true si el error es que la función o la tabla aún no existen en la base de
 * datos (migración sin aplicar): PostgREST responde PGRST202/PGRST205 o 404,
 * Postgres 42883/42P01.
 */
export function isMissingBackend(err) {
  if (!err) return false;
  const code = String(err.code || "");
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code)) return true;
  if (err.status === 404) return true;
  return /could not find the (function|table)|does not exist/i.test(String(err.message || ""));
}

function toError(error, status) {
  const err = new Error(error?.message || "Error de conexión");
  err.code = error?.code;
  err.status = status;
  err.missing = isMissingBackend({ code: error?.code, status, message: error?.message });
  return err;
}

/** Comprueba la respuesta de supabase-js: lanza un error legible o devuelve data. */
function unwrap({ data, error, status }) {
  if (error) throw toError(error, status);
  return data;
}

/** Normaliza la respuesta {ok, reason} de una función que modifica algo. */
function toAction(data) {
  if (data && data.ok) return { ok: true, data };
  const reason = data?.reason || "unknown";
  return { ok: false, reason, message: reasonMessage(reason, data || {}), data };
}

// ------------------------------------------------------------
// Ajustes del programa y "¿está instalado?"
// ------------------------------------------------------------

// fetchProgramSettings() está al final del fichero (ver la nota de allí).

// Respuesta guardada en memoria para toda la sesión de la app: true/false SOLO
// tras una lectura correcta. Un error no se guarda (se vuelve a probar).
// settingsCache: undefined = no se sabe; null = fila ausente; objeto = ajustes
// saneados.
let installedCache = null;
let settingsCache = undefined;
let installedPending = null;

/** true si la fila partner_program existe; null si no se ha podido saber. */
export async function checkProgramInstalled() {
  if (installedCache !== null) return installedCache;
  if (!installedPending) {
    installedPending = fetchProgramSettings()
      .then(settings => {
        settingsCache = settings;
        installedCache = !!settings;
        return installedCache;
      })
      .catch(() => null)
      .finally(() => {
        installedPending = null;
      });
  }
  return installedPending;
}

function isEnabledNow() {
  return installedCache === true && settingsCache?.enabled === true;
}

/**
 * true cuando el programa está instalado Y encendido (`enabled` saneado como
 * en el servidor). Mientras no se sabe, o si la lectura falla, false.
 */
export function useProgramEnabled() {
  const [enabled, setEnabled] = useState(isEnabledNow());
  useEffect(() => {
    let active = true;
    checkProgramInstalled().then(() => {
      if (active) setEnabled(isEnabledNow());
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}

/**
 * true cuando el programa está instalado y su fila se puede leer. Mientras no
 * se sabe, o si la lectura falla, false: la fila del menú no aparece.
 */
export function useProgramInstalled() {
  const [installed, setInstalled] = useState(installedCache === true);
  useEffect(() => {
    let active = true;
    checkProgramInstalled().then(value => {
      if (active) setInstalled(value === true);
    });
    return () => {
      active = false;
    };
  }, []);
  return installed;
}

// ------------------------------------------------------------
// Panel del comercial
// ------------------------------------------------------------

/** Por qué no se puede pedir el cobro ahora (null si se puede). */
function requestBlock(d, now) {
  if (d.can_request) return null;
  const s = d.settings || {};
  if (d.partner?.status !== "active") return { reason: "inactive", text: reasonMessage("inactive") };
  if (d.has_open_payout) return { reason: "pending_request", text: reasonMessage("pending_request") };
  if (!d.payout_data?.present) return { reason: "no_payout_data", text: reasonMessage("no_payout_data") };
  if (d.next_request_at && new Date(d.next_request_at).getTime() > now) {
    return {
      reason: "too_soon",
      text: reasonMessage("too_soon", {
        next_request_at: d.next_request_at,
        interval_days: s.payout_interval_days,
      }),
    };
  }
  return {
    reason: "below_minimum",
    text: reasonMessage("below_minimum", { min_payout: s.min_payout }),
  };
}

/**
 * Panel del comercial: el objeto de partner_dashboard() más `request_block`
 * ({reason, text} o null). Si no es comercial: {ok:false, reason:'not_partner'};
 * sin la migración: {ok:false, reason:'not_installed'} (pantalla neutra).
 */
export async function fetchDashboard() {
  let data;
  try {
    data = unwrap(await supabase.rpc("partner_dashboard"));
  } catch (err) {
    if (err.missing) return { ok: false, reason: "not_installed" };
    throw err;
  }
  if (!data?.ok) return data || { ok: false, reason: "unknown" };
  // Lectura defensiva: nunca "undefined días" si falta un ajuste.
  const settings = { ...PROGRAM_DEFAULTS, ...normalizeProgram(data.settings || {}) };
  const out = { ...data, settings };
  return { ...out, request_block: requestBlock(out, Date.now()) };
}

export async function fetchClients() {
  const data = unwrap(await supabase.rpc("partner_clients"));
  return Array.isArray(data) ? data : [];
}

export async function fetchCommissions(limit = 200) {
  const data = unwrap(await supabase.rpc("partner_commission_list", { p_limit: limit }));
  return Array.isArray(data) ? data : [];
}

// fetchMyPayouts() está al final del fichero (ver la nota de allí).

export async function activatePartner(displayName, slug) {
  const data = unwrap(
    await supabase.rpc("partner_activate", { p_display_name: displayName, p_slug: slug }),
  );
  return toAction(data);
}

export async function updatePayoutData(holder, iban) {
  const data = unwrap(
    await supabase.rpc("partner_update_payout_data", { p_holder: holder, p_iban: iban }),
  );
  return toAction(data);
}

export async function requestPayout() {
  const data = unwrap(await supabase.rpc("partner_request_payout"));
  return toAction(data);
}

// ------------------------------------------------------------
// Código de invitación (atribución de un cliente nuevo)
// ------------------------------------------------------------

const CLAIM_TIMEOUT_MS = 8000;

/**
 * Atribuye el usuario con sesión al comercial del código. Nunca lanza.
 * Devuelve { result, reason }:
 *  - result "done": respuesta definitiva (ok o cualquier motivo);
 *  - result "retry": sin respuesta en 8 s, error de red, funciones aún sin
 *    instalar o sesión no aceptada: se puede reintentar más tarde.
 */
export async function claimReferral(code) {
  let timer = null;
  try {
    const res = await Promise.race([
      supabase.rpc("partner_claim_referral", { p_code: code }),
      new Promise(resolve => {
        timer = setTimeout(() => resolve({ timedOut: true }), CLAIM_TIMEOUT_MS);
      }),
    ]);
    if (res?.timedOut || res?.error) return { result: "retry", reason: null };
    const data = res?.data;
    if (data?.ok) return { result: "done", reason: "ok" };
    if (!data?.reason || data.reason === "not_authenticated") return { result: "retry", reason: null };
    return { result: "done", reason: data.reason };
  } catch {
    return { result: "retry", reason: null };
  } finally {
    clearTimeout(timer);
  }
}

// Un código pendiente POR USUARIO: así nunca se toca (ni se borra) el de otra
// cuenta que haya usado este móvil.
const PENDING_PREFIX = "partner_ref_pending_v1:";
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function pendingKey(userId) {
  return `${PENDING_PREFIX}${userId}`;
}

/** Guarda un código que no se pudo enviar, para reintentarlo más tarde. */
export async function savePendingReferral(userId, code) {
  const valid = normalizeRefCode(code);
  if (!userId || !valid) return;
  try {
    await AsyncStorage.setItem(
      pendingKey(userId),
      JSON.stringify({ code: valid, expires: Date.now() + PENDING_TTL_MS }),
    );
  } catch {}
}

/** Borra el código pendiente de ESTE usuario (solo el suyo). */
export async function clearPendingReferral(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(pendingKey(userId));
  } catch {}
}

// Usuarios con un intento en marcha (no se lanzan dos a la vez).
const claimsInFlight = new Set();

/**
 * Envía el código de este usuario y, si hay respuesta definitiva, borra su
 * pendiente. Devuelve "done", "retry" o "busy" (ya había un intento en
 * marcha). Nunca lanza.
 */
export async function claimAndSettle(userId, code) {
  if (!userId || !code) return "retry";
  if (claimsInFlight.has(userId)) return "busy";
  claimsInFlight.add(userId);
  try {
    const { result } = await claimReferral(code);
    if (result === "done") await clearPendingReferral(userId);
    return result;
  } catch {
    return "retry";
  } finally {
    claimsInFlight.delete(userId);
  }
}

// Usuarios cuyo código guardado ya se ha intentado en este arranque.
const retriedThisLaunch = new Set();

/**
 * Al abrir la app con sesión: si hay un código pendiente de ESTE usuario (y no
 * ha caducado), se reintenta una vez por arranque. Solo cuenta como intentado
 * cuando de verdad había un código suyo y se ha enviado. Una respuesta
 * definitiva lo borra; otro fallo de red lo deja para el siguiente arranque.
 * Silencioso: nunca lanza.
 */
export async function retryPendingReferral(userId) {
  if (!userId || retriedThisLaunch.has(userId)) return;
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return;
    let pending = null;
    try {
      pending = JSON.parse(raw);
    } catch {}
    const code = normalizeRefCode(pending?.code);
    if (!code || !(Number(pending?.expires) > Date.now())) {
      await clearPendingReferral(userId);
      return;
    }
    if (retriedThisLaunch.has(userId)) return;
    const result = await claimAndSettle(userId, code);
    if (result !== "busy") retriedThisLaunch.add(userId);
  } catch {}
}

// ------------------------------------------------------------
// Lecturas directas de tablas
// ------------------------------------------------------------
// ⚠️ Van juntas y AL FINAL a propósito: `scripts/check-db-usage.js` empareja
// cada lectura de tabla (from) con los select/eq/order que la siguen hasta la
// próxima lectura o el final del fichero, en una ventana de 900 caracteres.
// Lejos unas de otras, las columnas de app_settings y partner_payouts no se
// comprobaban.

/**
 * Ajustes del programa (app_settings, lectura pública), saneados como en el
 * servidor. null si la fila falta: el programa cuenta como apagado y no se
 * enseñan porcentajes.
 */
export async function fetchProgramSettings() {
  const data = unwrap(
    await supabase.from("app_settings").select("value").eq("key", PROGRAM_KEY).maybeSingle(),
  );
  return normalizeProgram(data?.value);
}

/**
 * Historial de cobros del propio comercial (lectura directa con RLS). Se
 * filtra por SU comercial: el admin, que también puede ser comercial, lee
 * todas las filas por RLS.
 */
export async function fetchMyPayouts(userId) {
  if (!userId) return [];
  const partner = unwrap(
    await supabase.from("partners").select("id").eq("user_id", userId).maybeSingle(),
  );
  if (!partner) return [];
  const data = unwrap(
    await supabase
      .from("partner_payouts")
      .select("id, amount, status, requested_at, resolved_at, note")
      .eq("partner_id", partner.id)
      .order("requested_at", { ascending: false })
      .limit(100),
  );
  return data || [];
}
