import { useState } from "react";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Alta de cliente. El rol NO se manda desde aquí: `handle_new_user` en la BD
 * asigna 'client' y tiene una lista blanca precisamente para que nadie pueda
 * darse de alta como admin (escalada cerrada en la migración 0003).
 *
 * El proyecto tiene autoconfirmación de email activada, así que al registrarse
 * ya hay sesión y el guardia del layout entra directo.
 */
export default function Register() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const mail = email.trim().toLowerCase();
    if (!fullName.trim() || !mail || !password) {
      setError("Nombre, email y contraseña son obligatorios.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setError("");
    setLoading(true);

    const { data, error: err } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
    });

    if (err) {
      setError("No se pudo crear la cuenta: " + err.message);
      setLoading(false);
      return;
    }
    // Supabase devuelve un usuario con identities vacío cuando el email YA
    // existe (no lo trata como error, para no filtrar qué correos hay dados de
    // alta). Sin este aviso el usuario se queda mirando una pantalla que no
    // avanza — mismo caso que se arregló en la web.
    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError("Ya existe una cuenta con ese email. Entra con tu contraseña.");
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Heading style={{ marginTop: 24 }}>Crear cuenta</Heading>
      <Card>
        <Field label="Nombre y apellidos" value={fullName} onChangeText={setFullName} placeholder="María García" />
        <Field
          label="Teléfono"
          value={phone}
          onChangeText={setPhone}
          placeholder="600 000 000"
          keyboardType="phone-pad"
          inputMode="tel"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="email"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Crear cuenta" onPress={submit} loading={loading} />
      </Card>

      <Card>
        <Body>¿Ya tienes cuenta?</Body>
        <Link href="/(auth)/login" asChild>
          <Button title="Entrar" variant="plain" />
        </Link>
      </Card>

      <Caption style={{ textAlign: "center", color: colors.mutedForeground }}>
        Al crear la cuenta aceptas los términos y la política de privacidad de ClicyVoy.
      </Caption>
    </Screen>
  );
}
