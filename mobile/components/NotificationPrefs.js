import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Caption, Card } from "./ui";
import { Toggle } from "./wizard";

/**
 * Avisos del canvas 2i, con sus tres interruptores y su microcopy:
 * estado del pedido, ofertas y contraofertas, y novedades.
 *
 * Se guardan en el dispositivo y los respeta el manejador de push al decidir si
 * muestra el aviso. Los mensajes del chat van con el estado del pedido: son
 * parte del servicio en curso, no una categoría que apagar por su cuenta.
 */
const KEY = "notification_prefs_v1";

export const DEFAULT_PREFS = { status: true, offers: true, news: true };

export async function getNotificationPrefs() {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) || "{}");
    // `chat` es una preferencia vieja: si estaba apagada, se respeta dentro de
    // "estado del pedido" en vez de perderse en silencio.
    const status = saved.status ?? DEFAULT_PREFS.status;
    return { ...DEFAULT_PREFS, ...saved, status: status && (saved.chat ?? true) };
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
    const next = { ...prefs, [key]: value, ...(key === "status" ? { chat: value } : {}) };
    setPrefs(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <Card>
      <Toggle
        label="Estado del pedido"
        description="Push y email en cada cambio"
        value={prefs.status}
        onValueChange={toggle("status")}
      />
      <Toggle
        label="Ofertas y contraofertas"
        description="«Tienes 2 contraofertas»"
        value={prefs.offers}
        onValueChange={toggle("offers")}
      />
      <Toggle
        label="Novedades de ClicyVoy"
        description="Cambios del servicio y promociones puntuales"
        value={prefs.news}
        onValueChange={toggle("news")}
      />
      <Caption>Se aplican a los avisos de este dispositivo.</Caption>
    </Card>
  );
}
