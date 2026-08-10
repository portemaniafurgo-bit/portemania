import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { fetchMyDriverProfile } from "../../../lib/driverProfile";
import { STATUS_LABELS, useChat, useOrder } from "../../../lib/orders";
import { serviceOf } from "../../../lib/services";
import { startTracking, stopTracking } from "../../../lib/tracking";
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
  const trackingStarted = useRef(false);

  useEffect(() => {
    fetchMyDriverProfile(user).then(setProfile);
  }, [user]);

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
    setSaving(true);
    setError("");
    try {
      const extra = {};
      if (step.to === "picked_up") extra.pickup_time = new Date().toISOString();
      if (step.to === "delivered") extra.delivery_time = new Date().toISOString();

      const { error: err } = await supabase
        .from("transport_requests")
        .update({ status: step.to, ...extra })
        .eq("id", id);
      if (err) throw err;

      if (step.to === "delivered") await stopTracking();

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

        {step && (
          <Button title={step.label} onPress={advance} loading={saving} />
        )}

        {finished && (
          <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
            <Body>Servicio terminado. Ya no se comparte tu posición.</Body>
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
});
