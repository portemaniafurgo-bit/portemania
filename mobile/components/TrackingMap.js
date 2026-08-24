import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  // Cada pulsación de «centrar» remonta la cámara; entre medias el mapa es del
  // usuario, que puede arrastrar y hacer zoom con los dedos.
  const [recenter, setRecenter] = useState(0);

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
      <View style={[bare ? styles.mapBare : styles.map, { height }]}>
        <Map style={{ flex: 1 }} mapStyle={OSM_STYLE} logo={false}>
          {/* La cámara solo manda cuando se pulsa «centrar»: si se recolocara
              en cada posición nueva, no habría forma de mover el mapa con los
              dedos ni de hacer zoom (el gesto se perdía al segundo). */}
          <Camera
            key={recenter}
            defaultSettings={{ centerCoordinate: [center.lng, center.lat], zoomLevel: 13 }}
            centerCoordinate={recenter ? [center.lng, center.lat] : undefined}
            zoomLevel={recenter ? 14 : undefined}
            animationDuration={recenter ? 600 : 0}
          />

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

        {/* Centrar: el mapa se mueve y se hace zoom con los dedos, así que
            hace falta una forma de volver a lo importante. */}
        <Pressable
          onPress={() => setRecenter(n => n + 1)}
          style={styles.recenterButton}
          hitSlop={8}
        >
          <Ionicons name="locate" size={18} color={colors.primary} />
        </Pressable>

        {/* Cuánto queda: lo primero que se mira. */}
        {route ? (
          <View style={styles.etaBadge}>
            <Ionicons name="time-outline" size={13} color={colors.foreground} />
            <Text style={styles.etaBadgeText}>
              {route.minutes} min · {String(route.km).replace(".", ",")} km
            </Text>
          </View>
        ) : null}
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
