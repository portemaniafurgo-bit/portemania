import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Button, Caption, ErrorText, Field, Heading, Screen } from "../components/ui";
import { spacing } from "../theme";

/**
 * Lo que Google no trae: el teléfono (y el nombre, si la cuenta no lo tenía).
 *
 * Se pide UNA vez, justo después del primer acceso. Sin teléfono el conductor
 * no puede llamar al cliente ni el cliente al conductor, y eso en un porte no
 * es un extra: es cómo se resuelven los «no encuentro el portal».
 */
export default function CompletarPerfil() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const cleanPhone = phone.replace(/\s+/g, "");
    if (!fullName.trim()) {
      setError("Dinos tu nombre.");
      return;
    }
    // Un móvil español son 9 dígitos; se admite el +34 delante.
    if (!/^(\+34)?[67]\d{8}$/.test(cleanPhone)) {
      setError("Escribe un móvil válido (9 dígitos, empieza por 6 o 7).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), phone: cleanPhone },
      });
      if (err) throw err;
      router.replace(role === "driver" ? "/(conductor)/ofertas" : "/(cliente)/pedir");
    } catch (err) {
      setError("No se pudieron guardar los datos: " + (err.message || "error de conexión"));
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Heading>Un último dato</Heading>
        <Caption>
          Tu cuenta de Google ya nos dio el email. Solo falta el teléfono, para que el conductor y
          tú podáis llamaros durante el servicio.
        </Caption>
      </View>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="Nombre y apellidos"
          value={fullName}
          onChangeText={setFullName}
          placeholder="María López García"
        />
        <Field
          label="Teléfono móvil"
          value={phone}
          onChangeText={setPhone}
          placeholder="612 45 78 90"
          keyboardType="phone-pad"
          inputMode="tel"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Guardar y empezar" loading={saving} onPress={save} />
      </View>

      <Caption>
        Solo lo ve el conductor de tu servicio. Podrás cambiarlo cuando quieras desde tu perfil.
      </Caption>
    </Screen>
  );
}
