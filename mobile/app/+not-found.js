import { Redirect } from "expo-router";

/**
 * Red de seguridad: cualquier enlace o deep link que no case con una ruta
 * vuelve a la raíz, donde el guardia decide según sesión y rol. El usuario no
 * tiene por qué ver jamás una pantalla técnica de "ruta no encontrada".
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
