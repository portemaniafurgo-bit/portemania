import { useLocalSearchParams } from "expo-router";
import ChatThread from "../../../components/ChatThread";

/** Chat a pantalla completa con el cliente (canvas 2g). */
export default function ChatConCliente() {
  const { id } = useLocalSearchParams();
  return <ChatThread orderId={id} partnerRole="client" />;
}
