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
import { pickPhotos } from "../../../lib/photos";
import TrackingMap from "../../../components/TrackingMap";
import ReportIncident from "../../../components/ReportIncident";
import PayButton from "../../../components/PayButton";
import TipCard from "../../../components/TipCard";
import { downloadReceipt } from "../../../lib/receipt";
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
  const [chatError, setChatError] = useState("");
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  // Negociación (canvas 1g): contraofertas de conductores EN VIVO.
  const [priceOffers, setPriceOffers] = useState([]);
  const [negotiating, setNegotiating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadOffers = async () => {
      const { data } = await supabase
        .from("price_offers")
        .select("id, driver_name, amount, message, status")
        .eq("request_id", id)
        .eq("status", "pending")
        .order("created_date", { ascending: true });
      if (active) setPriceOffers(data || []);
    };
    loadOffers();

    const channel = supabase
      .channel(`offers-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "price_offers", filter: `request_id=eq.${id}` },
        loadOffers,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const acceptOffer = async offerId => {
    setNegotiating(true);
    setChatError("");
    try {
      const { data, error } = await supabase.rpc("accept_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      setPriceOffers([]);
      // Avisar al conductor ganador; no bloquea.
      supabase.functions
        .invoke("send-push", { body: { mode: "offer_accepted", order_id: data.id } })
        .catch(() => {});
    } catch (err) {
      setChatError(err.message || "No se pudo aceptar la contraoferta.");
    } finally {
      setNegotiating(false);
    }
  };

  const rejectOffer = async offerId => {
    setNegotiating(true);
    try {
      const { error } = await supabase.rpc("reject_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      setPriceOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (err) {
      setChatError(err.message || "No se pudo rechazar.");
    } finally {
      setNegotiating(false);
    }
  };

  const sendText = async () => {
    setChatError("");
    try {
      await send(draft);
      setDraft("");
    } catch {
      setChatError("No se pudo enviar el mensaje. Comprueba tu conexión.");
    }
  };

  const sendPhoto = async () => {
    setChatError("");
    try {
      const uris = await pickPhotos(1);
      if (!uris[0]) return;
      await send(draft, { imageUri: uris[0] });
      setDraft("");
    } catch {
      setChatError("No se pudo enviar la foto. Comprueba tu conexión.");
    }
  };

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

  const seenCount = useRef(null);
  useEffect(() => {
    // Bajar al final SOLO cuando entra un mensaje nuevo estando ya en la
    // pantalla. En la carga inicial no: saltar de golpe al fondo le escondía el
    // mapa y el estado a quien abría el pedido. Leído se marca siempre.
    if (seenCount.current !== null && messages.length > seenCount.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    seenCount.current = messages.length;
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

        {/* Negociación: respuestas de conductores mientras busca dueño */}
        {order.status === "pending" && order.proposed_price != null && (
          <Card>
            <View style={styles.offersHeader}>
              <Title>Respuestas de conductores</Title>
              <View style={styles.myOfferChip}>
                <Text style={styles.myOfferChipText}>Tu oferta: {Number(order.proposed_price).toFixed(2)} €</Text>
              </View>
            </View>
            {priceOffers.length === 0 ? (
              <Caption>
                Aún no hay contraofertas. Un conductor puede aceptar tu precio directamente o
                proponerte otro — lo verás aquí al momento.
              </Caption>
            ) : (
              priceOffers.map(offer => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={styles.offersHeader}>
                    <Body style={{ fontFamily: "DMSans_700Bold" }}>{offer.driver_name || "Conductor"}</Body>
                    <Text style={styles.offerAmount}>{Number(offer.amount).toFixed(2)} €</Text>
                  </View>
                  {offer.message ? <Caption>«{offer.message}»</Caption> : null}
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      title={`Aceptar por ${Number(offer.amount).toFixed(2)} €`}
                      loading={negotiating}
                      onPress={() => acceptOffer(offer.id)}
                      style={{ flex: 2 }}
                    />
                    <Button
                      title="No, gracias"
                      variant="plain"
                      disabled={negotiating}
                      onPress={() => rejectOffer(offer.id)}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ))
            )}
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

        {/* Pago con tarjeta pendiente. En efectivo no aparece; y mientras se
            negocia tampoco: el importe aún no está pactado. */}
        {order.payment_method === "card" &&
          order.payment_status !== "paid" &&
          order.status !== "cancelled" &&
          !(order.status === "pending" && order.proposed_price != null) && (
            <PayButton order={order} />
          )}

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

        {/* Propina: tras la entrega, cargo Stripe aparte, 100% para el conductor */}
        {order.status === "delivered" && <TipCard order={order} driverName={driver?.full_name} />}

        {/* Recibo: PDF generado en el móvil + envío por email (Edge Function) */}
        {order.status === "delivered" && (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Recibo PDF"
              variant="plain"
              style={{ flex: 1 }}
              onPress={async () => {
                try {
                  await downloadReceipt(order, service);
                } catch {
                  setChatError("No se pudo generar el recibo. Inténtalo de nuevo.");
                }
              }}
            />
            <Button
              title={receiptSent ? "Enviado ✓" : "Recibo por email"}
              variant="plain"
              style={{ flex: 1 }}
              loading={sendingReceipt}
              disabled={receiptSent}
              onPress={async () => {
                setSendingReceipt(true);
                try {
                  const { data } = await supabase.functions.invoke("send-receipt", {
                    body: { order_id: order.id },
                  });
                  if (data?.sent) setReceiptSent(true);
                  else setChatError(data?.error || "No se pudo enviar el recibo.");
                } catch {
                  setChatError("No se pudo enviar el recibo.");
                } finally {
                  setSendingReceipt(false);
                }
              }}
            />
          </View>
        )}

        {/* Cancelar: mientras nadie lo ha aceptado (o aún no se ha publicado) */}
        {["pending", "scheduled"].includes(order.status) && (
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
                    {m.image_url ? (
                      <Image source={{ uri: m.image_url }} style={styles.chatImage} />
                    ) : null}
                    {m.message && m.message !== "📷 Foto" ? (
                      <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{m.message}</Text>
                    ) : null}
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
                {chatError ? <Caption style={{ color: colors.destructive }}>{chatError}</Caption> : null}
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button
                    title="📷"
                    variant="plain"
                    loading={sending}
                    onPress={() => sendPhoto()}
                    style={{ minWidth: 56 }}
                  />
                  <Button
                    title="Enviar"
                    loading={sending}
                    disabled={!draft.trim()}
                    onPress={() => sendText()}
                    style={{ flex: 1 }}
                  />
                </View>
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
  star: { fontSize: 32, color: colors.accent },
  chatImage: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: colors.secondary },
  offersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  myOfferChip: { backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  myOfferChipText: { fontSize: 12, fontFamily: "DMSans_700Bold", color: colors.primary },
  offerCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  offerAmount: { fontSize: 20, fontFamily: "Poppins_700Bold", color: colors.primary },
});
