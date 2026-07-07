import { redirect } from "next/navigation";

// Página de login legada (textos en inglés, duplicada). Se conserva la ruta
// por los enlaces antiguos, pero siempre lleva al login real de clientes.
export default function LoginLegacy() {
  redirect("/login-clientes");
}
