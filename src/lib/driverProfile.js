"use client";

import { supabase } from "@/lib/entities";

/**
 * Busca el perfil de conductor del usuario logueado de forma ROBUSTA.
 *
 * La identidad fiable es el EMAIL DE LOGIN, no created_by_id: el trigger
 * set_created_by rellena created_by_id con el uid de QUIEN INSERTA, así que
 * los perfiles dados de alta por el admin quedan ligados al uid del ADMIN.
 * Si se buscara primero por created_by_id, un admin que además es conductor
 * "heredaría" el último perfil que creó (bug real: Renato veía el perfil de
 * Sergio y sus documentos se guardaban en la fila de Sergio). Por eso:
 *   1) se busca por email de login SIN distinguir mayúsculas (fila más antigua
 *      si hubiera duplicados) y se re-vincula created_by_id (self-heal);
 *   2) solo como respaldo, por created_by_id — y descartando filas cuyo email
 *      pertenece a OTRA persona (perfiles que este usuario creó siendo admin).
 *
 * Usar SIEMPRE este helper en las páginas del conductor; nunca filtrar solo
 * por created_by_id.
 */
/**
 * Un perfil de conductor está "incompleto" si le falta cualquier documento o
 * dato obligatorio. Misma condición que usa el panel del conductor: usarla
 * SIEMPRE que haya que decidir si puede ver/aceptar trabajos.
 */
/**
 * Documentos SENSIBLES del conductor (carnet, DNI, seguro, recibo autónomo,
 * censal): van al bucket PRIVADO driver-docs (la 0003 lo hizo privado; solo
 * dueño del fichero o staff pueden leer, vía signed URLs). En BD se guarda
 * una referencia "driver-docs://<path>", no una URL pública. Las URLs http
 * antiguas (bucket público) se siguen mostrando tal cual por compatibilidad.
 * La foto de cara y las del vehículo siguen siendo públicas: se muestran al
 * cliente en su pedido.
 */
const PRIVATE_PREFIX = "driver-docs://";

export const PRIVATE_DOC_FIELDS = new Set([
  "license_photo_url",
  "id_document_url",
  "insurance_url",
  "autonomo_receipt_url",
  "censal_document_url",
]);

export async function uploadPrivateDriverDoc(file) {
  const ext = file.name?.split(".").pop() || "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("driver-docs")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return PRIVATE_PREFIX + path;
}

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

  // 1) Por email de login (identidad fiable). Fila más antigua = la original;
  //    los duplicados vacíos que creaba el bug histórico son siempre más nuevos.
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
        // Self-heal: re-vincular al uid real. Si RLS impidiera el update
        // (email con mayúsculas distintas), no pasa nada: la búsqueda por
        // email seguirá encontrando el perfil en las próximas sesiones.
        await supabase
          .from("driver_profiles")
          .update({ created_by_id: user.id })
          .eq("id", byEmail[0].id);
      }
      return { ...byEmail[0], created_by_id: user.id };
    }
  }

  // 2) Respaldo por created_by_id (perfiles antiguos sin email). Se descartan
  //    filas con email de OTRA persona: son perfiles que este usuario creó
  //    para otros conductores siendo admin, no el suyo.
  const { data: own } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("created_by_id", user.id)
    .order("created_date", { ascending: true });
  const mine = (own || []).find(
    p => !p.email || p.email.trim().toLowerCase() === loginEmail
  );
  return mine || null;
}
