import { ActivityIndicator, Platform, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing } from "../theme";

/**
 * Botón «Continuar con Apple» según las guías de Apple: fondo negro, logotipo
 * de Apple blanco y texto blanco en la fuente del sistema, del MISMO tamaño
 * que el de Google y colocado antes que él (Apple exige que su opción sea al
 * menos igual de visible que cualquier otro acceso con terceros).
 *
 * Solo existe en iPhone: en Android no se pinta nada, así la pantalla de
 * Android queda exactamente igual.
 */
export default function AppleButton({ onPress, loading, title = "Continuar con Apple" }) {
  if (Platform.OS !== "ios") return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
      )}
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: "#000000",
    borderRadius: radius.full,
    paddingVertical: 13,
    minHeight: 48,
  },
  // Fuente del sistema (San Francisco), como pide Apple para este botón.
  text: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
});
