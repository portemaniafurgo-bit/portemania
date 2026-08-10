import { useState } from "react";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Body, Button, Card, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Recuperar contraseña. El email lo envía Supabase con la plantilla en español
 * ya configurada, y el enlace lleva a /reset-password EN LA WEB: allí ya está
 * resuelto el flujo con token_hash (a prueba de escáneres de correo, ver
 * SEGUIMIENTO 2026-07-06). No hay motivo para duplicar esa pantalla en la app.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
  };

  return (
    <Screen>
      <Heading style={{ marginTop: 24 }}>Recuperar contraseña</Heading>
      <Card>
        {sent ? (
          <Body>
            Si existe una cuenta con ese email, te hemos enviado un enlace para crear una contraseña
            nueva. Revisa también la carpeta de spam.
          </Body>
        ) : (
          <>
            <Body>Te enviaremos un enlace para crear una contraseña nueva.</Body>
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
          </>
        )}
        <Link href="/(auth)/login" asChild>
          <Body style={{ textAlign: "center", color: colors.primary }}>Volver a entrar</Body>
        </Link>
      </Card>
    </Screen>
  );
}
