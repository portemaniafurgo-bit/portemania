import { supabase } from "./supabase";

/**
 * Perfil de conductor del usuario logueado. Puerto de `src/lib/driverProfile.js`
 * — misma lógica y por el mismo motivo.
 *
 * La identidad fiable es el EMAIL DE LOGIN, no `created_by_id`: el trigger
 * set_created_by rellena created_by_id con el uid de QUIEN INSERTA, así que los
 * perfiles dados de alta por el admin quedaron ligados al uid del ADMIN. Buscar
 * primero por created_by_id hacía que un admin que además es conductor
 * "heredase" el último perfil creado (bug real en producción, julio 2026).
 *
 * Usar SIEMPRE este helper en las pantallas del conductor.
 */
const PRIVATE_PREFIX = "driver-docs://";

export const PRIVATE_DOC_FIELDS = new Set([
  "license_photo_url",
  "id_document_url",
  "insurance_url",
  "autonomo_receipt_url",
  "censal_document_url",
]);

export async function resolveDriverDocUrl(value) {
  if (!value) return null;
  if (!value.startsWith(PRIVATE_PREFIX)) return value; // URL pública antigua
  const { data, error } = await supabase.storage
    .from("driver-docs")
    .createSignedUrl(value.slice(PRIVATE_PREFIX.length), 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export function isDriverProfileIncomplete(profile) {
  return (
    !profile?.photo_url ||
    !profile.vehicle_photo_front_url ||
    !profile.vehicle_photo_rear_url ||
    !profile.vehicle_photo_left_url ||
    !profile.vehicle_photo_right_url ||
    !profile.license_photo_url ||
    !profile.vehicle_plate ||
    !profile.vehicle_brand ||
    !profile.autonomo_receipt_url ||
    !profile.censal_document_url
  );
}

export async function fetchMyDriverProfile(user) {
  if (!user?.id) return null;
  const loginEmail = (user.email || "").trim().toLowerCase();

  // 1) Por email de login. Fila más antigua = la original; los duplicados
  //    vacíos que creaba el bug histórico son siempre más nuevos.
  if (loginEmail) {
    // Escapar comodines de LIKE: un email con "_" no debe hacer match difuso.
    const emailPattern = loginEmail.replace(/([\\%_])/g, "\\$1");
    const { data: byEmail } = await supabase
      .from("driver_profiles")
      .select("*")
      .ilike("email", emailPattern)
      .order("created_date", { ascending: true })
      .limit(1);
    if (byEmail?.[0]) {
      if (byEmail[0].created_by_id !== user.id) {
        // Self-heal: re-vincular al uid real. Si la RLS lo impide, no pasa
        // nada: la búsqueda por email lo seguirá encontrando.
        await supabase
          .from("driver_profiles")
          .update({ created_by_id: user.id })
          .eq("id", byEmail[0].id);
      }
      return { ...byEmail[0], created_by_id: user.id };
    }
  }

  // 2) Respaldo por created_by_id (perfiles antiguos sin email), descartando
  //    filas con email de OTRA persona: son perfiles que este usuario creó
  //    para terceros siendo admin.
  const { data: own } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("created_by_id", user.id)
    .order("created_date", { ascending: true });
  return (own || []).find(p => !p.email || p.email.trim().toLowerCase() === loginEmail) || null;
}
