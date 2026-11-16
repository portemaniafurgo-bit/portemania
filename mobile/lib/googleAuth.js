import { signInWithProvider } from "./oauth";

/**
 * "Continuar con Google" — mismo proveedor OAuth de Supabase que usa la web.
 *
 * El mecanismo (navegador del sistema, vuelta a `clicyvoy://auth`, tokens de la
 * URL y setSession) vive en lib/oauth.js y es el mismo para Apple; los textos
 * que ve el usuario con Google no cambian.
 *
 * ⚠️ La consent screen de Google del negocio sigue en modo Testing: solo los
 * test users dados de alta pueden entrar con Google hasta publicarla (pendiente
 * histórico del rebrand, ver memoria del proyecto). El error "access_denied"
 * con otras cuentas viene de ahí, no de la app.
 */
export function signInWithGoogle() {
  return signInWithProvider("google");
}
