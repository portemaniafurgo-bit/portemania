import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
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

async function fetchRole(userId) {
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role || "client";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // getSession lee del almacenamiento local (no hace red): así el arranque no
    // se queda colgado si el móvil está sin cobertura.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setRole(await fetchRole(data.session?.user?.id));
      setLoading(false);
    });

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
    // del usuario que se acaba de ir.
    await unregisterPushToken();
    await stopTracking();
    await supabase.auth.signOut();
    setSession(null);
    setRole(null);
  }, []);

  const refreshRole = useCallback(async () => {
    setRole(await fetchRole(session?.user?.id));
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, role, loading, signOut, refreshRole }}
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
  return role === "driver" ? "/(conductor)" : "/(cliente)";
}
