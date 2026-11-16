"use client";

import { supabase } from "@/lib/entities";
import { SITE_URL } from "@/lib/blog";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Acceso a ClicyVoy Partners (comerciales) desde el navegador.
 *
 * Todo pasa por las funciones de la base de datos (migración 0028); las
 * tablas son de solo lectura. Las funciones responden {ok:false, reason} cuando
 * rechazan algo: el texto para la persona sale SIEMPRE de reasonMessage().
 * Las del admin lanzan un error si quien llama no es admin.
 */

export const PROGRAM_KEY = "partner_program";
// Misma regla que el servidor: 3–30 de minúsculas, cifras y guiones, con al
// menos 3 letras o cifras seguidas.
const SLUG_SHAPE = /^[a-z0-9-]{3,30}$/;
const SLUG_CORE = /[a-z0-9]{3}/;
export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG_SHAPE.test(slug) && SLUG_CORE.test(slug);
}

/**
 * Valores por defecto de partner_program_settings() en el servidor (migración
 * 0028): se usan SOLO cuando una clave falta o es ilegible, igual que allí.
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
export const PROGRAM_RANGES = {
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
export function readProgramBool(value, fallback) {
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

export function formatEuro(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function formatDate(value, pattern = "d MMM yyyy") {
  if (!value) return "—";
  try {
    // "AAAA-MM-DD" (fecha sin hora): se lee como ese día en hora local, no
    // como medianoche UTC (que en otro huso caería el día anterior).
    const date =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T12:00:00`)
        : new Date(value);
    return format(date, pattern, { locale: es });
  } catch {
    return "—";
  }
}

export function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} %`;
}

/** Enlace público del comercial (siempre el dominio real, no el de pruebas). */
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
    .replace(/[\u0300-\u036f]/g, "")
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
      return `Necesitas al menos ${formatEuro(extra.min_payout ?? 20)} disponibles para pedir el cobro.`;
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
    case "bad_action":
      return "Acción no válida.";
    case "not_found":
      return "No se ha encontrado. Recarga la página.";
    case "not_requested":
      return "Esta solicitud ya estaba resuelta. Recarga la lista.";
    case "bad_status":
      return "Esta comisión ya no está retenida ni pendiente. Recarga la lista.";
    case "no_user":
      return "Este comercial borró su cuenta: no se puede reactivar.";
    default:
      return "No se ha podido completar. Inténtalo de nuevo en un momento.";
  }
}

// ------------------------------------------------------------
// Llamadas
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

/** Texto para una pantalla de admin que no ha podido cargar (sin el texto técnico). */
export function friendlyError(err, what = "los datos") {
  if (!err) return `No se han podido cargar ${what}.`;
  if (err.missing || isMissingBackend(err)) {
    return "El programa de comerciales todavía no está instalado en la base de datos.";
  }
  if (/solo el administrador/i.test(String(err.message || ""))) {
    return "Solo el administrador puede ver esto.";
  }
  if (!err.code && !err.status) {
    return `No se han podido cargar ${what}. Revisa tu conexión e inténtalo de nuevo.`;
  }
  return `No se han podido cargar ${what}. Inténtalo de nuevo en un momento.`;
}

/** Texto para una acción del admin que ha fallado (sin el texto técnico). */
export function friendlyActionError(err) {
  if (err?.friendly) return err.message;
  if (err?.missing || isMissingBackend(err)) {
    return "El programa de comerciales todavía no está instalado en la base de datos.";
  }
  if (/solo el administrador/i.test(String(err?.message || ""))) {
    return "Solo el administrador puede hacer esto.";
  }
  if (!err?.code && !err?.status) return "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.";
  return "No se ha podido completar. Inténtalo de nuevo en un momento.";
}

async function rpc(name, params) {
  const { data, error, status } = await supabase.rpc(name, params);
  if (error) throw toError(error, status);
  return data;
}

/** Normaliza la respuesta {ok, reason} de una función que modifica algo. */
async function action(name, params) {
  const data = await rpc(name, params);
  if (data && data.ok) return { ok: true, data };
  const reason = data?.reason || "unknown";
  return { ok: false, reason, message: reasonMessage(reason, data || {}), data };
}

/**
 * Ajustes del programa (app_settings, lectura pública), saneados como en el
 * servidor. null si la fila falta: el programa cuenta como apagado y no se
 * enseñan porcentajes.
 */
export async function fetchProgramSettings() {
  const { data, error, status } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PROGRAM_KEY)
    .maybeSingle();
  if (error) throw toError(error, status);
  return normalizeProgram(data?.value);
}

/**
 * true cuando existe la fila partner_program (el programa está instalado):
 * los menús solo enseñan "Gana con ClicyVoy" / "Comerciales" entonces.
 */
