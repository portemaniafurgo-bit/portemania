import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radius, spacing } from "../theme";

/**
 * Botón "Continuar con Google" según las guías de identidad de Google: fondo
 * blanco, borde suave, la "G" multicolor oficial y texto neutro. No se tiñe
 * con el morado de la marca a propósito — Google exige su propia apariencia.
 */
function GoogleG({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </Svg>
  );
}

export default function GoogleButton({ onPress, loading, title = "Continuar con Google" }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: "#F8F9FA" }]}
    >
      {loading ? <ActivityIndicator color={colors.mutedForeground} /> : <GoogleG />}
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DADCE0",
    borderRadius: radius.full,
    paddingVertical: 13,
    minHeight: 48,
  },
  // El texto del botón de Google es gris oscuro neutro, no del color de marca.
  text: { fontSize: 15, fontWeight: "600", color: "#3C4043" },
});
