import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../lib/auth";
import { STATUS_FLOW, STATUS_LABELS, useChat, useDriverLocation, useOrder } from "../../../lib/orders";
import { serviceOf } from "../../../lib/services";
import { Body, Button, Caption, Card, Field, Heading, Loading, Title } from "../../../components/ui";
import TrackingMap from "../../../components/TrackingMap";
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
  const scrollRef = useRef(null);

  useEffect(() => {
    // Al llegar un mensaje nuevo, bajar del todo: si no, el usuario ve la
    // conversación congelada y cree que no ha entrado nada.
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

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
});
