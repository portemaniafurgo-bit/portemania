import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Icono del servicio, EXACTAMENTE los del canvas (artboard 1b): Ionicons sobre
 * morado suave, nada de emojis.
 *   porte → cube-outline · mini mudanza → home-outline ·
 *   compra en tienda → bag-handle-outline · paquete → mail-open-outline
 */
export const SERVICE_ICONS = {
  porte: "cube-outline",
  mini_mudanza: "home-outline",
  porte_tienda: "bag-handle-outline",
  paquete: "mail-open-outline",
};
const ICONS = SERVICE_ICONS;

export default function ServiceIcon({ serviceKey, size = 44, iconSize }) {
  // Caja de 48 con radio 16 en el canvas: la proporción se mantiene al escalar.
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: Math.round(size / 3) }]}>
      <Ionicons
        name={ICONS[serviceKey] || "cube-outline"}
        size={iconSize || Math.round(size * 0.5)}
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
});
