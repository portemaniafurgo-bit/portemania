"use client";

import { supabase } from "@/lib/entities";
import { buildRequestHref, hasRequestDraft } from "@/lib/requestIntent";

/** Rol del usuario, o null si no se pudo leer (error, cero filas o
 *  excepción). Cero filas con sesión es que el servidor no aceptó el token:
 *  tampoco es "cliente". */
async function leerRol(userId) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data.role || "client";
  } catch {
    return null;
  }
}

/**
 * Destino tras iniciar sesión según el rol del usuario: un conductor o el
 * admin que entra por el login de clientes no debe caer en el panel de
 * cliente (no tiene enlaces de vuelta a su área). Respeta la furgoneta
 * preseleccionada en la landing (?vehicle=) para los clientes.
 */
export async function destinoTrasLogin(userId) {
  let role = null;
  if (userId) {
    role = await leerRol(userId);
    // Un fallo puntual no puede mandar a un conductor al panel de cliente:
    // se reintenta una vez antes de rendirse.
    if (!role) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      role = await leerRol(userId);
    }
    // Sin rol legible: /dashboard es el destino neutro (redirige a /driver o
    // /admin en cuanto la sesión carga el rol), no el panel de pedir.
    if (!role) return "/dashboard";
  }
  if (role === "driver") return "/driver";
  if (role === "admin" || role === "staff") return "/admin";
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  return hasRequestDraft(searchParams)
    ? buildRequestHref("/new-request", searchParams)
    : "/dashboard";
}
