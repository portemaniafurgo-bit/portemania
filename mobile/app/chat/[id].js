import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth";
import ChatThread from "../../components/ChatThread";

/**
 * Chat del pedido, A PANTALLA COMPLETA y FUERA de las pestañas (canvas 2g).
 *
 * Estaba dentro de cada grupo con la barra de pestañas escondida a mano
 * (`tabBarStyle: display none`), y esa pantalla salía en negro. Como ruta del
 * stack raíz no depende del navegador de pestañas: se abre entera, con su
 * propio fondo, y la misma pantalla sirve a cliente y conductor — la otra
 * parte de la conversación la decide el rol.
 */
export default function Chat() {
  const { id } = useLocalSearchParams();
  // La CARA visible (mode), no el rol: un conductor pidiendo como cliente
  // chatea con SU conductor, no con "el cliente".
  const { mode } = useAuth();
  return <ChatThread orderId={id} partnerRole={mode === "driver" ? "client" : "driver"} />;
}
