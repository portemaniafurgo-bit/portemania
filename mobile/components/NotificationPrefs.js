import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Caption, Card, Title } from "./ui";
import { Toggle } from "./wizard";

/**
 * Preferencias de notificaciones (canvas 2i). Se guardan en el dispositivo y
 * las respeta el manejador de push al decidir si muestra el aviso. Los avisos
 * críticos del servicio en curso no se pueden apagar: sin ellos el producto
 * no funciona (igual que Uber).
 */
const KEY = "notification_prefs_v1";

export const DEFAULT_PREFS = { status: true, chat: true, offers: true };

export async function getNotificationPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse((await AsyncStorage.getItem(KEY)) || "{}") };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export default function NotificationPrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    getNotificationPrefs().then(setPrefs);
  }, []);

  const toggle = key => async value => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <Card>
      <Title>Notificaciones</Title>
      <Toggle
        label="Estado de mis pedidos"
        description="Conductor asignado, en camino, entregado"
        value={prefs.status}
        onValueChange={toggle("status")}
      />
      <Toggle
        label="Mensajes de chat"
        description="Cuando el conductor te escribe"
        value={prefs.chat}
        onValueChange={toggle("chat")}
      />
      <Toggle
        label="Contraofertas y negociación"
        description="Respuestas de conductores a tu precio"
        value={prefs.offers}
        onValueChange={toggle("offers")}
      />
      <Caption>Se aplican a los avisos de este dispositivo.</Caption>
    </Card>
  );
}
