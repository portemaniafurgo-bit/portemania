import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * "Continuar con Google" — mismo proveedor OAuth de Supabase que usa la web.
 *
 * En un móvil no hay redirección de página: se abre el navegador del sistema
 * con la pantalla de Google y Supabase devuelve el resultado al esquema
 * `clicyvoy://` (registrado en app.json), del que se extraen los tokens.
 *
 * ⚠️ La consent screen de Google del negocio sigue en modo Testing: solo los
 * test users dados de alta pueden entrar con Google hasta publicarla (pendiente
 * histórico del rebrand, ver memoria del proyecto). El error "access_denied"
 * con otras cuentas viene de ahí, no de la app.
 */
export async function signInWithGoogle() {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: "clicyvoy", path: "auth" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, reason: "No se pudo iniciar el acceso con Google." };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    // El usuario cerró el navegador: no es un error que haya que explicar.
    return { ok: false, reason: result.type === "cancel" ? "" : "Acceso cancelado." };
  }

  // Supabase devuelve los tokens en el fragmento (#access_token=...&refresh_token=...).
  const fragment = result.url.split("#")[1] || result.url.split("?")[1] || "";
  const params = new URLSearchParams(fragment);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) {
    return { ok: false, reason: "Google no devolvió una sesión válida." };
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) return { ok: false, reason: "No se pudo abrir la sesión." };
  return { ok: true };
}
