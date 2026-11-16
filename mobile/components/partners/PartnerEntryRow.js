import { useRef } from "react";
import { useRouter } from "expo-router";
import { SettingsRow } from "../SettingsRow";
import { useAuth } from "../../lib/auth";
import {
  isStaffRole,
  useIsPartner,
  useProgramInstalled,
  useProgramPublic,
} from "../../lib/partners";

/**
 * Fila «Gana con ClicyVoy» del perfil (cliente y conductor). Aparece si:
 *  - el programa está instalado, encendido y abierto a todo el mundo;
 *  - o la persona ya es comercial (nunca pierde su panel);
 *  - o es del personal (admin/staff) y el programa está instalado
 *    (lanzamiento privado: el equipo lo prueba antes de abrirlo).
 * Mientras no se sabe, o si falla la lectura, no sale nada.
 */
export default function PartnerEntryRow() {
  const router = useRouter();
  const { user, role } = useAuth();
  const installed = useProgramInstalled();
  const isPublic = useProgramPublic();
  const isPartner = useIsPartner(user?.id);
  // Guarda contra el doble toque: dos toques seguidos abrirían dos pantallas.
  const opening = useRef(false);

  const visible = isPartner || (installed && (isPublic || isStaffRole(role)));
  if (!visible) return null;

  const open = () => {
    if (opening.current) return;
    opening.current = true;
    router.push("/partner");
    setTimeout(() => {
      opening.current = false;
    }, 800);
  };

  return (
    <SettingsRow
      icon="people-outline"
      label="Gana con ClicyVoy"
      hint="Recomienda ClicyVoy y gana una comisión"
      onPress={open}
    />
  );
}
