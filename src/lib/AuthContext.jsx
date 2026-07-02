"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext(undefined);

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";

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

  const loadUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    const merged = {
      id: authUser.id,
      email: authUser.email,
      ...(profile || {}),
      // El admin se determina por rol en el perfil o por email maestro.
      role:
        profile?.role ||
        (authUser.email?.toLowerCase() === ADMIN_EMAIL ? "admin" : "client"),
      full_name:
        profile?.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.email,
    };

    setUser(merged);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
  }, [supabase]);

  useEffect(() => {
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadUser]);

  const logout = useCallback(
    async (redirectTo = "/") => {
      await supabase.auth.signOut();
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
