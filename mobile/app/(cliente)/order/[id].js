import { useEffect, useRef, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { STATUS_FLOW, STATUS_LABELS, useChat, useDriverLocation, useOrder } from "../../../lib/orders";
import { markChatRead } from "../../../lib/unread";
import { serviceOf } from "../../../lib/services";
import { Body, Button, Caption, Card, Field, Heading, Loading, Title } from "../../../components/ui";
import TrackingMap from "../../../components/TrackingMap";
import ReportIncident from "../../../components/ReportIncident";
import PayButton from "../../../components/PayButton";
import { colors, radius, spacing } from "../../../theme";

/**
 * Detalle del pedido para el cliente: la pantalla que justifica la app.
 *
 * Todo llega por Realtime — estado, posición del conductor y chat — así que no
 * hay ningún sondeo. La web refresca cada 5-10 s en tres sitios distintos.
 */
export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const { user, role } = useAuth();
  const { order, driver, loading } = useOrder(id);
  const driverLocation = useDriverLocation(driver);
  const { messages, send, sending } = useChat(id, { user, role });
  const [draft, setDraft] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const scrollRef = useRef(null);

  const submitReview = async () => {
    setSavingReview(true);
    try {
      // La media del conductor la recalcula un trigger en la BD: escribirla
      // desde aquí chocaba con la RLS (bug que se arregló en la web).
      await supabase
        .from("transport_requests")
        .update({ client_rating: rating, client_review: review.trim() || null })
        .eq("id", id);
    } finally {
      setSavingReview(false);
    }
  };

  const cancelOrder = () => {
    Alert.alert("Cancelar el pedido", "Se cancelará y dejaremos de buscar conductor.", [
      { text: "Seguir esperando", style: "cancel" },
      {
        text: "Cancelar pedido",
        style: "destructive",
        onPress: async () => {
          await supabase.from("transport_requests").update({ status: "cancelled" }).eq("id", id);
        },
      },
    ]);
  };

  useEffect(() => {
    // Al llegar un mensaje nuevo, bajar del todo: si no, el usuario ve la
    // conversación congelada y cree que no ha entrado nada. Y de paso queda
    // leído: el badge de "Mis pedidos" se apaga.
    scrollRef.current?.scrollToEnd({ animated: true });
    if (id) markChatRead(id);
  }, [messages.length, id]);

  if (loading) return <Loading label="Cargando el pedido…" />;
  if (!order) {
    return (
      <SafeAreaView style={styles.screen}>
        <Card style={{ margin: spacing.lg }}>
          <Body>No hemos encontrado este pedido.</Body>
        </Card>
      </SafeAreaView>
    );
  }

  const service = serviceOf(order);
  const active = ["accepted", "in_transit", "picked_up"].includes(order.status);
  // Hasta recoger la carga el conductor va a la recogida; después, a la entrega.
  const goingToPickup = ["accepted", "in_transit"].includes(order.status);
  const target = goingToPickup
    ? { lat: order.origin_lat, lng: order.origin_lng, label: "la recogida" }
    : { lat: order.destination_lat, lng: order.destination_lng, label: "la entrega" };

  const currentStep = STATUS_FLOW.indexOf(order.status);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "Tu pedido" }} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Heading>
            {service?.emoji} {service?.label || "Servicio"}
          </Heading>
          <Caption>{STATUS_LABELS[order.status] || order.status}</Caption>
        </View>

        {/* Línea de estados */}
        {order.status !== "cancelled" && (
          <Card>
            {STATUS_FLOW.map((status, i) => {
              const done = currentStep >= i;
              return (
                <View key={status} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, done && { backgroundColor: colors.primary }]} />
                  <Text style={[styles.timelineLabel, done && { color: colors.foreground, fontWeight: "600" }]}>
                    {STATUS_LABELS[status]}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Mapa en vivo */}
        {active && <TrackingMap driverLocation={driverLocation} target={target} />}

        {/* Conductor */}
        {driver && (
          <Card>
            <View style={styles.driverRow}>
              {driver.photo_url ? (
                <Image source={{ uri: driver.photo_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Title>{driver.full_name || "Tu conductor"}</Title>
                <Caption>
                  {driver.vehicle_brand || "Furgoneta"}
                  {driver.vehicle_plate ? ` · ${driver.vehicle_plate}` : ""}
                  {driver.rating ? ` · ★ ${Number(driver.rating).toFixed(1)}` : ""}
                </Caption>
              </View>
            </View>
            {driver.phone ? (
              <Button
                title="Llamar al conductor"
                variant="plain"
                onPress={() => Linking.openURL(`tel:${driver.phone}`)}
              />
            ) : null}
          </Card>
        )}

        {/* Direcciones y precio */}
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
          {order.estimated_price != null ? (
            <Text style={styles.price}>{order.estimated_price} €</Text>
          ) : null}
        </Card>

        {/* Pago con tarjeta pendiente. En efectivo no aparece: se paga al
            conductor al terminar. */}
        {order.payment_method === "card" &&
          order.payment_status !== "paid" &&
          order.status !== "cancelled" && <PayButton order={order} />}

        {/* Valoración: solo tras la entrega y una sola vez */}
        {order.status === "delivered" && !order.client_rating && (
          <Card>
            <Title>¿Qué tal ha ido?</Title>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <Text style={styles.star}>{n <= rating ? "★" : "☆"}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              value={review}
              onChangeText={setReview}
              placeholder="Cuéntanos cómo ha ido (opcional)"
              multiline
            />
            <Button
              title="Enviar valoración"
              disabled={rating === 0}
              loading={savingReview}
              onPress={submitReview}
            />
          </Card>
        )}

        {order.client_rating ? (
          <Card>
            <Caption>Tu valoración</Caption>
            <Text style={styles.star}>{"★".repeat(order.client_rating)}</Text>
            {order.client_review ? <Body>{order.client_review}</Body> : null}
          </Card>
        ) : null}

        {/* Cancelar: la regla actual solo lo permite mientras nadie lo ha aceptado */}
        {order.status === "pending" && (
          <Button title="Cancelar el pedido" variant="plain" onPress={cancelOrder} />
        )}

        <ReportIncident orderId={order.id} user={user} />

        {/* Chat */}
        {order.driver_id && (
          <Card>
            <Title>Chat con el conductor</Title>
            {messages.length === 0 ? (
              <Caption>Todavía no hay mensajes.</Caption>
            ) : (
              messages.map(m => {
                const mine = m.sender_id === user?.id;
                return (
                  <View
                    key={m.id}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                  >
                    {!mine ? <Caption>{m.sender_name}</Caption> : null}
                    <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{m.message}</Text>
                  </View>
                );
              })
            )}

            {order.status === "delivered" || order.status === "cancelled" ? (
              <Caption>El pedido ha terminado: el chat queda como historial.</Caption>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Field
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Escribe un mensaje…"
                  multiline
                />
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: radius.full, backgroundColor: colors.border },
  timelineLabel: { fontSize: 14, color: colors.mutedForeground },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.secondary },
  avatarEmpty: { borderWidth: 1, borderColor: colors.border },
  price: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  bubble: { padding: spacing.md, borderRadius: radius.md, maxWidth: "85%", gap: 2 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.secondary },
  bubbleText: { fontSize: 15, color: colors.foreground },
  stars: { flexDirection: "row", gap: spacing.sm },
  star: { fontSize: 32, color: colors.warning },
});
