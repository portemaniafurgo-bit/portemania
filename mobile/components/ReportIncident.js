import { useState } from "react";
import { View } from "react-native";
import { supabase } from "../lib/supabase";
import { Body, Button, Caption, Card, ErrorText, Field, Title } from "./ui";
import { Option } from "./wizard";
import { colors, spacing } from "../theme";

/**
 * Reportar un problema con el servicio. Mismos tipos y prioridades que el panel
 * /admin/incidents, para que lleguen clasificadas: sin prioridad, un daño grave
 * y un retraso entraban idénticos y el admin no podía priorizar.
 */
const TYPES = [
  { value: "damage", label: "Daño en la mercancía" },
  { value: "delay", label: "Retraso" },
  { value: "lost_item", label: "Objeto perdido" },
  { value: "payment", label: "Problema con el pago" },
  { value: "behavior", label: "Comportamiento" },
  { value: "other", label: "Otro" },
];

const PRIORITIES = [
  { value: "normal", label: "Normal — puede esperar" },
  { value: "high", label: "Alta — necesito respuesta hoy" },
  { value: "urgent", label: "Urgente — está pasando ahora" },
];

export default function ReportIncident({ orderId, user }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("other");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (description.trim().length < 10) {
      setError("Describe el problema con un poco más de detalle (mínimo 10 caracteres).");
      return;
    }
    setError("");
    setSending(true);
    try {
      const { error: err } = await supabase.from("incidents").insert({
        request_id: orderId,
        reporter_id: user?.id,
        reporter_name: user?.user_metadata?.full_name || user?.email || "Usuario",
        type,
        priority,
        description: description.trim(),
      });
      if (err) throw err;
      setSent(true);
      setOpen(false);
    } catch (err) {
      setError("No se pudo enviar el reporte: " + (err.message || "error de conexión"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
        <Body>Incidencia enviada. El equipo de ClicyVoy la revisará y te contactará si hace falta.</Body>
      </Card>
    );
  }

  if (!open) {
    return <Button title="Reportar un problema con este servicio" variant="plain" onPress={() => setOpen(true)} />;
  }

  return (
    <Card>
      <Title>Reportar un problema</Title>

      <View style={{ gap: spacing.sm }}>
        <Caption>¿Qué ha pasado?</Caption>
        {TYPES.map(t => (
          <Option key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Caption>¿Cómo de urgente es?</Caption>
        {PRIORITIES.map(p => (
          <Option
            key={p.value}
            label={p.label}
            selected={priority === p.value}
            onPress={() => setPriority(p.value)}
          />
        ))}
      </View>

      <Field
        value={description}
        onChangeText={setDescription}
        placeholder="Cuéntanos qué ha pasado…"
        multiline
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Enviar reporte" onPress={submit} loading={sending} />
      <Button title="Cancelar" variant="plain" onPress={() => setOpen(false)} />
    </Card>
  );
}
