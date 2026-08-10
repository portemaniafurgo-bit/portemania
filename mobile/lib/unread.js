import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * Mensajes de chat sin leer, por pedido.
 *
 * La marca de "leído hasta" vive en el dispositivo (AsyncStorage): no hay
 * columna de lecturas en la BD y no hace falta — el badge es una ayuda de
 * interfaz, no un estado de negocio que deba sincronizarse entre dispositivos.
 */
const KEY = "chat_last_read_v1";

async function readMap() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || "{}");
  } catch {
    return {};
  }
}

/** Marca un pedido como leído hasta ahora. Llamar al abrir su chat. */
export async function markChatRead(orderId) {
  const map = await readMap();
  map[orderId] = new Date().toISOString();
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

/**
 * Cuenta los no leídos de varios pedidos en UNA consulta (los ajenos: lo que
 * yo mismo envié no cuenta como pendiente de leer).
 * Devuelve { [orderId]: n }.
 */
export async function countUnread(orderIds, myUserId) {
  const ids = (orderIds || []).filter(Boolean);
  if (!ids.length) return {};

  const map = await readMap();
  // Solo el último tramo de conversación: un badge de "99+" de hace un mes no
  // ayuda a nadie y la consulta se mantiene pequeña.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from("chat_messages")
    .select("request_id, sender_id, created_date")
    .in("request_id", ids)
    .gte("created_date", since)
    .limit(500);

  const counts = {};
  for (const m of data || []) {
    if (m.sender_id === myUserId) continue;
    const lastRead = map[m.request_id];
    if (lastRead && m.created_date <= lastRead) continue;
    counts[m.request_id] = (counts[m.request_id] || 0) + 1;
  }
  return counts;
}
