import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { supabase } from "./supabase";
import { getNotificationPrefs } from "../components/NotificationPrefs";

/**
 * Notificaciones push. Es lo que la web no puede dar: hoy el conductor se entera
 * de un pedido nuevo por email o teniendo la pestaña abierta, y el cliente NO
 * recibe ningún aviso de estado ni de chat.
 *
 * El envío lo hace la Edge Function `send-push`; aquí solo se registra el token
 * del dispositivo y se reacciona a lo que llega.
 */

// Con la app en primer plano, Android no muestra nada por defecto: hay que
// decirlo explícitamente o el conductor no ve la oferta que acaba de entrar.
Notifications.setNotificationHandler({
  handleNotification: async notification => {
    // Preferencias del dispositivo (perfil → Notificaciones): el modo del
    // aviso decide qué toggle lo gobierna.
    const prefs = await getNotificationPrefs();
    const mode = notification?.request?.content?.data?.mode || "";
    const muted =
      (["price_offer", "offer_accepted", "new_request"].includes(mode) && !prefs.offers) ||
      (["news", "promo"].includes(mode) && !prefs.news) ||
      // El chat va con el estado del pedido: los dos son el servicio en curso.
      ([
        "chat_message",
        "status_changed",
        "driver_assigned",
        "driver_arriving",
        "driver_cancelled",
        "service_scheduled",
        "service_reminder",
      ].includes(mode) &&
        !prefs.status);
    return {
      shouldShowBanner: !muted,
      shouldShowList: !muted,
      shouldPlaySound: !muted,
      shouldSetBadge: true,
    };
  },
});

/** Canales de Android. "Ofertas" va aparte para que el conductor pueda dejarlo
 *  sonando fuerte sin que le suene igual cada mensaje de chat. */
async function ensureChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("ofertas", {
    name: "Pedidos disponibles",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7145d6",
  });
  await Notifications.setNotificationChannelAsync("estado", {
    name: "Estado del pedido y chat",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#7145d6",
  });
  // Novedades y promociones: por separado y en bajo, para que quien las apague
  // no se quede sin los avisos del servicio.
  await Notifications.setNotificationChannelAsync("novedades", {
    name: "Novedades de ClicyVoy",
    importance: Notifications.AndroidImportance.LOW,
    lightColor: "#7145d6",
  });
}

/**
 * Registra el token de este dispositivo para el usuario. Devuelve null si no
 * hay permiso o si no es un dispositivo real (un emulador no recibe push).
 */
export async function registerPushToken(userId) {
  if (!userId || !Device.isDevice) return null;

  await ensureChannels();

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    // onConflict en el token: el mismo dispositivo puede cambiar de usuario
    // (móvil compartido, conductor que prueba con su cuenta de cliente) y el
    // token debe quedar apuntando al último que inició sesión, no duplicado.
    await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, platform: Platform.OS, device_name: Device.deviceName },
        { onConflict: "token" },
      );
    return token;
  } catch {
    // Sin push la app funciona igual, solo con avisos por email: no tiene
    // sentido romper el arranque por esto.
    return null;
  }
}

/** Al cerrar sesión el token deja de ser de este usuario. */
export async function unregisterPushToken() {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (!projectId || !Device.isDevice) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token) await supabase.from("push_tokens").delete().eq("token", token);
  } catch {
    /* si no se puede, send-push lo limpiará al ver DeviceNotRegistered */
  }
}

/**
 * Registra el token al entrar y abre el pedido correspondiente al tocar una
 * notificación (los datos los pone `send-push`).
 */
export function usePushNotifications({ userId, role }) {
  const router = useRouter();
  const registered = useRef(null);

  useEffect(() => {
    if (!userId || registered.current === userId) return;
    registered.current = userId;
    registerPushToken(userId);
  }, [userId]);

  const coldStartHandled = useRef(false);

  useEffect(() => {
    /**
     * A dónde lleva cada aviso al tocarlo. Llevarlo TODO al detalle del pedido
     * hacía que un mensaje de chat abriera una pantalla desde la que había que
     * buscar el chat, y que una oferta nueva abriera un pedido que el conductor
     * todavía no tiene.
     */
    const open = (orderId, mode) => {
      if (mode === "docs_expiring") {
        router.push("/(conductor)/profile");
        return;
      }
      if (mode === "new_request" && role === "driver") {
        router.push("/(conductor)/ofertas");
        return;
      }
      if (!orderId) return;
      if (mode === "chat_message") {
        router.push(`/chat/${orderId}`);
        return;
      }
      if (mode === "offer_rejected" && role === "driver") {
        router.push("/(conductor)/ofertas");
        return;
      }
      router.push(
        role === "driver" ? `/(conductor)/job/${orderId}` : `/(cliente)/order/${orderId}`,
      );
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const payload = response.notification.request.content.data || {};
      open(payload.order_id, payload.mode);
    });

    // Arranque en frío: si la app se abrió TOCANDO una notificación, el
    // listener de arriba ya no ve esa respuesta — hay que pedirla aparte.
    // Solo una vez y con rol resuelto, para no llevar al grupo equivocado.
    if (!coldStartHandled.current && role) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (!response) return;
        const payload = response.notification.request.content.data || {};
        open(payload.order_id, payload.mode);
      });
    }

    return () => subscription.remove();
  }, [router, role]);
}
