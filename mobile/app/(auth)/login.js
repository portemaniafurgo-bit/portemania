import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { signInWithGoogle } from "../../lib/googleAuth";
import GoogleButton from "../../components/GoogleButton";
import { Button, Caption, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { colors, spacing } from "../../theme";

/**
 * Login (canvas 2c). Una sola puerta para cliente y conductor: el rol decide a
 * dónde entra (la web tiene /login-clientes y /login-conductores porque allí
 * son dos áreas distintas del sitio; aquí sobra esa distinción).
 *
 * Tras `signInWithPassword`, el listener de AuthProvider actualiza la sesión y
 * el guardia del layout raíz redirige solo. Esta pantalla no navega.
 */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      setError("Escribe tu email y tu contraseña.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : "No se pudo entrar: " + err.message,
      );
      setLoading(false);
    }
    // Si va bien no se hace setLoading(false): la pantalla desaparece con la
    // redirección y tocarla después avisaría de un update sobre un componente
    // desmontado.
  };

  return (
    <Screen>
      <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
        {/* El MISMO logotipo que la web (generado desde Logo.jsx con
            scripts/generate-app-assets.mjs) — la marca es una sola. */}
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 200, height: 56 }}
          resizeMode="contain"
          accessibilityLabel="ClicyVoy"
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Heading>Hola de nuevo</Heading>
        <Caption>Entra y pide tu porte en dos minutos.</Caption>
      </View>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <View style={{ gap: spacing.xs }}>
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            secureTextEntry
            autoComplete="current-password"
          />
          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={styles.link}>¿Has olvidado la contraseña?</Text>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>
        <Button title="Entrar" onPress={submit} loading={loading} />

        {/* Separador «o», como el canvas */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Caption>o</Caption>
          <View style={styles.dividerLine} />
        </View>

        <GoogleButton
          onPress={async () => {
            const result = await signInWithGoogle();
            if (!result.ok && result.reason) setError(result.reason);
          }}
        />
      </View>

      <View style={styles.footer}>
        <Caption>¿Nuevo por aquí?</Caption>
        <Pressable onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.linkStrong}>Crea tu cuenta</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 12.5, fontFamily: "DMSans_500Medium", color: colors.primary, textAlign: "right" },
  linkStrong: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
});
