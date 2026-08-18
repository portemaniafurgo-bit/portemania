import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { Body, Button, Caption, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Recuperar contraseña (canvas 2e), con sus dos estados: pedir el email y
 * «Mira tu correo» con la cuenta atrás del reenvío.
 *
 * El email lo envía Supabase con la plantilla en español ya configurada, y el
 * enlace lleva a /reset-password EN LA WEB: allí ya está resuelto el flujo con
 * token_hash (a prueba de escáneres de correo, ver SEGUIMIENTO 2026-07-06). No
 * hay motivo para duplicar esa pantalla en la app.
 */
const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail) {
      setError("Escribe tu email.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo: "https://clicyvoy.es/reset-password",
    });
    setLoading(false);
    if (err) {
      setError("No se pudo enviar el email: " + err.message);
      return;
    }
    setSent(true);
    setCountdown(RESEND_SECONDS);
  };

  if (sent) {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xxl }}>
          <View style={styles.mailIcon}>
            <Ionicons name="mail-outline" size={30} color={colors.primary} />
          </View>
          <Heading>Mira tu correo</Heading>
          <Body style={{ textAlign: "center" }}>
            Te hemos enviado el enlace a {email.trim().toLowerCase()}. Caduca en 30 minutos.
          </Body>
          <Caption style={{ textAlign: "center" }}>
            Si no aparece, revisa la carpeta de spam.
          </Caption>
        </View>

        <Button
          title={
            countdown > 0
              ? `Reenviar en 0:${String(countdown).padStart(2, "0")}`
              : "Reenviar el enlace"
          }
          variant="plain"
          disabled={countdown > 0 || loading}
          loading={loading}
          onPress={submit}
        />
        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.link}>Volver a entrar</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Heading>Recupera el acceso</Heading>
        <Caption>
          Escribe tu email y te mandamos un enlace para poner una contraseña nueva.
        </Caption>
      </View>

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Enviar enlace" onPress={submit} loading={loading} />

      <Pressable onPress={() => router.replace("/(auth)/login")}>
        <Text style={styles.link}>Volver a entrar</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mailIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  link: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary, textAlign: "center" },
});
