import { supabase } from "./supabase";
import { DEFAULT_TARIFFS } from "./pricing";

/**
 * Tarifas vivas (`app_settings.tariffs`, editables por el admin en la web).
 *
 * Equivalente móvil de `src/lib/tariffs.js`, sin react-query: la app cachea el
 * valor en memoria durante la sesión y cae en los valores por defecto si no hay
 * red. Esto es solo para ENSEÑAR el precio; el importe que se cobra lo fija
 * siempre `compute_quote` en el servidor.
 */
export * from "./pricing";

let cache = null;

export async function fetchTariffs({ force = false } = {}) {
  if (cache && !force) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "tariffs")
    .maybeSingle();
  if (error) return { ...DEFAULT_TARIFFS };
  cache = { ...DEFAULT_TARIFFS, ...(data?.value || {}) };
  return cache;
}
