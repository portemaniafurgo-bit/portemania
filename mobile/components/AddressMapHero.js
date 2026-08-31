import { StyleSheet, View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

/**
 * Mapa de fondo del paso de direcciones (canvas 1c: «Direcciones sobre el
 * mapa, hoja arrastrable»). Muestra Albacete y, en cuanto existen, los pines
 * de recogida (morado) y entrega (negro). Es contexto visual: la edición
 * ocurre en la hoja que va por encima.
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

const ALBACETE = { lat: 38.9943, lng: -1.8585 };

export default function AddressMapHero({ origin, destination, height = 210 }) {
  const focus = origin || destination || ALBACETE;
  return (
    <View style={[styles.wrap, { height }]}>
      {/* dragPan explícito: sin él, el nativo nunca bloquea al scroll padre
          y los gestos sobre el mapa van a trompicones (ver TrackingMap). */}
      <Map style={{ flex: 1 }} mapStyle={OSM_STYLE} logo={false} dragPan touchZoom>
        <Camera center={[focus.lng, focus.lat]} zoom={origin || destination ? 14 : 12.5} />
        {origin ? (
          <Marker id="hero-origin" lngLat={[origin.lng, origin.lat]}>
            <View style={[styles.pin, { backgroundColor: colors.primary }]}>
              <Ionicons name="arrow-up" size={13} color="#FFFFFF" />
            </View>
          </Marker>
        ) : null}
        {destination ? (
          <Marker id="hero-destination" lngLat={[destination.lng, destination.lat]}>
            <View style={[styles.pin, { backgroundColor: colors.foreground }]}>
              <Ionicons name="flag" size={12} color="#FFFFFF" />
            </View>
          </Marker>
        ) : null}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  pin: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
