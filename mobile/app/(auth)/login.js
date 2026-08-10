import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { colors, spacing } from "../../theme";

/**
 * Login con email y contraseña. Una sola puerta para cliente y conductor: el
 * rol decide a dónde entra (la web tiene /login-clientes y /login-conductores
 * porque allí son dos áreas distintas del sitio; aquí sobra esa distinción).
 *
 * Tras `signInWithPassword`, el listener de AuthProvider actualiza la sesión y
 * el guardia del layout raíz redirige solo. Esta pantalla no navega.
 */
export default function Login() {
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
      <View style={{ gap: spacing.xs, marginTop: spacing.xxl }}>
        <Heading style={{ fontSize: 28 }}>
          Clic<Body style={{ fontSize: 28, fontWeight: "700", color: colors.primary }}>yVoy</Body>
        </Heading>
        <Caption>Portes y mudanzas en Albacete, cuando los necesitas.</Caption>
      </View>

      <Card>
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
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Tu contraseña"
          secureTextEntry
          autoComplete="current-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Entrar" onPress={submit} loading={loading} />
        <Link href="/(auth)/forgot-password" asChild>
          <Caption style={{ textAlign: "center", color: colors.primary }}>
            He olvidado mi contraseña
          </Caption>
        </Link>
      </Card>

      <Card>
        <Body>¿Aún no tienes cuenta?</Body>
        <Link href="/(auth)/register" asChild>
          <Button title="Crear cuenta" variant="plain" />
        </Link>
      </Card>
    </Screen>
  );
}
