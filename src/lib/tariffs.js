"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/entities";

/**
 * Tarifas del negocio, editables por el admin en Ajustes (app_settings.tariffs).
 * Lectura pública (el invitado calcula su precio sin sesión). Si la BD no
 * responde se usan los valores por defecto.
 *
 * Dos tamaños de furgoneta (small/large). La ayuda del conductor (subir/bajar
 * la mercancía) es un suplemento fijo `help_price`.
 */
export const DEFAULT_TARIFFS = {
  small: 45,
  large: 60,
  extra_hour: 15,
  insurance: 12,
  help_price: 30,
  commission_pct: 15,
};

export async function fetchTariffs() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "tariffs")
    .maybeSingle();
  if (error) return DEFAULT_TARIFFS;
  return { ...DEFAULT_TARIFFS, ...(data?.value || {}) };
}

export function useTariffs() {
  const { data } = useQuery({
    queryKey: ["tariffs"],
    queryFn: fetchTariffs,
    staleTime: 60_000,
  });
  return data || DEFAULT_TARIFFS;
}

export function estimatePrice(tariffs, vehicleType, extraHours = 0, insurance = false, needsHelp = false) {
  if (!vehicleType) return 0;
  const base = tariffs[vehicleType] ?? DEFAULT_TARIFFS[vehicleType] ?? DEFAULT_TARIFFS.small;
  return (
    base +
    (extraHours || 0) * tariffs.extra_hour +
    (insurance ? tariffs.insurance : 0) +
    (needsHelp ? (tariffs.help_price ?? DEFAULT_TARIFFS.help_price) : 0)
  );
}
