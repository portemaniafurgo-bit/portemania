import { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchRouteEta } from "../lib/eta";
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
  const [route, setRoute] = useState(null);
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

  useEffect(() => {
    if (!driverLocation || !target?.lat) {
      setRoute(null);
      onInfo?.({ route: null, freshness: driverLocation ? locationFreshness(driverLocation.updatedAt) : null });
      return;
    }
    let active = true;
    fetchRouteEta(driverLocation, target).then(result => {
      if (active) {
        setRoute(result || null);
        onInfo?.({
          route: result || null,
          freshness: locationFreshness(driverLocation.updatedAt),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [driverLocation?.lat, driverLocation?.lng, driverLocation?.updatedAt, target?.lat, target?.lng]);

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

  const freshness = driverLocation ? locationFreshness(driverLocation.updatedAt) : null;
  // `eta.js` devuelve las coordenadas en orden [lat, lng] porque la web usa
  // Leaflet; GeoJSON (y por tanto MapLibre) las quiere al revés.
  // Si el servicio de rutas no responde (o aún no ha contestado), se une la
  // furgoneta con el destino en línea recta: ver solo el vehículo suelto no
  // dice nada, y una línea aproximada ya orienta.
  const routed = (route?.coords || []).map(([lat, lng]) => [lng, lat]);
  const routeLine =
    routed.length > 1
      ? routed
      : driverLocation && target?.lat
        ? [
            [driverLocation.lng, driverLocation.lat],
            [target.lng, target.lat],
          ]
        : [];
  const approximate = routed.length <= 1;

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

          {routeLine.length > 1 ? (
            <GeoJSONSource
              id="route"
              data={{
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: routeLine },
              }}
            >
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

          {driverLocation ? (
            <Marker id="driver" lngLat={[driverLocation.lng, driverLocation.lat]}>
              <View style={[styles.driverPin, !freshness?.fresh && { backgroundColor: colors.warning }]}>
                <Ionicons name="car" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          ) : null}
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

      {route && !bare ? (
        <Caption>
          {route.km} km por carretera · unos {route.minutes} min
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
