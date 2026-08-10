import { Loading } from "../components/ui";

/**
 * Pantalla de arranque. No decide nada: el guardia de `_layout.js` redirige en
 * cuanto sabe si hay sesión y qué rol tiene. Mostrar aquí un spinner evita el
 * parpadeo de enseñar el login a alguien que ya estaba dentro.
 */
export default function Index() {
  return <Loading label="Abriendo ClicyVoy…" />;
}
