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
  // Servicio de envío de paquetes mismo día (precio fijo por tramo de peso).
  pkg_light: 4.99,   // 0–9 kg
  pkg_medium: 7.99,  // 10–19 kg
  pkg_heavy: 9.99,   // 20–30 kg
};

// Tramos de peso del envío de paquetes (máx. 30 kg). `priceKey` apunta a la
// tarifa viva en app_settings; el orden es el que se muestra al cliente.
export const PACKAGE_WEIGHTS = [
  { key: "light",  label: "0 – 9 kg",   priceKey: "pkg_light",  hint: "Sobres, paquetes y cajas ligeras" },
  { key: "medium", label: "10 – 19 kg", priceKey: "pkg_medium", hint: "Cajas medianas" },
  { key: "heavy",  label: "20 – 30 kg", priceKey: "pkg_heavy",  hint: "Cajas pesadas (máximo 30 kg)" },
];

const PKG_PRICE_KEY = { light: "pkg_light", medium: "pkg_medium", heavy: "pkg_heavy" };

/** Etiqueta legible del tramo (para conductor/admin/resúmenes). */
export function packageWeightLabel(weight) {
  return PACKAGE_WEIGHTS.find(w => w.key === weight)?.label || "";
}

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

/** Precio fijo del envío de paquetes según el tramo de peso elegido. */
export function estimatePackagePrice(tariffs, weight) {
  const key = PKG_PRICE_KEY[weight];
  if (!key) return 0;
  return Number(tariffs?.[key] ?? DEFAULT_TARIFFS[key]);
}
