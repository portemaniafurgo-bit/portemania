import { useRef } from "react";
import { useRouter } from "expo-router";
import { SettingsRow } from "../SettingsRow";
import { useProgramInstalled } from "../../lib/partners";

/**
 * Fila «Gana con ClicyVoy» del perfil (cliente y conductor). Solo aparece si
 * el programa de comerciales está instalado en la base de datos y su fila de
 * ajustes se puede leer; mientras no se sabe, o si falla, no sale nada.
 */
export default function PartnerEntryRow() {
  const router = useRouter();
  const installed = useProgramInstalled();
  // Guarda contra el doble toque: dos toques seguidos abrirían dos pantallas.
  const opening = useRef(false);

  if (!installed) return null;

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
