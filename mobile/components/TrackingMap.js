import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import { fetchRouteEta, straightLineEta } from "../lib/eta";
import { distanceToPolyline, glidePlan, lerpPoint } from "../lib/geo";
import { locationFreshness } from "../lib/orders";
import { Caption } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Mapa de seguimiento con MapLibre y tiles de OpenStreetMap: gratis y sin API
 * key, la misma decisión que tomó la web con Leaflet (Google Maps es de pago).
 *
 * Muestra al conductor, el destino, la ruta por carretera y —lo que la web no
 * tiene— la FRESCURA de la posición: una posición congelada no puede
 * presentarse como si fuera actual.
 */
/** Latitud → Y de Mercator (radianes), y su inversa. */
const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercatorLat = y => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/**
 * Centro y zoom que encuadran dos puntos con margen, calculados AQUÍ y no con
 * el `bounds` nativo: en Android, el encuadre por bounds deja su padding
 * pegado a la cámara para siempre (CameraStop.kt aplica builder.padding con
 * el resultado del fit) y con ese padding el pinch-zoom muere — bug real,
 * 31/08/2026, tres tardes de mapa. Con centro+zoom la cámara queda limpia y
 * los gestos intactos.
 *
 * Tiles de 512 px: al zoom z el mundo mide 512·2^z px, tanto en los 360° de
 * longitud como en los 2π de Y de Mercator.
 */
function fitTwoPoints(a, b, widthPx, heightPx) {
  const PAD = 70; // margen visual alrededor de la ruta, metido en el cálculo
  const usableW = Math.max(50, widthPx - PAD * 2);
  const usableH = Math.max(50, heightPx - PAD * 2);

  const lngSpan = Math.max(Math.abs(a.lng - b.lng), 0.0005);
  const ySpan = Math.max(Math.abs(mercatorY(a.lat) - mercatorY(b.lat)), 0.00001);

  const zoomW = Math.log2((360 * usableW) / (512 * lngSpan));
  const zoomH = Math.log2((2 * Math.PI * usableH) / (512 * ySpan));
  const zoom = Math.max(1, Math.min(zoomW, zoomH, 16));

  const midY = (mercatorY(a.lat) + mercatorY(b.lat)) / 2;
  return { center: [(a.lng + b.lng) / 2, mercatorLat(midY)], zoom };
}

/**
 * Cuándo se vuelve a pedir la ruta a OSRM (servidor público de demo: no se le
 * puede pedir en cada posición, y antes cada respuesta redibujaba la línea):
 * - al cambiar el destino (de la recogida a la entrega);
 * - si el conductor se aparta más de 150 m de la línea dibujada;
 * - y, aunque vaya por ella, cada 45 s, para recalibrar el tiempo.
 * Nunca dos peticiones a la vez ni con menos de 10 s entre ellas. Mientras
 * llega la nueva, o si OSRM falla, se sigue viendo la anterior.
 */
const OFF_ROUTE_M = 150;
const ROUTE_REFRESH_MS = 45_000;
const ROUTE_MIN_GAP_MS = 10_000;
// Sin ninguna ruta buena todavía (OSRM caído), se reintenta cada 15 s.
const ROUTE_RETRY_MS = 15_000;
// Una petición sin respuesta en 20 s se da por muerta (eta.js la corta a los
// 10 s, esto es la red de seguridad) y no bloquea las siguientes.
const ROUTE_DEAD_MS = 20_000;
// La etiqueta «en vivo / hace N min» se recalcula sola cada 15 s: si dejan de
// llegar posiciones, tiene que acabar diciéndolo.
const FRESHNESS_TICK_MS = 15_000;

