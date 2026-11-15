"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

/**
 * Layout de las áreas autenticadas (cliente/conductor/admin).
 * Equivale a ProtectedRoute + AppLayout del original Base44.
 */
export default function ProtectedLayout({ children }) {
  const { isAuthenticated, isLoadingAuth, authError, refresh, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      router.replace("/login-clientes");
    }
  }, [isLoadingAuth, isAuthenticated, router]);

  // La cuenta no se pudo comprobar tras varios intentos (sin red o el
  // servidor no acepta la sesión): salida en vez de un "Cargando…" eterno.
  // Los reintentos siguen solos por detrás.
  if (isLoadingAuth && authError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <h2 className="text-lg font-display font-bold text-foreground">
            No se pudo comprobar tu cuenta
          </h2>
          <p className="text-sm text-muted-foreground">
            Revisa tu conexión e inténtalo de nuevo. Seguimos probando automáticamente.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <Button className="rounded-xl h-11" onClick={() => refresh()}>
              Reintentar
            </Button>
            <Button variant="outline" className="rounded-xl h-11" onClick={() => logout("/login-clientes")}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando ClicyVoy...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
