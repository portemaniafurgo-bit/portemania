import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { supabase } from "./supabase";

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
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
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
    const open = orderId => {
      if (!orderId) return;
      router.push(
        role === "driver" ? `/(conductor)/job/${orderId}` : `/(cliente)/order/${orderId}`,
      );
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      open(response.notification.request.content.data?.order_id);
    });

    // Arranque en frío: si la app se abrió TOCANDO una notificación, el
    // listener de arriba ya no ve esa respuesta — hay que pedirla aparte.
    // Solo una vez y con rol resuelto, para no llevar al grupo equivocado.
    if (!coldStartHandled.current && role) {
      coldStartHandled.current = true;
      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response) open(response.notification.request.content.data?.order_id);
      });
    }

    return () => subscription.remove();
  }, [router, role]);
}
