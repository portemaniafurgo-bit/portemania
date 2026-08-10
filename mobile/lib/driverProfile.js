import { decode } from "base64-arraybuffer";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
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

/**
 * Sube un documento sensible al bucket PRIVADO driver-docs desde una uri local
 * de cámara/galería, comprimido. Devuelve la referencia "driver-docs://<path>"
 * que se guarda en la columna del perfil (mismo esquema que la web).
 */
export async function uploadPrivateDriverDocFromUri(uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1600 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
  if (!image?.base64) throw new Error("No se pudo procesar el documento");

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from("driver-docs")
    .upload(path, decode(image.base64), { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw error;
  return PRIVATE_PREFIX + path;
}

/** Campos de documentación del perfil, con su etiqueta y si son privados.
 *  Misma lista que exige `isDriverProfileIncomplete`. */
export const DOC_FIELDS = [
  { field: "photo_url", label: "Foto de cara (selfie)", private: false },
  { field: "license_photo_url", label: "Carnet de conducir", private: true },
  { field: "id_document_url", label: "DNI / NIE", private: true },
  { field: "insurance_url", label: "Seguro del vehículo", private: true },
  { field: "autonomo_receipt_url", label: "Recibo de autónomo", private: true },
  { field: "censal_document_url", label: "Situación censal (Hacienda)", private: true },
  { field: "vehicle_photo_front_url", label: "Furgoneta — frontal", private: false },
  { field: "vehicle_photo_rear_url", label: "Furgoneta — trasera", private: false },
  { field: "vehicle_photo_left_url", label: "Furgoneta — lateral izquierdo", private: false },
  { field: "vehicle_photo_right_url", label: "Furgoneta — lateral derecho", private: false },
];

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
