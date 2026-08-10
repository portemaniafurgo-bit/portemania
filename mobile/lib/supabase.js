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

const SecureStoreAdapter = {
  async getItem(key) {
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
  },

  async setItem(key, value) {
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
  },

  async removeItem(key) {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith("__chunks__:")) {
      const count = Number(head.slice("__chunks__:".length));
      for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(key);
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
