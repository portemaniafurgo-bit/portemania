"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";

/**
 * Protege páginas del panel. `allowStaff` deja entrar a los empleados (rol
 * 'staff'): pueden operar pedidos e incidencias, pero no tarifas, usuarios,
 * conductores, finanzas ni estadísticas.
 * Devuelve true mientras se puede renderizar la página.
 */
export function useAdminGuard({ allowStaff = false } = {}) {
  const { user, isLoadingAuth } = useAuth();
  const router = useRouter();

  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === "admin";
  const isStaff = user?.role === "staff";
  const allowed = isAdmin || (allowStaff && isStaff);
  const denied = !isLoadingAuth && !!user && !allowed;

  useEffect(() => {
    if (denied) router.replace(isStaff ? "/admin/orders" : "/dashboard");
  }, [denied, isStaff, router]);

  return !denied;
}
