import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/**
 * Acceso con un proveedor OAuth de Supabase (Google, Apple), el mismo que usa
 * la web.
 *
 * En un móvil no hay redirección de página: se abre el navegador del sistema
 * con la pantalla del proveedor y Supabase devuelve el resultado al esquema
 * `clicyvoy://` (registrado en app.json), del que se extraen los tokens.
 *
 * Apple va por este mismo camino web y NO con el módulo nativo de «Iniciar
 * sesión con Apple»: así no entra ninguna dependencia nativa nueva y los
 * binarios Android ya instalados siguen aceptando cualquier actualización.
 */
const PROVIDERS = {
  google: { label: "Google" },
  // Si la persona pulsa «Cancelar» DENTRO de la página de Apple, Apple vuelve a
  // Supabase con un error y Supabase redirige a clicyvoy://auth con
  // `error=...` y sin tokens: el navegador se cierra con «success». Eso es un
  // abandono, no un fallo, y no se explica.
  apple: { label: "Apple", silentErrorParams: true },
};

/** Parámetros de la URL de vuelta, del fragmento (#) y de la consulta (?). */
function returnParams(url) {
  const params = new URLSearchParams(url.split("#")[1] || "");
  const query = new URLSearchParams((url.split("?")[1] || "").split("#")[0]);
  for (const [key, value] of query) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}

/**
 * @param {"google" | "apple"} provider
 * @returns {Promise<{ ok: boolean, reason?: string }>} `reason` vacío = el
 *   usuario lo dejó, no hay nada que contarle.
 */
export async function signInWithProvider(provider) {
  const { label, silentErrorParams } = PROVIDERS[provider];
  const redirectTo = AuthSession.makeRedirectUri({ scheme: "clicyvoy", path: "auth" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, reason: `No se pudo iniciar el acceso con ${label}.` };
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
    if (silentErrorParams) {
      const back = returnParams(result.url);
      const detail = `${back.get("error") || ""} ${back.get("error_code") || ""} ${back.get("error_description") || ""}`;
      if (/cancel|denied/i.test(detail)) return { ok: false, reason: "" };
    }
    return { ok: false, reason: `${label} no devolvió una sesión válida.` };
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) return { ok: false, reason: "No se pudo abrir la sesión." };
  return { ok: true };
}

/**
 * «Continuar con Apple» (solo se ofrece en iPhone). Apple puede no dar el
 * nombre y dar un email de reenvío (…@privaterelay.appleid.com): el nombre lo
 * pide la pantalla de completar perfil y el email no se usa para nada que
 * suponga un dominio concreto.
 */
export function signInWithApple() {
  return signInWithProvider("apple");
}
