import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase de la app. Mismo backend que la web (proyecto
 * dnehzwrqphqpkcdjwqfi): la app es otro cliente, no una copia.
 *
 * La sesión vive en SecureStore (cifrado por el sistema), no en AsyncStorage:
 * el refresh token permite actuar como el usuario y en un móvil rooteado
 * AsyncStorage es un fichero legible. A cambio, SecureStore tiene un límite de
 * ~2 KB por entrada, así que la sesión se parte en trozos.
 */
const CHUNK_SIZE = 1800;

// REGLA DURA: este adaptador no puede lanzar JAMÁS. SecureStore descifra con
// una clave del Keystore de Android y tras una reinstalación (u otros azares
// del sistema) getItemAsync puede REVENTAR en vez de devolver null; si eso
// sube hasta supabase.auth.getSession(), la app se queda en "Abriendo
// ClicyVoy…" para siempre (pasó de verdad en el móvil del usuario, 2026-08-11).
// Un almacenamiento ilegible se trata como "sin sesión": lo peor que ve el
// usuario es volver a iniciar sesión.
const SecureStoreAdapter = {
  async getItem(key) {
    try {
      const head = await SecureStore.getItemAsync(key);
      if (head === null) return null;
      // Formato de sesión partida: "__chunks__:<n>" en la clave base.
      if (!head.startsWith("__chunks__:")) return head;
      const count = Number(head.slice("__chunks__:".length));
      const parts = [];
      for (let i = 0; i < count; i++) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`);
        if (part === null) return null; // trozo perdido: sesión inservible
        parts.push(part);
      }
      return parts.join("");
    } catch {
      // Ilegible: limpiar los restos para que la próxima escritura parta sana.
      try {
        await this.removeItem(key);
      } catch {}
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await this.removeItem(key);
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      const count = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      await SecureStore.setItemAsync(key, `__chunks__:${count}`);
    } catch {
      // Si no se pudo guardar, la sesión vivirá solo en memoria esta vez.
    }
  },

  async removeItem(key) {
    try {
      const head = await SecureStore.getItemAsync(key);
      if (head?.startsWith("__chunks__:")) {
        const count = Number(head.slice("__chunks__:".length));
        for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://dnehzwrqphqpkcdjwqfi.supabase.co";

// Clave publishable: pública por diseño (los datos los protege la RLS).
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_8yWcNhdQGPgWc_nYvkNQFw_60AVdwoy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // No hay URL que inspeccionar en un móvil: el login por enlace se maneja
    // con deep links explícitos, no leyendo el hash de la barra de direcciones.
    detectSessionInUrl: false,
  },
});
