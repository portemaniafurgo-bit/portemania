import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Caption, ErrorText, Field } from "../ui";
import { Section } from "./ui";
import { reasonMessage, updatePayoutData } from "../../lib/partners";
import { colors, spacing } from "../../theme";

/**
 * Titular e IBAN para cobrar. Guardados, el IBAN se enseña enmascarado (la
 * base de datos solo devuelve los 4 últimos dígitos).
 */
export default function PayoutDataCard({ payoutData, onSaved }) {
  const present = !!payoutData?.present;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const showForm = !present || editing;

  return (
    <Section
      title="Datos de cobro"
      icon="business-outline"
      action={
        !showForm ? (
          <Pressable
            onPress={() => {
              setSaved(false);
              setEditing(true);
            }}
            hitSlop={10}
          >
            <Text style={{ color: colors.primary, fontFamily: "DMSans_500Medium", fontSize: 14 }}>
              Cambiar
            </Text>
          </Pressable>
        ) : null
      }
    >
      {!showForm ? (
        <View style={{ gap: 4 }}>
          <Caption>
            Titular: <Text style={{ color: colors.foreground }}>{payoutData.holder}</Text>
          </Caption>
          <Caption>
            IBAN:{" "}
            <Text style={{ color: colors.foreground }}>•••• •••• •••• {payoutData.iban_last4}</Text>
          </Caption>
          {saved ? <Caption style={{ color: colors.success }}>Datos de cobro guardados.</Caption> : null}
        </View>
      ) : (
        <PayoutForm
          defaultHolder={payoutData?.holder || ""}
          canCancel={present}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
            onSaved?.();
          }}
        />
      )}
    </Section>
  );
}

function PayoutForm({ defaultHolder, canCancel, onCancel, onSaved }) {
  const [holder, setHolder] = useState(defaultHolder);
  const [iban, setIban] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false); // guarda síncrona contra el doble toque

  const submit = async () => {
    if (savingRef.current) return;
    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (holder.trim().length < 3) {
      setError(reasonMessage("bad_holder"));
      return;
    }
    const looksOk = cleanIban.startsWith("ES")
      ? /^ES[0-9]{22}$/.test(cleanIban)
      : /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleanIban);
    if (!looksOk) {
      setError(reasonMessage("bad_iban"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    let ok = false;
    try {
      const res = await updatePayoutData(holder.trim(), cleanIban);
      if (res.ok) ok = true;
      else setError(res.message);
    } catch {
      setError("No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (ok) onSaved();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Field
        label="Titular de la cuenta"
        value={holder}
        maxLength={120}
        onChangeText={value => {
          setHolder(value);
          setError("");
        }}
        placeholder="Nombre y apellidos"
        autoComplete="name"
      />
      <Field
        label="IBAN"
        value={iban}
        maxLength={42}
        onChangeText={value => {
          setIban(value.toUpperCase());
          setError("");
        }}
        placeholder="ES00 0000 0000 0000 0000 0000"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
      />
      <Caption>Solo lo usamos para pagarte por transferencia.</Caption>
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar" loading={saving} onPress={submit} />
      {canCancel ? (
        <Button title="Cancelar" variant="plain" onPress={onCancel} disabled={saving} />
      ) : null}
    </View>
  );
}
