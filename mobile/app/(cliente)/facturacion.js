import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { Button, Caption, Card, ErrorText, Field, Heading, Loading, Screen } from "../../components/ui";
import { Toggle } from "../../components/wizard";
import { spacing } from "../../theme";

/**
 * Datos de facturación del cliente.
 *
 * Se piden al registrarse (opcional) y se pueden cambiar aquí. Sin NIF no hay
 * factura: solo recibo. Quien pide un porte para su casa no necesita rellenar
 * nada; quien lo necesita para su empresa, lo rellena una vez y ya sale en
 * todas sus facturas.
 */
export default function Facturacion({ embedded = false, onSaved }) {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("billing_name, billing_tax_id, billing_address, billing_city, billing_postal_code, billing_is_company")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) =>
        setForm({
          billing_name: data?.billing_name || user.user_metadata?.full_name || "",
          billing_tax_id: data?.billing_tax_id || "",
          billing_address: data?.billing_address || "",
          billing_city: data?.billing_city || "Albacete",
          billing_postal_code: data?.billing_postal_code || "",
          billing_is_company: !!data?.billing_is_company,
        }),
      );
  }, [user?.id]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      // El NIF se guarda sin espacios y en mayúsculas: es lo que espera
      // Hacienda y evita duplicados tontos al compararlo.
      const payload = {
        ...form,
        billing_tax_id: (form.billing_tax_id || "").replace(/\s+/g, "").toUpperCase() || null,
        billing_name: form.billing_name?.trim() || null,
        billing_address: form.billing_address?.trim() || null,
        billing_city: form.billing_city?.trim() || null,
        billing_postal_code: form.billing_postal_code?.trim() || null,
      };
      const { error: err } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (err) throw err;
      setSaved(true);
      onSaved?.();
      if (!embedded) router.back();
    } catch (err) {
      setError("No se pudieron guardar los datos: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Loading label="Cargando tus datos…" />;

  const fields = (
    <>
      <Toggle
        label="Facturar a nombre de una empresa"
        description="Si lo apagas, la factura irá a tu nombre"
        value={form.billing_is_company}
        onValueChange={v => update("billing_is_company", v)}
      />
      <Field
        label={form.billing_is_company ? "Razón social" : "Nombre y apellidos"}
        value={form.billing_name}
        onChangeText={v => update("billing_name", v)}
        placeholder={form.billing_is_company ? "Transportes Ejemplo S.L." : "María López García"}
      />
      <Field
        label={form.billing_is_company ? "CIF" : "NIF"}
        value={form.billing_tax_id}
        onChangeText={v => update("billing_tax_id", v)}
        placeholder={form.billing_is_company ? "B02123456" : "02123456X"}
        autoCapitalize="characters"
      />
      <Field
        label="Dirección fiscal"
        value={form.billing_address}
        onChangeText={v => update("billing_address", v)}
        placeholder="Calle Tesifonte Gallego, 12, 3º B"
      />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ width: 120 }}>
          <Field
            label="Código postal"
            value={form.billing_postal_code}
            onChangeText={v => update("billing_postal_code", v)}
            placeholder="02001"
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Población"
            value={form.billing_city}
            onChangeText={v => update("billing_city", v)}
            placeholder="Albacete"
          />
        </View>
      </View>
      <ErrorText>{error}</ErrorText>
    </>
  );

  // Dentro del registro se pinta sin cabecera ni pantalla propia.
  if (embedded) {
    return (
      <View style={{ gap: spacing.lg }}>
        {fields}
        <Button
          title={saved ? "Datos guardados" : "Guardar datos de facturación"}
          loading={saving}
          onPress={save}
        />
      </View>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Datos de facturación" }} />
      <Heading>¿A nombre de quién facturamos?</Heading>
      <Caption>
        El servicio lo presta el conductor, que es transportista autónomo: la factura la emite él
        con estos datos. Si no los rellenas, recibirás un recibo simple.
      </Caption>
      <Card>{fields}</Card>
      <Button
        title={saved ? "Datos guardados" : "Guardar"}
        loading={saving}
        onPress={save}
      />
    </Screen>
  );
}
