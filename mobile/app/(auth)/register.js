import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { signInWithGoogle } from "../../lib/googleAuth";
import GoogleButton from "../../components/GoogleButton";
import { Caption, ErrorText, Heading, Screen } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Alta SOLO con Google (decisión de negocio, 27/08/2026).
 *
 * Fuera el formulario de nombre/email/contraseña: una cuenta de Google ya trae
 * el email verificado y el nombre, y nos quita de encima contraseñas olvidadas
 * y emails con erratas. Lo que Google no trae (el teléfono) se pide UNA vez
 * justo después de entrar, en la pantalla de completar perfil.
 *
 * El login con contraseña sigue existiendo para las cuentas antiguas.
 */
const VENTAJAS = [
  { icon: "flash-outline", text: "Entras en un toque, sin formularios" },
  { icon: "shield-checkmark-outline", text: "Tu email ya llega verificado" },
  { icon: "key-outline", text: "Sin otra contraseña que recordar" },
];

export default function Register() {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Heading>Crea tu cuenta</Heading>
        <Caption>El registro es con tu cuenta de Google. Rápido y sin contraseñas.</Caption>
      </View>

      <View style={{ gap: spacing.md }}>
        {VENTAJAS.map(v => (
          <View key={v.icon} style={styles.ventaja}>
            <View style={styles.icono}>
              <Ionicons name={v.icon} size={18} color={colors.primary} />
            </View>
            <Caption style={{ flex: 1, fontSize: 13.5 }}>{v.text}</Caption>
          </View>
        ))}
      </View>

      <GoogleButton
        onPress={async () => {
          setError("");
          const result = await signInWithGoogle();
          if (!result.ok && result.reason) setError(result.reason);
          // Si va bien, el guardia del layout raíz lleva a completar el perfil
          // (teléfono) y de ahí a la app. Esta pantalla no navega.
        }}
      />
      <ErrorText>{error}</ErrorText>

      <View style={styles.footer}>
        <Caption>¿Ya tienes cuenta con contraseña?</Caption>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.link}>Entrar</Text>
        </Pressable>
      </View>

      <Caption style={{ textAlign: "center" }}>
        Al crear la cuenta aceptas los términos y la política de privacidad de ClicyVoy.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ventaja: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icono: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
});
