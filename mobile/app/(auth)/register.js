import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { Button, Caption, ErrorText, Field, Heading, Screen } from "../../components/ui";
import { Toggle } from "../../components/wizard";
import { colors, radius, spacing } from "../../theme";

/**
 * Alta de cliente (canvas 2d). El rol NO se manda desde aquí:
 * `handle_new_user` en la BD asigna 'client' y tiene una lista blanca
 * precisamente para que nadie pueda darse de alta como admin (escalada cerrada
 * en la migración 0003).
 *
 * El proyecto tiene autoconfirmación de email activada, así que al registrarse
 * ya hay sesión y el guardia del layout entra directo.
 */

/** Fuerza de la contraseña, con el vocabulario del canvas. */
function strengthOf(password) {
  if (!password) return null;
  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (password.length < 6) return { label: "Muy corta", level: 1, color: colors.destructive };
  if (password.length >= 10 && variety >= 3) return { label: "Fuerte", level: 3, color: colors.success };
  if (password.length >= 8 || variety >= 2) return { label: "Aceptable", level: 2, color: colors.warning };
  return { label: "Débil", level: 1, color: colors.destructive };
}

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  // Aviso propio del email ya registrado: en el canvas vive DEBAJO del campo,
  // con su enlace para entrar, no en el error general del formulario.
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = strengthOf(password);

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
    if (!accepted) {
      setError("Acepta los términos y la política de privacidad para continuar.");
      return;
    }
    setError("");
    setEmailTaken(false);
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
      setEmailTaken(true);
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Heading style={{ marginTop: spacing.xl }}>Crea tu cuenta</Heading>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="Nombre y apellidos"
          value={fullName}
          onChangeText={setFullName}
          placeholder="María López"
        />

        {/* Teléfono con el prefijo fijo delante, como el canvas */}
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.label}>Teléfono</Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+34</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Field
                value={phone}
                onChangeText={setPhone}
                placeholder="612 45 78 90"
                keyboardType="phone-pad"
                inputMode="tel"
              />
            </View>
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <Field
            label="Email"
            value={email}
            onChangeText={v => {
              setEmail(v);
              setEmailTaken(false);
            }}
            placeholder="tu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            inputMode="email"
            error={emailTaken ? " " : ""}
          />
          {emailTaken ? (
            <View style={styles.inlineNotice}>
              <Caption style={{ color: colors.destructive }}>
                Ya hay una cuenta con este email.
              </Caption>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.link}>Entra aquí</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
          />
          {strength ? (
            <View style={styles.strengthRow}>
              <View style={styles.strengthBars}>
                {[1, 2, 3].map(level => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: level <= strength.level ? strength.color : colors.border },
                    ]}
                  />
                ))}
              </View>
              <Caption style={{ color: strength.color }}>{strength.label}</Caption>
            </View>
          ) : null}
        </View>

        <Toggle
          label="Acepto los términos y la política de privacidad"
          value={accepted}
          onValueChange={setAccepted}
        />
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL("https://clicyvoy.es/terminos")}>
            <Text style={styles.link}>Términos</Text>
          </Pressable>
          <Caption>·</Caption>
          <Pressable onPress={() => Linking.openURL("https://clicyvoy.es/privacidad")}>
            <Text style={styles.link}>Política de privacidad</Text>
          </Pressable>
        </View>

        <ErrorText>{error}</ErrorText>
        <Button title="Crear cuenta" onPress={submit} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Caption>¿Ya tienes cuenta?</Caption>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.linkStrong}>Entrar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11.5,
    fontFamily: "DMSans_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  prefix: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.secondary,
  },
  prefixText: { fontSize: 14.5, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  inlineNotice: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  link: { fontSize: 12.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  linkStrong: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  strengthBars: { flexDirection: "row", gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: radius.full },
  legalRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: -spacing.sm },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm },
});
