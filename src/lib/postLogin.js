"use client";

import { supabase } from "@/lib/entities";

/**
 * Destino tras iniciar sesión según el rol del usuario: un conductor o el
 * admin que entra por el login de clientes no debe caer en el panel de
 * cliente (no tiene enlaces de vuelta a su área). Respeta la furgoneta
 * preseleccionada en la landing (?vehicle=) para los clientes.
 */
export async function destinoTrasLogin(userId) {
  let role = null;
  if (userId) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      role = data?.role || null;
    } catch {
      // sin rol legible → se asume cliente
    }
  }
  if (role === "driver") return "/driver";
  if (role === "admin" || role === "staff") return "/admin";
  const vehicle =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("vehicle")
      : null;
  return vehicle ? `/new-request?vehicle=${encodeURIComponent(vehicle)}` : "/dashboard";
}
