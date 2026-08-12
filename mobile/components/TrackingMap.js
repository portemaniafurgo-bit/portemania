import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
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

export default function TrackingMap({ driverLocation, target, height = 260, self = false }) {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    if (!driverLocation || !target?.lat) {
      setRoute(null);
      return;
    }
    let active = true;
    fetchRouteEta(driverLocation, target).then(result => {
      if (active) setRoute(result || null);
    });
    return () => {
      active = false;
    };
  }, [driverLocation?.lat, driverLocation?.lng, target?.lat, target?.lng]);

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
  const routeLine = (route?.coords || []).map(([lat, lng]) => [lng, lat]);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.map, { height }]}>
        <Map style={{ flex: 1 }} mapStyle={OSM_STYLE} logo={false}>
          <Camera center={[center.lng, center.lat]} zoom={13} />

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
                paint={{ "line-color": colors.primary, "line-width": 4, "line-opacity": 0.8 }}
              />
            </GeoJSONSource>
          ) : null}

          {target?.lat ? (
            <Marker id="target" lngLat={[target.lng, target.lat]}>
              <View style={styles.targetPin} />
            </Marker>
          ) : null}

          {driverLocation ? (
            <Marker id="driver" lngLat={[driverLocation.lng, driverLocation.lat]}>
              <View style={[styles.driverPin, !freshness?.fresh && { backgroundColor: colors.warning }]}>
                <Text style={styles.driverPinText}>🚐</Text>
              </View>
            </Marker>
          ) : null}
        </Map>
      </View>

      {freshness ? (
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

      {route ? (
        <Caption>
          {route.km} km por carretera · unos {route.minutes} min
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
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
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
    borderWidth: 2,
    borderColor: "#fff",
  },
  freshness: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
