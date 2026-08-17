import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, typography } from "../theme";

/**
 * Piezas de UI mínimas y compartidas, con el mismo lenguaje visual que la web
 * (tarjetas redondeadas, azul primario, bordes suaves). Deliberadamente
 * pequeñas: cada pantalla compone con estas en vez de inventar estilos.
 */

export function Screen({ children, scroll = true, style }) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Body
        style={{ flex: 1 }}
        contentContainerStyle={scroll ? [styles.screenContent, style] : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {!scroll ? <View style={[styles.screenContent, { flex: 1 }, style]}>{children}</View> : children}
      </Body>
    </SafeAreaView>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children, style }) {
  return <Text style={[typography.heading, style]}>{children}</Text>;
}

export function Title({ children, style }) {
  return <Text style={[typography.title, style]}>{children}</Text>;
}

export function Body({ children, style }) {
  return <Text style={[typography.body, style]}>{children}</Text>;
}

export function Caption({ children, style }) {
  return <Text style={[typography.caption, style]}>{children}</Text>;
}

export function Button({ title, icon, onPress, loading, disabled, variant = "primary", style }) {
  const isPlain = variant !== "primary";
  const blocked = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.button,
        isPlain ? styles.buttonPlain : styles.buttonPrimary,
        blocked && styles.buttonDisabled,
        // Al pulsar, el primario oscurece al morado de hover de la landing;
        // el plano se atenúa.
        pressed && !blocked && (isPlain ? styles.buttonPressed : styles.buttonPrimaryPressed),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPlain ? colors.primary : colors.primaryForeground} />
      ) : (
        <View style={styles.buttonInner}>
          {/* Ionicons, como el canvas: nada de emojis en la interfaz. */}
          {icon ? (
            <Ionicons name={icon} size={18} color={isPlain ? colors.primary : colors.primaryForeground} />
          ) : null}
          {title ? (
            <Text style={[styles.buttonText, isPlain && { color: colors.primary }]}>{title}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Caption>{label}</Caption> : null}
      <TextInput
        style={[styles.input, error && { borderColor: colors.destructive }]}
        placeholderTextColor={colors.mutedForeground}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.errorText}>{children}</Text>;
}

export function Loading({ label = "Cargando…" }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Caption>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    // rounded-full: la forma de botón de la landing.
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48, // objetivo táctil cómodo: se usa conduciendo o cargando
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed },
  buttonPlain: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  buttonText: { color: colors.primaryForeground, fontSize: 16, fontFamily: "DMSans_700Bold" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: colors.foreground,
  },
  errorText: { color: colors.destructive, fontSize: 13, fontFamily: "DMSans_400Regular" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
});
