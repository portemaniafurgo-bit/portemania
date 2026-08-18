import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Caption } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Fila de ajustes del canvas 2i/2j: icono de línea, etiqueta, valor opcional a
 * la derecha y galón. En rojo cuando la acción es destructiva.
 */
export function SettingsRow({ icon, label, value, hint, onPress, danger, last }) {
  const tint = danger ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && onPress && { opacity: 0.7 }]}
    >
      {icon ? (
        <Ionicons name={icon} size={19} color={danger ? colors.destructive : colors.mutedForeground} />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        {hint ? <Caption>{hint}</Caption> : null}
      </View>
      {value ? <Caption>{value}</Caption> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.subtle} /> : null}
    </Pressable>
  );
}

/** Grupo de filas: una sola tarjeta con separadores, como el canvas. */
export function SettingsGroup({ children, style }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontSize: 14.5, fontFamily: "DMSans_500Medium" },
});
