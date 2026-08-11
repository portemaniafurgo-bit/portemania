import { Loading } from "../components/ui";

/**
 * Destino del redirect OAuth (clicyvoy://auth). No decide nada: el flujo de
 * Google ya está poniendo la sesión, y en cuanto entra, el guardia del layout
 * raíz lleva al grupo del rol. Sin esta ruta, el deep link de vuelta caía en
 * la pantalla "Unmatched Route" (reporte real del usuario, 2026-08-11).
 */
export default function AuthCallback() {
  return <Loading label="Completando el acceso…" />;
}
