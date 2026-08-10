import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { fetchMyDriverProfile } from "../../../lib/driverProfile";
import { STATUS_LABELS, useChat, useOrder } from "../../../lib/orders";
import { serviceOf } from "../../../lib/services";
import { startTracking, stopTracking } from "../../../lib/tracking";
import { uploadProofPhoto, uploadSignature } from "../../../lib/deliveryProof";
import { markChatRead } from "../../../lib/unread";
import { takePhoto } from "../../../lib/photos";
import SignaturePad from "../../../components/SignaturePad";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Loading, Title } from "../../../components/ui";
import { colors, radius, spacing } from "../../../theme";

/**
 * Trabajo activo del conductor: avanzar estados, navegar, chatear y —lo que la
 * web no puede— emitir posición con el móvil bloqueado.
 *
 * Los pasos son los mismos que en la web, sin atajos: aceptado → en camino →
 * recogido → entregado, y la cancelación solo antes de recoger.
 */
const STEPS = [
  { from: "accepted", to: "in_transit", label: "Iniciar viaje" },
  { from: "in_transit", to: "picked_up", label: "He llegado y he recogido" },
  { from: "picked_up", to: "delivered", label: "Trabajo finalizado" },
];

// Mismas etiquetas que la web: el admin ya las tiene tabuladas.
const FEEDBACK_TAGS = ["Precio justo", "Precio injusto", "Mucho tiempo de espera"];

const CANCEL_REASONS = [
  "Avería o problema con la furgoneta",
  "No puedo llegar a tiempo",
  "La carga no es la descrita",
  "Motivo personal",
];

