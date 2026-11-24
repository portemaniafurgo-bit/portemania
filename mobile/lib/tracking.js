import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestForegroundLocation, requestTrackingBackgroundLocation } from "./locationDisclosure";
import { supabase } from "./supabase";
import { isStillRepeat, metersBetween, pickFix } from "./geo";

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
// Último fix ESCRITO en la BD ({ lat, lng, ts }): con él se descartan fixes
// viejos y saltos imposibles. Vive en AsyncStorage porque la tarea puede
// arrancar en un proceso nuevo (app cerrada) sin estado de módulo.
const LAST_FIX_KEY = "driver_last_fix";
// Versión de las opciones de captura. Si un conductor está a mitad de servicio
// cuando llega una actualización, el seguimiento ya está arrancado con las
// opciones viejas: al ver otra versión se le pasan las nuevas (startTracking).
const OPTIONS_VERSION_KEY = "driver_tracking_options_v";
const OPTIONS_VERSION = "3";
// Última renovación forzada de la sesión. En AsyncStorage y no solo en
// memoria: Android recrea a menudo el contexto JS sin interfaz y el límite de
// una cada 2 min se reiniciaría con él.
const FORCED_REFRESH_KEY = "driver_last_forced_refresh";
// iPhone: separación mínima entre dos escrituras de posición (ver handleLocations).
const IOS_MIN_WRITE_GAP_MS = 3500;

/**
 * Opciones de captura.
 *
 * - `High` y no `BestForNavigation`: en Android las dos (y `Highest`) acaban
 *   en la misma prioridad nativa, PRIORITY_HIGH_ACCURACY (LocationHelpers.kt
 *   de expo-location); solo cambian el intervalo y la distancia por defecto,
 *   que aquí se fijan a mano. Con `Balanced` (lo de antes) Android tiraba de
 *   wifi y antenas: posiciones a 50-100 m, en otra calle.
 * - Cada 4 s, sin distancia mínima: el cliente ve avanzar la furgoneta de
 *   verdad, también a 120 km/h por la autovía (antes, cada 10 s, eran saltos
 *   de 300 m). Sin distancia mínima, un conductor parado sigue dando señal;
 *   la tarea solo escribe una vez cada 20 s mientras no se mueva (ver
 *   isStillRepeat en lib/geo.js), así consta como viva sin reptar.
 * - Gasta más batería, pero el seguimiento SOLO corre con un servicio en
 *   curso (se para al finalizar, cancelar o pasar a No disponible) y el
 *   conductor suele ir con el móvil cargando en el coche: compensa.
 */
const CAPTURE_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: 4000,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  // Android exige una notificación persistente para el servicio en primer
  // plano; además le dice al conductor que está compartiendo su posición, que
  // es lo honesto.
  foregroundService: {
    notificationTitle: "ClicyVoy · servicio en curso",
    notificationBody: "Compartiendo tu posición con el cliente",
    notificationColor: "#7145d6",
  },
  // iPhone: sin servicio en primer plano ni notificación. Lo equivalente es
  // decirle al sistema que es navegación en coche (filtra mejor y no corta en
  // los semáforos), enseñar el indicador azul de «usando tu ubicación» (con él
  // iOS sigue enviando posiciones en segundo plano aunque solo haya permiso
  // «Al usar la app») y no pausar nunca. Con la app en segundo plano iOS da
  // una posición por segundo: se juntan en lotes de 4 s, como en Android.
  // Solo se añade en iOS: las opciones de Android no cambian (ni su versión).
  ...(Platform.OS === "ios"
    ? {
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        deferredUpdatesInterval: 4000,
      }
    : {}),
};

let lastFixCache = null;

// Una marca en el futuro (reloj del móvil cambiado) congelaría el mapa para
// siempre: todo fix nuevo parecería "más viejo". Vale para la copia en
// memoria y para la guardada.
const plausibleStamp = fix => !!fix && Number.isFinite(fix.ts) && fix.ts <= Date.now() + 60_000;

async function readLastFix() {
  if (lastFixCache && plausibleStamp(lastFixCache)) return lastFixCache;
  lastFixCache = null;
  try {
    const raw = await AsyncStorage.getItem(LAST_FIX_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (plausibleStamp(parsed)) {
      lastFixCache = parsed;
      return parsed;
    }
  } catch {
    /* marca ilegible: como si no hubiera */
  }
  return null;
}

async function saveLastFix(fix) {
  lastFixCache = fix;
  await AsyncStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix)).catch(() => {});
}

