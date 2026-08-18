import { useLocalSearchParams } from "expo-router";
import ChatThread from "../../../components/ChatThread";

/** Chat a pantalla completa con el conductor (canvas 2g). */
export default function ChatConConductor() {
  const { id } = useLocalSearchParams();
  return <ChatThread orderId={id} partnerRole="driver" />;
}
