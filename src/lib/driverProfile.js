"use client";

import { supabase } from "@/lib/entities";

/**
 * Busca el perfil de conductor del usuario logueado de forma ROBUSTA.
 *
 * Un perfil creado por el admin lleva created_by_id = uid del ADMIN, no del
 * conductor. Si solo se busca por created_by_id, el conductor "no tiene perfil"
 * y la app le vuelve a pedir toda la documentación (e incluso puede crear un
 * perfil duplicado vacío al guardar). Por eso:
 *   1) se busca por created_by_id (perfil propio)
 *   2) si no hay, por email SIN distinguir mayúsculas (perfil creado por admin)
 *      y se re-vincula (self-heal) para las próximas veces.
 *
 * Usar SIEMPRE este helper en las páginas del conductor; nunca filtrar solo
 * por created_by_id.
 */
/**
 * Un perfil de conductor está "incompleto" si le falta cualquier documento o
 * dato obligatorio. Misma condición que usa el panel del conductor: usarla
 * SIEMPRE que haya que decidir si puede ver/aceptar trabajos.
 */
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

  const { data: own } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("created_by_id", user.id)
    .limit(1);
  if (own?.[0]) return own[0];

  if (user.email) {
    const { data: byEmail } = await supabase
      .from("driver_profiles")
      .select("*")
      .ilike("email", user.email)
      .limit(1);
    if (byEmail?.[0]) {
      await supabase
        .from("driver_profiles")
        .update({ created_by_id: user.id })
        .eq("id", byEmail[0].id);
      return { ...byEmail[0], created_by_id: user.id };
    }
  }
  return null;
}