async function clearLastFix() {
  lastFixCache = null;
  await AsyncStorage.removeItem(LAST_FIX_KEY).catch(() => {});
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
  // pocos segundos mientras el conductor espera en el portal.
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

let lastForcedRefreshAt = 0;

async function readLastForcedRefresh() {
  let stored = Number(await AsyncStorage.getItem(FORCED_REFRESH_KEY).catch(() => null)) || 0;
  // Un sello en el futuro (reloj del móvil corregido) no puede bloquear el refresco.
  if (stored > Date.now()) stored = 0;
  lastForcedRefreshAt = Math.max(lastForcedRefreshAt, stored);
  return lastForcedRefreshAt;
}

/**
 * Promesa con tope de tiempo: resuelve `fallback` si tarda más de `ms`. Las
 * ejecuciones de la tarea van en fila, así que una petición colgada (cambio de
 * antena en la autovía, socket muerto) no puede dejar paradas todas las
 * posiciones que vienen detrás.
 */
function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Escribe la posición en la fila del conductor. Devuelve true si se guardó. */
async function writeFix(profileId, fix) {
  // Cada intento se corta a los 8 s (abortSignal de postgrest-js).
  const update = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    return supabase
      .from("driver_profiles")
      .update({
        current_lat: fix.lat,
        current_lng: fix.lng,
        // Marca de frescura: la hora del FIX, no la de escritura. Un lote que
        // llega con retraso no debe presentarse como posición de ahora mismo.
        // Requiere la migración 0011.
        location_updated_at: new Date(fix.ts).toISOString(),
      })
      .eq("id", profileId)
      // Pedir la fila de vuelta: si la sesión caducó y no se pudo renovar, la
      // petición sale con la clave anónima, la RLS no deja tocar nada y el
      // update "va bien" con 0 filas. Así se nota.
      .select("id")
      .abortSignal(controller.signal)
      .then(
        result => result,
        err => ({ data: null, error: err, status: 0 }),
      )
      .finally(() => clearTimeout(timer));
  };

  // Cada petición de supabase-js ya pasa por auth.getSession(), que renueva el
  // token si está a punto de caducar: no hace falta llamarlo en cada fix. Solo
  // si la escritura falla por sesión se fuerza la renovación y se reintenta
  // UNA vez.
  let { data, error, status } = await update();
  const authProblem =
    status === 401 ||
    status === 403 ||
    /jwt|token|auth/i.test(error?.message || "") ||
    (!error && !data?.length);
  // Como mucho una renovación forzada cada 2 min: si el fallo no es de sesión
  // (fila borrada, sin red), no se machaca al servidor de auth cada 4 s.
  if (authProblem && Date.now() - (await readLastForcedRefresh()) > 120_000) {
    lastForcedRefreshAt = Date.now();
    await AsyncStorage.setItem(FORCED_REFRESH_KEY, String(lastForcedRefreshAt)).catch(() => {});
    await withTimeout(supabase.auth.refreshSession().catch(() => {}), 8000);
    ({ data, error } = await update());
  }
  return !error && !!data?.length;
}

async function handleLocations(locations) {
  // El id del perfil se guardó al arrancar: esta tarea se ejecuta fuera de
  // React (incluso con la app cerrada), así que no puede rehacer el lookup por
  // email ni leer estado de la interfaz.
  const profileId = await AsyncStorage.getItem(PROFILE_KEY);
  if (!profileId) return;

  // Del lote, el fix más reciente con buena precisión, no a ciegas el último:
  // ver pickFix en lib/geo.js.
  const last = await readLastFix();
  const fix = pickFix(locations, last, Date.now());
  if (!fix) return;
  // Parado: dentro del ruido del GPS y hace menos de 20 s de lo escrito. No se
  // escribe ni se toca lo guardado, para que la cuenta de 20 s siga corriendo.
  if (isStillRepeat(last, fix)) return;
  // iPhone: con la app delante iOS entrega una posición por segundo sin
  // agruparlas (el lote de 4 s solo vale en segundo plano). Como mucho una
  // escritura cada ~3,5 s, como en Android; lo saltado no se pierde, el
  // siguiente fix trae la posición más nueva. Va después de isStillRepeat
  // para no tocar el latido del conductor parado (cada 20 s).
  if (Platform.OS === "ios" && last && fix.ts - last.ts < IOS_MIN_WRITE_GAP_MS) return;
  // El GPS puede ir unos segundos por delante del reloj del móvil: nunca se
  // escribe una hora futura, y siempre posterior a la anterior.
  const ts = Math.max(Math.min(fix.ts, Date.now()), (last?.ts || 0) + 1);
  // La precisión se guarda para el filtro de saltos del siguiente lote.
  const accepted = { lat: fix.lat, lng: fix.lng, ts, acc: fix.acc };

  if (!(await writeFix(profileId, accepted))) return;
  await saveLastFix(accepted);

  try {
    await withTimeout(maybeNotifyArrival({ lat: accepted.lat, lng: accepted.lng }), 8000);
  } catch {
    /* el aviso de llegada nunca debe tumbar el seguimiento */
  }
}

