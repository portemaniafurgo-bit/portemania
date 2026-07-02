import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 * En Next 16 `cookies()` es asíncrono, por eso la función es async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component sin acceso de escritura a cookies.
            // El middleware se encarga de refrescar la sesión, así que es seguro ignorarlo.
          }
        },
      },
    }
  );
}
