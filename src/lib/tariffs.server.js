import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { DEFAULT_TARIFFS } from "@/lib/pricing";

/**
 * Tarifas vivas leídas en SERVIDOR (SSR/ISR) para la home y las páginas de
 * servicio: así el precio que indexa Google es el real y no uno hardcodeado.
 * Revalida cada 5 min — cambiar una tarifa en Ajustes se refleja sin deploy.
 */
export async function getTariffs() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?select=value&key=eq.tariffs&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY }, next: { revalidate: 300 } },
    );
    if (!res.ok) return DEFAULT_TARIFFS;
    const rows = await res.json();
    return { ...DEFAULT_TARIFFS, ...(rows?.[0]?.value || {}) };
  } catch {
    return DEFAULT_TARIFFS;
  }
}
