import { useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Camera, Map } from "@maplibre/maplibre-react-native";
import { Ionicons } from "@expo/vector-icons";
import { addressFromCoords } from "../lib/addresses";
import { Button, Caption, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * "Ajustar en el mapa": el pin queda FIJO en el centro y lo que se arrastra es
 * el mapa — el patrón de Uber/Glovo, más fino que arrastrar un marcador con el
 * dedo gordo. Al confirmar, el centro se convierte en dirección con el mismo
 * geocodificador inverso gratuito del resto de la app.
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

const ALBACETE = [-1.8585, 38.9943];

export default function MapPicker({ visible, initial, zone = "albacete", onConfirm, onClose }) {
  const center = useRef(initial?.lng ? [initial.lng, initial.lat] : ALBACETE);
  const [resolving, setResolving] = useState(false);
  const [hint, setHint] = useState("");

  const confirm = async () => {
    setResolving(true);
    setHint("");
    try {
      const [lng, lat] = center.current;
      const address = await addressFromCoords({ lat, lng }, { zone });
      if (!address) {
        setHint("No hay dirección reconocible en ese punto. Acércalo a un portal.");
        return;
      }
      onConfirm(address);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Title>Coloca el punto exacto</Title>
          <Caption>Mueve el mapa hasta dejar el pin sobre el portal.</Caption>
        </View>

        <View style={{ flex: 1 }}>
          <Map
            style={{ flex: 1 }}
            mapStyle={OSM_STYLE}
            logo={false}
            onRegionDidChange={e => {
              const next = e?.nativeEvent?.center;
              if (next) center.current = next;
            }}
          >
            <Camera
              initialViewState={{ center: center.current, zoom: initial?.lng ? 17 : 13 }}
            />
          </Map>
          {/* El pin vive FUERA del mapa, clavado en el centro de la pantalla. */}
          <View pointerEvents="none" style={styles.pinWrap}>
            <Ionicons name="location" size={46} color={colors.primary} style={styles.pin} />
          </View>
        </View>

        <View style={styles.footer}>
          {hint ? <Caption style={{ color: colors.warning }}>{hint}</Caption> : null}
          <Button title="Usar este punto" onPress={confirm} loading={resolving} />
          <Button title="Cancelar" variant="plain" onPress={onClose} disabled={resolving} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.xs },
  footer: { padding: spacing.lg, gap: spacing.sm },
  pinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  // El emoji apunta con la punta abajo: se sube media altura para que la punta
  // caiga en el centro real del mapa.
  pin: { marginBottom: 46 },
});
