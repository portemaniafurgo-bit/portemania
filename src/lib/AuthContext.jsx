"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext(undefined);

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";

/**
 * Lee sesión y perfil. Devuelve:
 *  - { status: "signedOut" } sin sesión;
 *  - { status: "ok", user } con el perfil leído (o el admin por email);
 *  - { status: "unknown", authUser } si NO se pudo leer el perfil (error de
 *    red/permisos, o cero filas: con sesión siempre hay fila en profiles, así
 *    que cero filas es que el servidor no aceptó el token). "No se sabe" no es
 *    "cliente": asumirlo mandaba a conductores al panel de cliente.
 */
async function readUser(supabase) {
  let authUser = null;
  try {
    // getSession() lee la sesión local (cookies/storage) sin llamada de red:
    // al volver atrás o con conexión inestable NO se pierde la sesión (el bug
    // de la versión Base44 era exactamente ese). El refresco del token lo
    // gestionan supabase-js y el proxy del servidor.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    authUser = session?.user ?? null;
  } catch {
    return { status: "unknown", authUser: null };
  }

  if (!authUser) return { status: "signedOut" };

  const isAdminEmail = authUser.email?.toLowerCase() === ADMIN_EMAIL;
  let profile = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (!error) profile = data;
  } catch {
    profile = null;
  }

  // El admin se determina también por email maestro: aunque el perfil no se
  // pueda leer, sigue entrando como admin (comportamiento de siempre).
  if (!profile && !isAdminEmail) return { status: "unknown", authUser };

  return {
    status: "ok",
    user: {
      id: authUser.id,
      email: authUser.email,
      ...(profile || {}),
      // Fila presente sin rol = cliente de verdad (la fila existe).
      role: profile?.role || (isAdminEmail ? "admin" : "client"),
      full_name:
        profile?.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.email,
    },
  };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * AuthContext respaldado por Supabase Auth.
 * Reemplaza al SDK de Base44. Carga la sesión y mezcla los datos del perfil
 * (rol, nombre, teléfono, foto, etc.) desde la tabla `profiles`.
 */
export function AuthProvider({ children }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // true tras varios intentos fallidos de leer el perfil en la primera carga:
  // la pantalla deja de ser un "Cargando…" sin salida y ofrece reintentar o
  // cerrar sesión (los reintentos siguen solos por detrás).
  const [authError, setAuthError] = useState(false);
  // Último usuario cargado (para decidir fuera del render si se conserva) y
  // contador de cargas: una carga nueva o desmontar cancela los reintentos de
  // la anterior.
  const userRef = useRef(null);
  const runRef = useRef(0);

  const loadUser = useCallback(async () => {
    const run = ++runRef.current;
    for (let attempt = 0; ; attempt++) {
      const result = await readUser(supabase);
      if (run !== runRef.current) return;

      if (result.status === "signedOut") {
        setAuthError(false);
        userRef.current = null;
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      if (result.status === "ok") {
        setAuthError(false);
        userRef.current = result.user;
        setUser(result.user);
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        return;
      }

      // No se pudo leer el perfil. Si ya había un usuario cargado (el mismo),
      // se conserva con su rol: un fallo de red no convierte a nadie en
      // cliente. El siguiente evento de sesión volverá a leerlo.
      const prev = userRef.current;
      if (prev && (!result.authUser || prev.id === result.authUser.id)) {
        setIsAuthenticated(true);
        setIsLoadingAuth(false);
        return;
      }

      // Primera carga sin perfil legible: se sigue en "Cargando…" y se
      // reintenta (1 s, 2 s, 4 s y luego cada 8 s) en vez de suponer cliente.
      if (prev) {
        userRef.current = null;
        setUser(null);
      }
      setIsLoadingAuth(true);
      if (attempt >= 3) setAuthError(true); // 4 intentos fallidos
      await wait(Math.min(1000 * 2 ** attempt, 8000));
      if (run !== runRef.current) return;
    }
  }, [supabase]);

  // Carga inicial de sesión + re-carga en cada cambio de auth: patrón intencionado
  // (loadUser es async; los setState ocurren tras resolver la sesión, no en cascada).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    const runs = runRef;
    return () => {
      subscription.unsubscribe();
      // Corta los reintentos pendientes de esta montura.
      runs.current += 1;
    };
  }, [supabase, loadUser]);

  const logout = useCallback(
    async (redirectTo = "/") => {
      await supabase.auth.signOut();
      runRef.current += 1; // corta reintentos pendientes
      setAuthError(false);
      userRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      if (typeof window !== "undefined") {
        window.location.href = redirectTo;
      }
    },
    [supabase]
  );

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    supabase,
    logout,
    refresh: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
