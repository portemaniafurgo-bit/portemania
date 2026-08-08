"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/entities";
import { DEFAULT_TARIFFS } from "@/lib/pricing";

/**
 * Acceso a las tarifas vivas desde el navegador. La fórmula y los valores por
 * defecto están en `@/lib/pricing` (módulo puro, también usable en servidor);
 * aquí solo se resuelve de dónde salen los datos.
 */
export {
  DEFAULT_TARIFFS,
  INCLUDED_HOURS,
  MAX_STOPS,
  PACKAGE_WEIGHTS,
  VILLARROBLEDO_WEIGHTS,
  weightsForZone,
  packageWeightLabel,
  serviceSummary,
  billableFloors,
  countStops,
  quoteRequest,
  servicePriceFrom,
} from "@/lib/pricing";

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
