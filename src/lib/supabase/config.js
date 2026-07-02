// Configuración de Supabase. Las env vars tienen prioridad; los valores por
// defecto son la URL y la clave PUBLISHABLE (pública por diseño — pensada para
// el navegador; los datos están protegidos por RLS). Esto garantiza que el
// build de producción funcione aunque las variables aún no estén configuradas.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dnehzwrqphqpkcdjwqfi.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_8yWcNhdQGPgWc_nYvkNQFw_60AVdwoy";
