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
import { button, colors, radius, spacing, typography } from "../theme";

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

/** Título de pantalla grande del canvas (27 px, dos líneas en el paso 1). */
export function Display({ children, style }) {
  return <Text style={[typography.display, style]}>{children}</Text>;
}

export function Heading({ children, style }) {
  return <Text style={[typography.heading, style]}>{children}</Text>;
}

/** Etiqueta de sección: «PRECIO CERRADO CLICYVOY», «¿CUÁNDO?», «PAGO». */
export function Overline({ children, style }) {
  return <Text style={[typography.overline, style]}>{children}</Text>;
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

/**
 * Botón principal del canvas: 54 de alto, radio 27, Poppins 600 16. `icon` va
 * delante; `iconAfter` detrás (la flecha de «Continuar con …»).
 */
export function Button({
  title,
  icon,
  iconAfter,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
}) {
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
          {iconAfter ? (
            <Ionicons
              name={iconAfter}
              size={18}
              color={isPlain ? colors.primary : colors.primaryForeground}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {/* Etiqueta en versalitas, como rotula el canvas los campos (EMAIL,
          CONTRASEÑA, DESCRIPCIÓN…). */}
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
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
  screenContent: { padding: spacing.screen, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg, // 20, el radio de tarjeta del canvas
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: spacing.md,
  },
  button: {
    // 54 × radio 27, la medida exacta del canvas (y objetivo táctil cómodo:
    // la app se usa conduciendo o cargando).
    height: button.height,
    borderRadius: button.radius,
    paddingHorizontal: spacing.screen,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPrimaryPressed: { backgroundColor: colors.primaryPressed },
  buttonPlain: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: button.fontSize,
    fontFamily: "Poppins_600SemiBold",
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 14.5,
    fontFamily: "DMSans_400Regular",
    color: colors.foreground,
  },
  // «EMAIL», «DESCRIPCIÓN»…: DM Sans 500 12 en gris claro, como el canvas.
  fieldLabel: { ...typography.overline, textTransform: "uppercase" },
  errorText: { color: colors.destructive, fontSize: 12, fontFamily: "DMSans_400Regular" },
  // Fondo explícito: un contenedor transparente a pantalla completa se ve
  // NEGRO sobre el fondo de la ventana de Android.
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
});