export default function TrabajoActivo() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, role } = useAuth();
  const { order, loading } = useOrder(id);
  const { messages, send, sending } = useChat(id, { user, role });

  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedbackTags, setFeedbackTags] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [showProof, setShowProof] = useState(false);
  const [proofPhotoUri, setProofPhotoUri] = useState(null);
  const [recipientName, setRecipientName] = useState("");
  const trackingStarted = useRef(false);

  const sendFeedback = async () => {
    setSaving(true);
    try {
      await supabase
        .from("transport_requests")
        .update({
          driver_feedback_tags: feedbackTags,
          driver_feedback_text: feedbackText.trim() || null,
        })
        .eq("id", id);
    } catch (err) {
      setError("No se pudo enviar la opinión: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMyDriverProfile(user).then(setProfile);
  }, [user]);

  useEffect(() => {
    if (id) markChatRead(id);
  }, [messages.length, id]);

  // El seguimiento vive mientras el trabajo esté vivo. Al salir de la pantalla
  // NO se para: el conductor va a estar en Google Maps, que es justo cuando más
  // falta hace. Se para al terminar, al cancelar o desde el toggle de
  // disponibilidad.
  useEffect(() => {
    const active = order && ["accepted", "in_transit", "picked_up"].includes(order.status);
    if (!active || !profile?.id || trackingStarted.current) return;

    trackingStarted.current = true;
    startTracking(profile.id).then(result => {
      if (!result.ok) setError(result.reason);
    });
  }, [order?.status, profile?.id]);

  if (loading) return <Loading label="Cargando el servicio…" />;
  if (!order) {
    return (
      <SafeAreaView style={styles.screen}>
        <Card style={{ margin: spacing.lg }}>
          <Body>No hemos encontrado este servicio.</Body>
        </Card>
      </SafeAreaView>
    );
  }

  const service = serviceOf(order);
  const step = STEPS.find(s => s.from === order.status);
  const finished = ["delivered", "cancelled"].includes(order.status);
  const canCancel = ["accepted", "in_transit"].includes(order.status);
  // Hasta recoger, el destino de la navegación es la recogida.
  const navTarget = ["accepted", "in_transit"].includes(order.status)
    ? order.origin_address
    : order.destination_address;

  const advance = async () => {
    if (!step) return;
    // Finalizar pasa SIEMPRE por la prueba de entrega (foto + firma). En los
    // servicios sin firma obligatoria se puede omitir, pero se ofrece: es lo
    // que protege al conductor y a la empresa ante una disputa.
    if (step.to === "delivered") {
      setShowProof(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const extra = {};
      if (step.to === "picked_up") extra.pickup_time = new Date().toISOString();

      const { error: err } = await supabase
        .from("transport_requests")
        .update({ status: step.to, ...extra })
        .eq("id", id);
      if (err) throw err;

      supabase.functions
        .invoke("send-push", { body: { mode: "status_changed", order_id: id } })
        .catch(() => {});
    } catch (err) {
      setError("No se pudo actualizar el estado: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Entrega con prueba. La firma (y la foto) se suben ANTES de marcar
   * entregado, para que no quede un pedido cerrado sin su justificante — mismo
   * orden que decidió la web.
   */
  const finishDelivery = async ({ signatureBase64 = null } = {}) => {
    setSaving(true);
    setError("");
    try {
      const patch = { status: "delivered", delivery_time: new Date().toISOString() };

      if (proofPhotoUri) {
        patch.proof_photo_url = await uploadProofPhoto(id, proofPhotoUri);
      }
      if (signatureBase64) {
        patch.proof_signature_url = await uploadSignature(id, signatureBase64);
        patch.delivered_signature_at = new Date().toISOString();
        if (recipientName.trim()) patch.recipient_name = recipientName.trim();
      }

      const { error: err } = await supabase.from("transport_requests").update(patch).eq("id", id);
      if (err) throw err;

      await stopTracking();
      setShowProof(false);
      supabase.functions
        .invoke("send-push", { body: { mode: "status_changed", order_id: id } })
        .catch(() => {});
    } catch (err) {
      setError("No se pudo registrar la entrega: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancelar antes de recoger devuelve el pedido a pendientes con el motivo
   * registrado, igual que en la web, y avisa a la empresa.
   */
  const cancel = (reason) => {
    Alert.alert("Cancelar el servicio", `Motivo: ${reason}\n\nEl pedido volverá a la lista de pendientes.`, [
      { text: "Seguir con el servicio", style: "cancel" },
      {
        text: "Cancelar servicio",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await supabase
              .from("transport_requests")
              .update({
                status: "pending",
                driver_id: null,
                driver_name: null,
                accepted_at: null,
                driver_cancel_reason: reason,
                driver_cancel_name: profile?.full_name || user?.email || "Conductor",
                driver_cancel_at: new Date().toISOString(),
              })
              .eq("id", id);
            await stopTracking();
            supabase.functions
              .invoke("send-push", { body: { mode: "driver_cancelled", order_id: id } })
              .catch(() => {});
            router.replace("/(conductor)");
          } catch (err) {
            setError("No se pudo cancelar: " + (err.message || "error de conexión"));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const navigate = (app) => {
    const destination = encodeURIComponent(navTarget || "");
    const url =
      app === "waze"
        ? `https://waze.com/ul?q=${destination}&navigate=yes`
        : Platform.select({
            android: `google.navigation:q=${destination}`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
          });
    Linking.openURL(url).catch(() =>
      setError("No se pudo abrir la aplicación de navegación."),
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "Servicio" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Heading>
            {service?.emoji} {service?.label}
          </Heading>
          <Caption>{STATUS_LABELS[order.status] || order.status}</Caption>
        </View>

        <Card>
          <Caption>Recogida</Caption>
          <Body>{order.origin_address || "—"}</Body>
          <Caption>Entrega</Caption>
          <Body>{order.destination_address || "—"}</Body>
          {order.cargo_description ? (
            <>
              <Caption>Carga</Caption>
              <Body>{order.cargo_description}</Body>
            </>
          ) : null}
          {order.needs_help ? <Caption>El cliente ha pedido ayuda con la carga.</Caption> : null}
          {order.client_phone ? (
            <Button
              title="Llamar al cliente"
              variant="plain"
              onPress={() => Linking.openURL(`tel:${order.client_phone}`)}
            />
          ) : null}
        </Card>

        {!finished && (
          <Card>
            <Title>Navegar hasta {navTarget ? "la dirección" : "el destino"}</Title>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title="Google Maps" variant="plain" onPress={() => navigate("gmaps")} style={{ flex: 1 }} />
              <Button title="Waze" variant="plain" onPress={() => navigate("waze")} style={{ flex: 1 }} />
            </View>
            <Caption>
              Tu posición se sigue enviando aunque salgas de la app o bloquees el móvil.
            </Caption>
          </Card>
        )}

        <ErrorText>{error}</ErrorText>

        {step && !showProof && (
          <Button title={step.label} onPress={advance} loading={saving} />
        )}

        {/* Prueba de entrega: foto de lo entregado + firma del receptor.
            Obligatoria en paquetes y compras en tienda; opcional en el resto. */}
        {showProof && !finished && (
          <Card>
            <Title>Prueba de entrega</Title>
            <Caption>
              {service?.signatureRequired
                ? "En este servicio la firma del receptor es obligatoria."
                : "Opcional, pero te protege si hay una disputa."}
            </Caption>

            <Button
              title={proofPhotoUri ? "Foto hecha ✓ (repetir)" : "Foto de lo entregado"}
              variant="plain"
              onPress={async () => {
                const uris = await takePhoto();
                if (uris[0]) setProofPhotoUri(uris[0]);
              }}
            />

            <Field
              label="¿Quién recibe?"
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Nombre de la persona que firma"
            />

            <SignaturePad
              capturing={saving}
              onCapture={base64 => finishDelivery({ signatureBase64: base64 })}
            />

            {!service?.signatureRequired && (
              <Button
                title="Finalizar sin firma"
                variant="plain"
                loading={saving}
                onPress={() => finishDelivery()}
              />
            )}
            <Button title="Volver" variant="plain" onPress={() => setShowProof(false)} disabled={saving} />
          </Card>
        )}

        {finished && (
          <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
            <Body>Servicio terminado. Ya no se comparte tu posición.</Body>
          </Card>
        )}

        {/* Opinión del conductor: la lee la empresa en el panel de admin. */}
        {order.status === "delivered" && !order.driver_feedback_tags && !order.driver_feedback_text && (
          <Card>
            <Title>¿Cómo fue el servicio?</Title>
            <Caption>Opcional. Lo lee la empresa, no el cliente.</Caption>
            <View style={styles.chips}>
              {FEEDBACK_TAGS.map(tag => {
                const on = feedbackTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() =>
                      setFeedbackTags(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
                      )
                    }
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && { color: colors.primary }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Lo que quieras contarle a la empresa sobre este servicio…"
              multiline
            />
            <Button
              title="Enviar opinión"
              disabled={feedbackTags.length === 0 && !feedbackText.trim()}
              loading={saving}
              onPress={sendFeedback}
            />
          </Card>
        )}

        {canCancel && (
          <Card>
            <Title>¿No puedes hacerlo?</Title>
            <Caption>
              Solo se puede cancelar antes de recoger la carga. El pedido vuelve a pendientes y se
              avisa a la empresa.
            </Caption>
            {CANCEL_REASONS.map(reason => (
              <Button key={reason} title={reason} variant="plain" onPress={() => cancel(reason)} />
            ))}
          </Card>
        )}

        {/* Chat con el cliente */}
        <Card>
          <Title>Chat con el cliente</Title>
          {messages.length === 0 ? (
            <Caption>Todavía no hay mensajes.</Caption>
          ) : (
            messages.map(m => {
              const mine = m.sender_id === user?.id;
              return (
                <View key={m.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Caption>{m.sender_name}</Caption> : null}
                  <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{m.message}</Text>
                </View>
              );
            })
          )}
          {finished ? (
            <Caption>El servicio ha terminado: el chat queda como historial.</Caption>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Field value={draft} onChangeText={setDraft} placeholder="Escribe un mensaje…" multiline />
              <Button
                title="Enviar"
                loading={sending}
                disabled={!draft.trim()}
                onPress={async () => {
                  await send(draft);
                  setDraft("");
                }}
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bubble: { padding: spacing.md, borderRadius: radius.md, maxWidth: "85%", gap: 2 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.secondary },
  bubbleText: { fontSize: 15, color: colors.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: "#EFF6FF" },
  chipText: { fontSize: 13, color: colors.mutedForeground },
});
