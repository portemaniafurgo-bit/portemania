import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { unregisterPushToken } from "./push";
import { stopTracking } from "./tracking";

/**
 * Sesión y rol del usuario. Equivalente móvil de `src/lib/AuthContext.jsx` +
 * `src/lib/postLogin.js`: el rol vive en `profiles.role` y decide si la app
 * muestra la experiencia de cliente o la de conductor.
 *
 * Una sola app con dos caras, como Uber (decisión de la especificación §1).
 */
const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  // Cara de la app que se muestra ("client" | "driver"). El ROL no cambia: un
  // conductor puede pasarse a la cara de cliente para pedir un porte (como en
  // Uber) y volver. Para un cliente, mode es siempre "client".
  mode: null,
  setMode: async () => {},
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
});

// Supabase no se entera de que una app móvil pasa a segundo plano: sin esto, el
// refresco automático del token seguiría corriendo dormido (batería) y podría no
// reanudarse al volver. En web esto no hace falta; en RN sí.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

const ROLE_CACHE_KEY = "cached_role_v1";
// Cara elegida por un conductor ("client" para pedir como cliente). Local al
// dispositivo: no toca profiles.role, que es cosa del negocio.
const MODE_KEY = "active_mode_v1";

async function fetchRole(userId) {
  if (!userId) return null;
  try {
    // Con red inestable esta consulta puede no responder nunca (fetch sin
    // timeout). Antes que dejar al usuario mirando "Abriendo ClicyVoy…", a los
    // 8 segundos se asume cliente: el guardia re-evalúa cuando haya red.
    const query = supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const timeout = new Promise(resolve => setTimeout(() => resolve({ data: null }), 8000));
    const { data } = await Promise.race([query, timeout]);
    const role = data?.role || "client";
    AsyncStorage.setItem(ROLE_CACHE_KEY, role).catch(() => {});
    return role;
  } catch {
    return "client";
  }
}

/** Rol cacheado del último arranque: la app abre AL INSTANTE con él y lo
 *  revalida en segundo plano. El rol de una cuenta no cambia en la práctica
 *  (cliente ↔ conductor lo decide el negocio), así que el caché casi nunca
 *  miente — y si mintiera, la revalidación corrige en segundos. */
async function getCachedRole() {
  try {
    return await AsyncStorage.getItem(ROLE_CACHE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = aún leyendo la preferencia; sin esperarla, un conductor que dejó la
  // app en modo cliente parpadearía por las pantallas de conductor al abrir.
  const [facePref, setFacePref] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then(v => setFacePref(v || "driver"))
      .catch(() => setFacePref("driver"));
  }, []);

  useEffect(() => {
    let active = true;

    // getSession lee del almacenamiento local (no hace red): así el arranque no
    // se queda colgado si el móvil está sin cobertura. Y AUNQUE algo reviente,
    // loading termina: una pantalla de carga eterna es el peor fallo posible,
    // porque no deja ni reintentar.
    (async () => {
      let session = null;
      try {
        const { data } = await supabase.auth.getSession();
        session = data.session;
      } catch {
        session = null; // sesión ilegible = empezar deslogueado
      }
      if (!active) return;
      setSession(session);

      if (session?.user?.id) {
        // Arranque INSTANTÁNEO: con rol cacheado no se espera a la red — la
        // pantalla "Abriendo…" de 8 s con cobertura floja era inaceptable.
        const cached = await getCachedRole();
        if (active && cached) {
          setRole(cached);
          setLoading(false);
          // Revalidar en segundo plano; si el negocio cambió el rol, corrige.
          fetchRole(session.user.id).then(fresh => {
            if (active && fresh && fresh !== cached) setRole(fresh);
          });
          return;
        }
      }

      try {
        setRole(await fetchRole(session?.user?.id));
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      setRole(await fetchRole(next?.user?.id));
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    // Antes de cerrar sesión: si no, este móvil seguiría recibiendo los avisos
    // del usuario que se acaba de ir. Pero ninguna de estas limpiezas puede
    // IMPEDIR salir: cerrar sesión tiene que funcionar hasta sin red.
    try {
      await unregisterPushToken();
    } catch {}
    try {
      await stopTracking();
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    setSession(null);
    setRole(null);
    // La cara elegida es de ESTA cuenta: el siguiente que entre en el móvil
    // empieza en la suya por defecto.
    setFacePref("driver");
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  }, []);

  const refreshRole = useCallback(async () => {
    setRole(await fetchRole(session?.user?.id));
  }, [session?.user?.id]);

  const setMode = useCallback(async m => {
    setFacePref(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  // La cara efectiva: solo un conductor puede elegirla; para el resto es
  // siempre cliente. null mientras falte el rol o la preferencia guardada.
  const mode = !role
    ? null
    : role !== "driver"
      ? "client"
      : facePref === null
        ? null
        : facePref === "client"
          ? "client"
          : "driver";

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, role, mode, setMode, loading, signOut, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Grupo de rutas que corresponde a cada rol. El admin sigue siendo web: si
 *  entra en la app, se le trata como cliente (puede pedir servicios) y se le
 *  remite al panel web para administrar. */
export function homeForRole(role) {
  return role === "driver" ? "/(conductor)/ofertas" : "/(cliente)/pedir";
}