export function useProgramInstalled() {
  const { data } = useQuery({
    queryKey: ["partner-program"],
    queryFn: fetchProgramSettings,
    staleTime: 30 * 60_000,
    retry: false,
  });
  return !!data;
}

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
 * Panel del comercial. Devuelve el objeto de partner_dashboard() más
 * `request_block` ({reason, text} o null). Si no es comercial: {ok:false,
 * reason:'not_partner'}.
 */
export async function fetchDashboard() {
  let data;
  try {
    data = await rpc("partner_dashboard");
  } catch (err) {
    // Migración sin aplicar: pantalla neutra, no un error.
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
  const data = await rpc("partner_clients");
  return Array.isArray(data) ? data : [];
}

export async function fetchCommissions(limit = 200) {
  const data = await rpc("partner_commission_list", { p_limit: limit });
  return Array.isArray(data) ? data : [];
}

/**
 * Historial de cobros del propio comercial (lectura directa con RLS). Se
 * filtra por SU comercial: el admin, que también puede ser comercial, lee
 * todas las filas por RLS.
 */
export async function fetchMyPayouts(userId) {
  const { data: partner, error: pErr } = await supabase
    .from("partners")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) throw toError(pErr);
  if (!partner) return [];
  const { data, error } = await supabase
    .from("partner_payouts")
    .select("id, amount, status, requested_at, resolved_at, note")
    .eq("partner_id", partner.id)
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) throw toError(error);
  return data || [];
}

export function activatePartner(displayName, slug) {
  return action("partner_activate", { p_display_name: displayName, p_slug: slug });
}

export function updatePayoutData(holder, iban) {
  return action("partner_update_payout_data", { p_holder: holder, p_iban: iban });
}

export function requestPayout() {
  return action("partner_request_payout");
}

/**
 * Atribución silenciosa tras iniciar sesión. Devuelve:
 *  - "done": respuesta definitiva (ok o cualquier motivo): se borra el código;
 *  - "retry": error de red/desconocido o sesión no aceptada: se conserva.
 */
export async function claimReferral(code) {
  try {
    const { data, error } = await supabase.rpc("partner_claim_referral", { p_code: code });
    if (error) return "retry";
    if (data?.ok) return "done";
    if (!data?.reason || data.reason === "not_authenticated") return "retry";
    return "done";
  } catch {
    return "retry";
  }
}

// ------------------------------------------------------------
// Admin
// ------------------------------------------------------------

export async function adminListPartners() {
  const data = await rpc("partner_admin_list");
  return Array.isArray(data) ? data : [];
}

/** status: 'requested' | 'paid' | 'rejected' | null (todas). */
export async function adminListPayouts(status) {
  const data = await rpc("partner_admin_payouts", { p_status: status || null });
  return Array.isArray(data) ? data : [];
}

export function adminResolvePayout(id, act, note) {
  return action("partner_admin_resolve_payout", {
    p_id: id,
    p_action: act,
    p_note: note || null,
  });
}

export function adminSetPartnerStatus(partnerId, status) {
  return action("partner_admin_set_status", { p_partner: partnerId, p_status: status });
}

export function adminReleaseCommission(id, act) {
  return action("partner_admin_release_commission", { p_id: id, p_action: act });
}

export async function adminListCommissions(partnerId) {
  const data = await rpc("partner_admin_commissions", { p_partner: partnerId || null });
  return Array.isArray(data) ? data : [];
}

/** Lee la fila partner_program tal cual (null si no existe). */
export async function adminFetchProgramRow() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PROGRAM_KEY)
    .maybeSingle();
  if (error) throw toError(error);
  return data ? data.value || {} : null;
}

/**
 * Guarda SOLO la clave partner_program, mezclando sobre lo que ya había (no
 * se pierden claves que esta pantalla no conozca) y quitando `dropKeys`
 * (nombres antiguos ya sustituidos). Falla si la fila no existe.
 */
export async function adminSaveProgram(current, values, dropKeys = []) {
  const merged = { ...(current || {}), ...values };
  for (const k of dropKeys) delete merged[k];
  const { data, error } = await supabase
    .from("app_settings")
    .update({ value: merged })
    .eq("key", PROGRAM_KEY)
    .select("key");
  if (error) throw toError(error);
  if (!data || data.length === 0) {
    const err = new Error("No se ha guardado nada: falta la fila del programa o no tienes permiso.");
    err.friendly = true;
    throw err;
  }
  return merged;
}

/** Descarga un archivo generado en el navegador (la URL se libera después). */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Descarga un CSV apto para Excel en español (BOM + punto y coma). Una celda
 * que empiece por = + - @ tabulador o retorno lleva delante ' para que Excel
 * no la ejecute como fórmula.
 */
export function downloadCsv(filename, rows) {
  const cell = (c) => {
    let s = String(c ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}
