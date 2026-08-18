import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * Posición del conductor en SEGUNDO PLANO. Es la funcionalidad que justifica la
 * app: en la web el GPS solo emite con la pestaña abierta y en primer plano, así
 * que al bloquear el móvil o abrir Google Maps para navegar la posición se
 * congelaba en la BD y el cliente la seguía viendo como actual.
 *
 * Solo corre mientras hay un servicio en curso: se arranca al aceptar/continuar
 * un trabajo y se para al finalizarlo, cancelarlo o pasar a No disponible.
 */
const TASK = "clicyvoy-driver-location";
const PROFILE_KEY = "driver_profile_id";
// Aviso de llegada: destino de la fase actual y radio a partir del cual se
// considera "está llegando". 150 m es una manzana: da tiempo a bajar.
const ARRIVAL_KEY = "driver_arrival_target";
const ARRIVAL_RADIUS_M = 150;

/** Metros entre dos coordenadas (fórmula del semiverseno). */
function metersBetween(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Avisa al cliente cuando el conductor entra en el radio de llegada, UNA sola
 * vez por pedido y fase. La marca vive en el dispositivo porque esta tarea
 * corre sin interfaz y no puede consultar estado de React.
 */
async function maybeNotifyArrival(position) {
  const orderRaw = await AsyncStorage.getItem(ARRIVAL_KEY);
  if (!orderRaw) return;
  const arrival = JSON.parse(orderRaw); // { orderId, lat, lng, phase }

  const distance = metersBetween(position, { lat: arrival.lat, lng: arrival.lng });
  if (distance > ARRIVAL_RADIUS_M) return;

  // Marcar ANTES de llamar: si el push falla, no se reintenta en bucle cada
  // 10 segundos mientras el conductor espera en el portal.
  await AsyncStorage.removeItem(ARRIVAL_KEY);
  await supabase.functions
    .invoke("send-push", { body: { mode: "driver_arriving", order_id: arrival.orderId } })
    .catch(() => {});
}

/**
 * Fija a qué punto se está yendo, para el aviso de llegada. Lo llama la
 * pantalla del servicio cada vez que cambia la fase (a recoger / a entregar).
 */
export async function setArrivalTarget(orderId, target, phase) {
  if (!orderId || !target?.lat) {
    await AsyncStorage.removeItem(ARRIVAL_KEY).catch(() => {});
    return;
  }
  const current = await AsyncStorage.getItem(ARRIVAL_KEY).catch(() => null);
  // Si ya está fijado ESTE destino, no se toca: reescribirlo reactivaría un
  // aviso ya enviado en la misma fase.
  if (current) {
    try {
      const parsed = JSON.parse(current);
      if (parsed.orderId === orderId && parsed.phase === phase) return;
    } catch {
      /* marca ilegible: se reescribe */
    }
  }
  await AsyncStorage.setItem(
    ARRIVAL_KEY,
    JSON.stringify({ orderId, lat: target.lat, lng: target.lng, phase }),
  ).catch(() => {});
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;

  // El id del perfil se guardó al arrancar: esta tarea se ejecuta fuera de
  // React (incluso con la app cerrada), así que no puede rehacer el lookup por
  // email ni leer estado de la interfaz.
  const profileId = await AsyncStorage.getItem(PROFILE_KEY);
  if (!profileId) return;

  // Con la app en segundo plano el refresco automático del token está parado
  // (lo detiene el listener de AppState para ahorrar batería). El access token
  // dura 1 hora: en una mudanza larga caducaría y el GPS dejaría de escribir
  // en silencio. getSession() refresca en perezoso si hace falta.
  await supabase.auth.getSession();

  const { latitude, longitude } = data.locations[data.locations.length - 1].coords;

  await supabase
    .from("driver_profiles")
    .update({
      current_lat: latitude,
      current_lng: longitude,
      // Marca de frescura: sin ella el cliente no puede distinguir una posición
      // de hace 3 segundos de una congelada. Requiere la migración 0011.
      location_updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  await maybeNotifyArrival({ lat: latitude, lng: longitude });
});

/**
 * Pide permiso de ubicación en segundo plano y arranca el seguimiento.
 * Devuelve el motivo si no se pudo, para que la pantalla lo explique en vez de
 * fallar en silencio.
 */
export async function startTracking(profileId) {
  if (!profileId) return { ok: false, reason: "Sin perfil de conductor." };

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { ok: false, reason: "Necesitamos tu ubicación para que el cliente te siga." };
  }

  // Android pide el permiso de segundo plano por separado y solo después del de
  // primer plano. Sin él, la posición se congela al bloquear la pantalla.
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    return {
      ok: false,
      reason:
        "Falta el permiso «Permitir todo el tiempo». Sin él tu posición deja de actualizarse al bloquear el móvil.",
    };
  }

  await AsyncStorage.setItem(PROFILE_KEY, String(profileId));

  if (await Location.hasStartedLocationUpdatesAsync(TASK)) return { ok: true };

  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    // Android exige una notificación persistente para el servicio en primer
    // plano; además le dice al conductor que está compartiendo su posición, que
    // es lo honesto.
    foregroundService: {
      notificationTitle: "ClicyVoy · servicio en curso",
      notificationBody: "Compartiendo tu posición con el cliente",
      notificationColor: "#7145d6",
    },
  });

  return { ok: true };
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(TASK);
}
