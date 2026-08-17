import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

/**
 * Icono del servicio según el canvas de rediseño: Ionicons sobre morado suave,
 * NADA de emojis (el canvas no usa ni uno). Mapeo:
 *   porte → cube-outline · mini mudanza → car-outline ·
 *   compra en tienda → bag-handle-outline · paquete → cube
 */
export const SERVICE_ICONS = {
  porte: "cube-outline",
  mini_mudanza: "car-outline",
  porte_tienda: "bag-handle-outline",
  paquete: "cube",
};
const ICONS = SERVICE_ICONS;

export default function ServiceIcon({ serviceKey, size = 44, iconSize }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size <= 36 ? radius.md : radius.lg }]}>
      <Ionicons
        name={ICONS[serviceKey] || "cube-outline"}
        size={iconSize || Math.round(size * 0.55)}
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
});