function timeOf(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

/**
 * La furgoneta, deslizándose de una posición a la siguiente en vez de saltar.
 *
 * Va en su propio componente para que cada fotograma de la animación
 * re-renderice SOLO este marcador, no el mapa entero ni la ruta (cuya fuente
 * GeoJSON se serializa en cada render). En Android el Marker de MapLibre es
 * una vista nativa: cambiarle `lngLat` solo la recoloca sobre el mapa
 * (MLRNMarkerView.setLngLat). Como mucho ~30 repintados por segundo: de sobra
 * para el ojo y la mitad de trabajo en móviles modestos.
 *
 * Sin pegarla a la ruta a propósito: si el GPS dice que va por otra calle, se
 * enseña por donde va.
 */
const DriverMarker = memo(function DriverMarker({ position, stale }) {
  const [shown, setShown] = useState(() => ({ lat: position.lat, lng: position.lng }));
  const shownRef = useRef(shown);
  const prevFixRef = useRef({
    lat: position.lat,
    lng: position.lng,
    ms: timeOf(position.updatedAt),
    receivedAt: Date.now(),
  });
  const frameRef = useRef(null);
  // Con otra pantalla encima (el chat), sin animación: se coloca de golpe y
  // no corre ningún fotograma que nadie ve.
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  const stop = () => {
    if (frameRef.current != null) globalThis.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  useEffect(() => {
    const prev = prevFixRef.current;
    const to = { lat: position.lat, lng: position.lng };
    if (prev.lat === to.lat && prev.lng === to.lng) return;
    const nextMs = timeOf(position.updatedAt);
    const receivedAt = Date.now();
    // Tiempo entre los dos fixes según el GPS; si falta alguna marca, el que
    // pasó entre que llegaron.
    const gapMs = prev.ms != null && nextMs != null ? nextMs - prev.ms : receivedAt - prev.receivedAt;
    prevFixRef.current = { ...to, ms: nextMs, receivedAt };

    // Siempre desde donde está pintada AHORA (quizá a mitad de un
    // deslizamiento), no desde el fix anterior: así no hay tirones.
    stop();
    const from = shownRef.current;
    const plan = glidePlan(from, to, gapMs);
    const paint = point => {
      shownRef.current = point;
      setShown(point);
    };
    if (plan.instant || !focusedRef.current) {
      paint(to);
      return;
    }
    const start = Date.now();
    let lastPaint = 0;
    const step = () => {
      const now = Date.now();
      const t = (now - start) / plan.durationMs;
      if (t >= 1) {
        frameRef.current = null;
        paint(to);
        return;
      }
      if (now - lastPaint >= 33) {
        lastPaint = now;
        paint(lerpPoint(from, to, t));
      }
      frameRef.current = globalThis.requestAnimationFrame(step);
    };
    frameRef.current = globalThis.requestAnimationFrame(step);
  }, [position.lat, position.lng, position.updatedAt]);

  // Al perder el foco a mitad de deslizamiento, a su sitio y sin fotogramas.
  useEffect(() => {
    if (focused || frameRef.current == null) return;
    stop();
    const { lat, lng } = prevFixRef.current;
    shownRef.current = { lat, lng };
    setShown({ lat, lng });
  }, [focused]);

  // Al desmontar, ni un fotograma más.
  useEffect(() => stop, []);

  return (
    <Marker id="driver" lngLat={[shown.lng, shown.lat]}>
      <View style={[styles.driverPin, stale && { backgroundColor: colors.warning }]}>
        <Ionicons name="car" size={18} color="#FFFFFF" />
      </View>
    </Marker>
  );
});

const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export default function TrackingMap({
  driverLocation,
  target,
  height = 260,
  self = false,
  // "pickup" pinta el destino como recogida (morado); cualquier otra cosa, como
  // entrega (negro con bandera).
  targetKind = "dropoff",
  // Modo canvas 1h: solo el mapa (la hoja de encima pinta ETA y frescura por
  // su cuenta vía onInfo), sin borde ni radios.
  bare = false,
  onInfo,
}) {
  // Última ruta BUENA de OSRM hacia el destino actual (null si aún no hay):
  // { coords: [[lat, lng]...], points: [{ lat, lng }...], minutes, km, seconds, meters }.
  const [route, setRoute] = useState(null);
  // Ya se preguntó al menos una vez por este destino: distingue «calculando»
  // de «OSRM no responde, va la estimación en línea recta».
  const [routeTried, setRouteTried] = useState(false);
  /**
   * Cámara, con la API REAL de MapLibre v11: la colocación inicial va en
   * `initialViewState` (se aplica UNA vez al montar) y los reencuadres
   * posteriores por REF (`fitBounds`/`easeTo`). Nada de props de stop en cada
   * render: eso re-aplicaba la cámara mientras el usuario pellizcaba.
   *
   * (Antes se pasaban `centerCoordinate`/`zoomLevel`/`bounds:{ne,sw}`, que son
   * de la v10: la v11 los ignoraba —por eso el mapa salía sin encuadrar— y el
   * objeto de bounds mal formado tumbaba el lado nativo al hacer zoom,
   * pantalla negra incluida. Bug real, 31/08/2026.)
   */
  const [initialFrame, setInitialFrame] = useState(null);
  const cameraRef = useRef(null);
  // Ancho real del mapa (para el cálculo del zoom); mientras no se mida, el
  // de la pantalla, que es su caso habitual.
  const [mapWidth, setMapWidth] = useState(Dimensions.get("window").width);

  // Lo último conocido, en refs: decidir si toca pedir ruta no debe rehacer
  // efectos ni cerrar sobre valores viejos.
  const driverRef = useRef(driverLocation);
  driverRef.current = driverLocation;
  const targetRef = useRef(target);
  targetRef.current = target;
  const routeRef = useRef(null);
  const fetchRef = useRef({ inFlight: false, lastAt: 0, reqId: 0 });
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const maybeFetchRoute = () => {
    const from = driverRef.current;
    const to = targetRef.current;
    if (!from?.lat || !to?.lat) return;
    const st = fetchRef.current;
    const now = Date.now();
    const sinceLast = now - st.lastAt;
    if (st.inFlight && sinceLast < ROUTE_DEAD_MS) return;
    const current = routeRef.current;
    let due;
    if (!current) {
      due = st.lastAt === 0 || sinceLast >= ROUTE_RETRY_MS;
    } else {
      const off = distanceToPolyline(from, current.points)?.distanceM ?? Infinity;
      due = sinceLast >= ROUTE_REFRESH_MS || (off > OFF_ROUTE_M && sinceLast >= ROUTE_MIN_GAP_MS);
    }
    if (!due) return;

    st.inFlight = true;
    st.lastAt = now;
    st.reqId += 1;
    const id = st.reqId;
    fetchRouteEta(from, to)
      .then(result => {
        // Respuesta para un destino anterior, o pantalla cerrada: se tira.
        if (!mountedRef.current || id !== st.reqId) return;
        st.inFlight = false;
        setRouteTried(true);
        // La recta de respaldo (OSRM caído) nunca sustituye a una ruta buena.
        if (result && !result.approximate && result.coords?.length > 1) {
          const next = { ...result, points: result.coords.map(([lat, lng]) => ({ lat, lng })) };
          routeRef.current = next;
          setRoute(next);
        }
      })
      .catch(() => {
        if (id === st.reqId) st.inFlight = false;
      });
  };

  // Destino nuevo (o el primero): la línea vieja lleva a otro sitio, fuera.
  const targetKey = target?.lat ? `${target.lat},${target.lng}` : "";
  useEffect(() => {
    const st = fetchRef.current;
    st.reqId += 1; // invalida la petición en vuelo hacia el destino anterior
    st.inFlight = false;
    st.lastAt = 0;
    routeRef.current = null;
    setRoute(null);
    setRouteTried(false);
    maybeFetchRoute();
  }, [targetKey]);

  // Cada posición nueva solo COMPRUEBA si toca pedir ruta; casi nunca toca.
  useEffect(() => {
    maybeFetchRoute();
  }, [driverLocation?.lat, driverLocation?.lng, driverLocation?.updatedAt]);

  // Reloj de la etiqueta de frescura, solo si hay conductor que vigilar (el
  // mini-mapa de las ofertas no tiene y no gasta temporizador).
  const hasDriver = !!driverLocation;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasDriver) return;
    // El mismo tic reintenta la ruta: con el conductor parado no llegan
    // posiciones nuevas y un primer intento fallido no se repetiría.
    // (maybeFetchRoute solo lee refs, así que vale la de este render.)
    const timer = setInterval(() => {
      setTick(n => n + 1);
      maybeFetchRoute();
    }, FRESHNESS_TICK_MS);
    return () => clearInterval(timer);
  }, [hasDriver]);

  // `tick` no se usa dentro: está en las dependencias para recalcular la
  // antigüedad aunque no llegue posición nueva.
  const freshness = useMemo(
    () => (driverLocation ? locationFreshness(driverLocation.updatedAt) : null),
    [hasDriver, driverLocation?.updatedAt, tick],
  );

  /**
   * Tiempo y distancia que QUEDAN. Con ruta buena, se proyecta la posición
   * sobre ella y se descuenta lo ya recorrido (en proporción a lo que dijo
   * OSRM): el texto baja con cada posición sin volver a preguntar. Sin ruta
   * tras haberlo intentado, la estimación en línea recta de siempre; y antes
   * del primer intento, nada («Calculando ruta…»).
   */
  const routeInfo = useMemo(() => {
    if (!driverLocation?.lat || !target?.lat) return null;
    if (route) {
      const proj = distanceToPolyline(driverLocation, route.points);
      const total = proj?.totalM || 0;
      const frac = proj && total > 0 ? Math.max(0, total - proj.alongM) / total : 1;
      const seconds = (Number.isFinite(route.seconds) ? route.seconds : route.minutes * 60) * frac;
      const meters = (Number.isFinite(route.meters) ? route.meters : route.km * 1000) * frac;
      return {
        minutes: Math.max(1, Math.round(seconds / 60)),
        km: Math.round(meters / 100) / 10,
        coords: route.coords,
      };
    }
    if (!routeTried) return null;
    return straightLineEta(driverLocation, target);
  }, [route, routeTried, driverLocation?.lat, driverLocation?.lng, target?.lat, target?.lng]);

  // ETA y frescura para la hoja de encima, en cada posición y cada tic (antes
  // solo al responder OSRM: con peticiones espaciadas se quedarían viejas).
  useEffect(() => {
    onInfo?.({ route: routeInfo, freshness });
  }, [routeInfo, freshness]);

  /**
   * Línea de la ruta. `eta.js` devuelve [lat, lng] porque la web usa Leaflet;
   * GeoJSON (y por tanto MapLibre) las quiere al revés. Sin ruta buena
   * todavía, una recta a trazos de la furgoneta al destino: ver solo el
   * vehículo suelto no dice nada, y una línea aproximada ya orienta. La ruta
   * buena no se recorta por detrás: la furgoneta se desliza con unos segundos
   * de retraso y un recorte al último fix la dejaría fuera de su línea.
   */
  const routedFeature = useMemo(
    () =>
      route
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route.coords.map(([lat, lng]) => [lng, lat]) },
          }
        : null,
    [route],
  );
  const straightFeature = useMemo(
    () =>
      !route && driverLocation?.lat && target?.lat
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [
                [driverLocation.lng, driverLocation.lat],
                [target.lng, target.lat],
              ],
            },
          }
        : null,
    [route, driverLocation?.lat, driverLocation?.lng, target?.lat, target?.lng],
  );
  const routeFeature = routedFeature || straightFeature;
  const approximate = !routedFeature;

  const center = driverLocation || target;

  /**
   * Encuadre: con la furgoneta Y el destino, centro y zoom que abarcan los
   * dos (la ruta entera, de punta a punta); con uno solo, zoom de calle sobre
   * ese punto. SIEMPRE centro+zoom, nunca el bounds nativo: ver fitTwoPoints.
   */
  const frameFor = () => {
    if (driverLocation?.lat && target?.lat) {
      return fitTwoPoints(driverLocation, target, mapWidth, height);
    }
    const point = driverLocation || target;
    return point?.lat ? { center: [point.lng, point.lat], zoom: 15 } : null;
  };

  /** Aplica un encuadre por ref: lo único que mueve la cámara tras montar. */
  const applyFrame = frame => {
    if (!frame || !cameraRef.current) return;
    cameraRef.current.easeTo({ center: frame.center, zoom: frame.zoom, duration: 600 });
  };

  // Colocación inicial (una sola vez); y si el segundo punto llega DESPUÉS de
  // montar (el GPS suele tardar más que el destino), un único reencuadre.
  const framedBoth = useRef(false);
  useEffect(() => {
    const both = !!(driverLocation?.lat && target?.lat);
    if (!initialFrame) {
      const frame = frameFor();
      if (!frame) return;
      if (both) framedBoth.current = true;
      setInitialFrame(frame);
      return;
    }
    if (both && !framedBoth.current) {
      framedBoth.current = true;
      applyFrame(frameFor());
    }
  }, [initialFrame, driverLocation?.lat, driverLocation?.lng, target?.lat, target?.lng]);

  if (!center?.lat) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Caption>Cuando el conductor empiece el servicio verás su posición aquí.</Caption>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={[bare ? styles.mapBare : styles.map, { height }]}
        onLayout={e => {
          const w = e?.nativeEvent?.layout?.width;
          if (w) setMapWidth(w);
        }}
      >
        {/* Sin encuadre todavía no se pinta: montar el mapa sin coordenadas es
            justo lo que enseñaba el planisferio. */}
        {/* dragPan EXPLÍCITO y no por defecto: en Android, el mapa solo pide
            al ScrollView padre «no me interceptes los dedos» cuando
            scrollEnabled es true, y ese valor nativo arranca en null — sin el
            prop, cada pellizco se lo disputaba el scroll de la página y el
            zoom iba a trompicones (bug real, 31/08/2026). */}
        {!initialFrame ? null : (
        <Map style={{ flex: 1 }} mapStyle={OSM_STYLE} logo={false} dragPan touchZoom>
          {/* La posición inicial va SOLO en initialViewState (se aplica una
              vez); después la cámara es del usuario y solo el botón «centrar»
              (o la llegada del segundo punto) la mueve, por ref. */}
          <Camera ref={cameraRef} initialViewState={initialFrame} />

          {routeFeature ? (
            <GeoJSONSource id="route" data={routeFeature}>
              <Layer
                id="routeLine"
                type="line"
                paint={{
                  "line-color": colors.primary,
                  "line-width": approximate ? 3 : 5,
                  "line-opacity": approximate ? 0.55 : 0.9,
                  // La recta va a trazos para que se vea que es aproximada.
                  ...(approximate ? { "line-dasharray": [2, 2] } : {}),
                }}
              />
            </GeoJSONSource>
          ) : null}

          {target?.lat ? (
            <Marker id="target" lngLat={[target.lng, target.lat]}>
              {/* Canvas 2l: recogida morada, entrega negra con bandera amarilla. */}
              {targetKind === "pickup" ? (
                <View style={[styles.targetPin, { backgroundColor: colors.primary }]} />
              ) : (
                <View style={styles.dropoffPin}>
                  <Ionicons name="flag" size={12} color={colors.accent} />
                </View>
              )}
            </Marker>
          ) : null}

          {driverLocation ? <DriverMarker position={driverLocation} stale={!freshness?.fresh} /> : null}
        </Map>
        )}

        {/* Centrar: el mapa se mueve y se hace zoom con los dedos, así que
            hace falta una forma de volver a lo importante. */}
        <Pressable
          onPress={() => applyFrame(frameFor())}
          style={styles.recenterButton}
          hitSlop={8}
        >
          <Ionicons name="locate" size={18} color={colors.primary} />
        </Pressable>

      </View>

      {freshness && !bare ? (
        <View style={styles.freshness}>
          <View style={[styles.dot, { backgroundColor: freshness.fresh ? colors.success : colors.warning }]} />
          <Caption style={{ color: freshness.fresh ? colors.success : colors.warning }}>
            {/* `self`: quien mira es el propio conductor viendo SU posición. */}
            {freshness.fresh
              ? self
                ? "Tu posición en vivo"
                : "Posición del conductor en vivo"
              : self
                ? `Tu última posición ${freshness.label}`
                : `Última posición del conductor ${freshness.label}`}
          </Caption>
        </View>
      ) : null}

      {routeInfo && !bare ? (
        <Caption>
          {routeInfo.km} km por carretera · unos {routeInfo.minutes} min
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  recenterButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  etaBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
  },
  etaBadgeText: { fontSize: 12.5, fontFamily: "DMSans_700Bold", color: colors.foreground },
  map: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  mapBare: { overflow: "hidden" },
  placeholder: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  driverPin: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  driverPinText: { fontSize: 16 },
  targetPin: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: "#fff",
  },
  dropoffPin: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.foreground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  freshness: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