/**
 * Cola de UNA sola tanda pendiente. Los lotes que Android entrega mientras se
 * escribe se juntan, y el siguiente turno elige el mejor fix de todo lo
 * acumulado: con mala cobertura no se escriben uno a uno fixes ya viejos
 * antes de llegar a los frescos. Una sola escritura a la vez, en orden.
 */
let pendingLocations = [];
let worker = null;

async function drainPending() {
  try {
    while (pendingLocations.length) {
      const batch = pendingLocations;
      pendingLocations = [];
      // Cada turno, como mucho 25 s (dos intentos de escritura, una
      // renovación de sesión y el aviso de llegada caben de sobra). Nunca se
      // lanza fuera: un error suelto no puede dejar al cliente sin furgoneta.
      await withTimeout(handleLocations(batch), 25_000).catch(() => {});
    }
  } finally {
    worker = null;
  }
}

TaskManager.defineTask(TASK, ({ data, error }) => {
  if (error || !data?.locations?.length) return worker || Promise.resolve();
  pendingLocations = pendingLocations.concat(data.locations);
  if (!worker) worker = drainPending();
  return worker;
});

/**
 * Pide permiso de ubicación en segundo plano y arranca el seguimiento.
 * Devuelve el motivo si no se pudo, para que la pantalla lo explique en vez de
 * fallar en silencio.
 */
export async function startTracking(profileId) {
  if (!profileId) return { ok: false, reason: "Sin perfil de conductor." };

  const foreground = await requestForegroundLocation("driver");
  if (!foreground.granted) {
    return { ok: false, reason: "Necesitamos tu ubicación para que el cliente te siga." };
  }

  // Android pide el permiso de segundo plano por separado y solo después del de
  // primer plano. Sin él, la posición se congela al bloquear la pantalla.
  //
  // iPhone: se pide «Siempre» como mejora (el sistema ofrece el cambio una sola
  // vez), pero NO es imprescindible: con «Al usar la app», el modo de fondo
  // «location» y el indicador azul, el seguimiento arrancado aquí, con la app
  // delante, sigue enviando posiciones con la pantalla bloqueada o en Google
  // Maps (expo-location en iOS solo exige el permiso de primer plano para
  // startLocationUpdatesAsync). Lo que sin «Siempre» no hay es relanzar la app
  // si el sistema la cierra. Por eso en iOS un «no» aquí no bloquea.
  const background = await requestTrackingBackgroundLocation();
  if (!background.granted && Platform.OS !== "ios") {
    return {
      ok: false,
      reason:
        "Falta el permiso «Permitir todo el tiempo». Sin él tu posición deja de actualizarse al bloquear el móvil.",
    };
  }

  await AsyncStorage.setItem(PROFILE_KEY, String(profileId));

  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    // Ya en marcha (p. ej. el conductor reabre el servicio). Si se arrancó con
    // opciones de otra versión de la app, se le pasan las nuevas: volver a
    // llamar a startLocationUpdatesAsync sobre una tarea ya registrada solo
    // actualiza sus opciones y reinicia la captura en el sitio, sin parar el
    // servicio ni la notificación (TaskService.registerTask → setOptions).
    // Solo se puede con la app delante, que es justo cuando se llama esto.
    const version = await AsyncStorage.getItem(OPTIONS_VERSION_KEY).catch(() => null);
    if (version !== OPTIONS_VERSION) {
      try {
        await Location.startLocationUpdatesAsync(TASK, CAPTURE_OPTIONS);
        await AsyncStorage.setItem(OPTIONS_VERSION_KEY, OPTIONS_VERSION).catch(() => {});
      } catch {
        // Sigue con las opciones de antes: peor posición, pero posición.
      }
    }
    return { ok: true };
  }

  // Arranque desde cero: lo escrito en un servicio anterior no cuenta.
  await clearLastFix();
  await Location.startLocationUpdatesAsync(TASK, CAPTURE_OPTIONS);
  await AsyncStorage.setItem(OPTIONS_VERSION_KEY, OPTIONS_VERSION).catch(() => {});

  return { ok: true };
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
  await AsyncStorage.removeItem(PROFILE_KEY);
  await AsyncStorage.removeItem(OPTIONS_VERSION_KEY).catch(() => {});
  await clearLastFix();
}

export async function isTracking() {
  return Location.hasStartedLocationUpdatesAsync(TASK);
}
