import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { STATUS_FLOW, STATUS_LABELS, useDriverLocation, useOrder } from "../../../lib/orders";
import { serviceOf } from "../../../lib/services";
import { euro, rating1 } from "../../../lib/money";
import { Body, Button, Caption, Card, Field, Heading, Loading, Title } from "../../../components/ui";
import TrackingMap from "../../../components/TrackingMap";
import ServiceIcon from "../../../components/ServiceIcon";
import DriverCard from "../../../components/DriverCard";
import { Ionicons } from "@expo/vector-icons";
import ReportIncident from "../../../components/ReportIncident";
import PayButton from "../../../components/PayButton";
import TipCard from "../../../components/TipCard";
import DeliveryProof from "../../../components/DeliveryProof";
import ChatBubbleButton from "../../../components/ChatBubbleButton";
import { downloadReceipt } from "../../../lib/receipt";
import { useBottomPadding } from "../../../lib/layout";
import { colors, radius, spacing } from "../../../theme";

/**
 * Detalle del pedido para el cliente. Tres modos, calcados del canvas:
 *  - 1g «Buscando conductor…»: Tu oferta / Respuestas / Caduca en + tarjetas
 *    de conductores EN VIVO con «Aceptar por X €» y «Subir mi oferta a X €».
 *  - 1h pedido activo: mapa a sangre + hoja con ETA y frescura.
 *  - 1i «Entregado a las HH:MM»: firma, «¿Cómo ha ido con X?», propina 1/2/5 €
 *    y recibo (PDF / email).
 */

// La búsqueda con oferta caduca a los 15 min: pasado eso el contador marca 0:00
// y conviene subir la oferta o cancelar. (Solo informativo: el pedido sigue
// publicado — nadie cancela dinero en silencio.)
const OFFER_WINDOW_MS = 15 * 60_000;

// Lo que devuelve la app al elegir estrella (canvas 1i). Con 1-2 no se promete
// nada que no se vaya a hacer: se le dice que la empresa lo va a mirar.
const RATE_LABELS = {
  1: "Sentimos que haya ido así, lo revisamos",
  2: "Gracias por decirlo, lo revisamos",
  3: "Tomamos nota para mejorar",
  4: "Nos alegra, se lo diremos",
  5: "Perfecto, se lo diremos",
};

const distanceKm = (aLat, aLng, bLat, bLng) => {
  if (!aLat || !aLng || !bLat || !bLng) return null;
  const rad = x => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export default function OrderDetail() {
  // Aire al final para que ningun boton quede bajo la barra del sistema.
  const bottomPad = useBottomPadding();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { order, driver, loading, patchOrder } = useOrder(id);
  const driverLocation = useDriverLocation(driver);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [actionError, setActionError] = useState("");
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  // Negociación (canvas 1g): contraofertas de conductores EN VIVO, con su
  // perfil (valoración, furgoneta, distancia) para decidir con datos.
  const [priceOffers, setPriceOffers] = useState([]);
  const [offerProfiles, setOfferProfiles] = useState({});
  const [negotiating, setNegotiating] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Canvas 1h: en pedido activo el mapa llena la pantalla y la hoja pinta
  // ETA/frescura por su cuenta (TrackingMap se los pasa por onInfo).
  const [mapInfo, setMapInfo] = useState({ route: null, freshness: null });

  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadOffers = async () => {
      const { data } = await supabase
        .from("price_offers")
        .select("id, driver_id, driver_name, amount, message, status")
        .eq("request_id", id)
        .eq("status", "pending")
        .order("created_date", { ascending: true });
      if (!active) return;
      setPriceOffers(data || []);

      // Perfil de cada conductor que responde. Si la RLS no deja ver alguno,
      // su tarjeta sale igual, solo que sin valoración ni distancia.
      const ids = [...new Set((data || []).map(o => o.driver_id).filter(Boolean))];
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("driver_profiles")
        .select("created_by_id, full_name, photo_url, rating, rating_count, vehicle_brand, vehicle_plate, current_lat, current_lng")
        .in("created_by_id", ids)
        .order("created_date", { ascending: true });
      if (!active || !profiles) return;
      const map = {};
      for (const p of profiles) if (!map[p.created_by_id]) map[p.created_by_id] = p;
      setOfferProfiles(map);
    };
    loadOffers();

    const channel = supabase
      .channel(`offers-${id}-${Math.random().toString(36).slice(2, 10)}`)
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

  const searching = order?.status === "pending" && order?.proposed_price != null;

  // El contador «Caduca en» late cada segundo solo mientras se busca.
  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [searching]);

  const acceptOffer = async offerId => {
    setNegotiating(true);
    setActionError("");
    try {
      const { data, error } = await supabase.rpc("accept_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      patchOrder(data); // el pedido pasa a aceptado en pantalla YA
      setPriceOffers([]);
      // Avisar al conductor ganador; no bloquea.
      supabase.functions
        .invoke("send-push", { body: { mode: "offer_accepted", order_id: data.id } })
        .catch(() => {});
    } catch (err) {
      setActionError(err.message || "No se pudo aceptar la contraoferta.");
    } finally {
      setNegotiating(false);
    }
  };

  const rejectOffer = async offerId => {
    setNegotiating(true);
    try {
      const { error } = await supabase.rpc("reject_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      // Avisar al conductor de que su contraoferta no valió: si no, se queda
      // esperando una respuesta que no llega.
      supabase.functions
        .invoke("send-push", { body: { mode: "offer_rejected", order_id: id, offer_id: offerId } })
        .catch(() => {});
      setPriceOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (err) {
      setActionError(err.message || "No se pudo descartar.");
    } finally {
      setNegotiating(false);
    }
  };

  // «Subir mi oferta a X €» (canvas 1g): iguala la contraoferta más baja para
  // que TODOS los conductores vean el precio nuevo, no solo el que la hizo.
  const raiseOffer = async amount => {
    setNegotiating(true);
    setActionError("");
    try {
      const { data, error } = await supabase
        .from("transport_requests")
        .update({ proposed_price: amount })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      patchOrder(data);
      // Sin este aviso, subir la oferta no sirve de nada: los conductores que
      // ya la habían visto no vuelven a mirar el pedido por su cuenta.
      supabase.functions
        .invoke("send-push", { body: { mode: "offer_raised", order_id: id } })
        .catch(() => {});
    } catch (err) {
      setActionError(err.message || "No se pudo subir la oferta.");
    } finally {
      setNegotiating(false);
    }
  };

  /**
   * Enlace de seguimiento para quien espera la carga. El token lo crea el
   * servidor (`get_share_token`) y solo abre una vista recortada: estado,
   * nombre de pila del conductor, su posición y a dónde va.
   */
  const shareTracking = async () => {
    setSharing(true);
    setActionError("");
    try {
      const { data: token, error } = await supabase.rpc("get_share_token", { p_request_id: id });
      if (error || !token) throw error || new Error("sin token");
      await Share.share({
        message: `Sigue mi envío con ClicyVoy en directo: https://clicyvoy.es/seguimiento/${token}`,
      });
    } catch {
      setActionError("No se pudo preparar el enlace de seguimiento.");
    } finally {
      setSharing(false);
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
      patchOrder({ client_rating: rating, client_review: review.trim() || null });
      // Al conductor le importa: es su reputación y su siguiente servicio.
      supabase.functions
        .invoke("send-push", { body: { mode: "rating_received", order_id: id } })
        .catch(() => {});
    } finally {
      setSavingReview(false);
    }
  };

  /**
   * Cancelar. El coste lo dice el SERVIDOR antes de preguntar: nadie debe
   * enterarse de una penalización después de haberla aceptado.
   */
  const cancelOrder = async () => {
    const { data: fee } = await supabase.rpc("cancellation_fee_now", { p_request_id: id });
    const penalty = Number(fee) || 0;

    Alert.alert(
      "Cancelar el pedido",
      penalty > 0
        ? `${driverFirst} ya ha salido hacia la recogida, así que cancelar ahora tiene una penalización de ${euro(penalty)}.\n\n¿Seguro que quieres cancelar?`
        : order.driver_id
          ? "Todavía estás a tiempo: cancelar ahora no tiene ningún coste."
          : "Se cancelará y dejaremos de buscar conductor. No tiene ningún coste.",
      [
        { text: "No, seguir", style: "cancel" },
        {
          text: penalty > 0 ? `Cancelar y pagar ${euro(penalty)}` : "Cancelar pedido",
          style: "destructive",
          onPress: () => reallyCancel(penalty),
        },
      ],
    );
  };

  const reallyCancel = async penalty => {
    setActionError("");
    try {
      const { data, error } = await supabase.rpc("cancel_order_as_client", {
        p_request_id: id,
        p_reason: null,
      });
      if (error) throw error;
      patchOrder(data);
      // Si ya había conductor asignado, hay que decírselo: puede estar
      // conduciendo hacia la recogida.
      if (order.driver_id) {
        supabase.functions
          .invoke("send-push", { body: { mode: "client_cancelled", order_id: id } })
          .catch(() => {});
      }
      if (penalty > 0) {
        Alert.alert(
          "Pedido cancelado",
          `Queda anotada la penalización de ${euro(penalty)}. Te la cobraremos con tu próximo servicio o te escribiremos para resolverlo.`,
        );
      }
    } catch (err) {
      setActionError(err.message || "No se pudo cancelar el pedido.");
    }
  };

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
  const delivered = order.status === "delivered";
  // Hasta recoger la carga el conductor va a la recogida; después, a la entrega.
  const goingToPickup = ["accepted", "in_transit"].includes(order.status);
  const target = goingToPickup
    ? { lat: order.origin_lat, lng: order.origin_lng, label: "la recogida" }
    : { lat: order.destination_lat, lng: order.destination_lng, label: "la entrega" };

  const currentStep = STATUS_FLOW.indexOf(order.status);
  const driverFirst = (order.driver_name || driver?.full_name || "El conductor").split(" ")[0];

  // Contador de caducidad de la búsqueda (solo informativo).
  const expiresMs = searching
    ? Math.max(0, new Date(order.created_date).getTime() + OFFER_WINDOW_MS - now)
    : 0;
  const expiresLabel = `${Math.floor(expiresMs / 60_000)}:${String(
    Math.floor((expiresMs % 60_000) / 1000),
  ).padStart(2, "0")}`;

  // «Subir mi oferta»: a la contraoferta más baja que supere la mía.
  const counters = priceOffers
    .map(o => Number(o.amount))
    .filter(a => a > Number(order.proposed_price));
  const raiseTo = counters.length ? Math.min(...counters) : null;

  const deliveredAt = order.delivery_time ? format(new Date(order.delivery_time), "HH:mm") : null;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "Tu pedido" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg, paddingBottom: bottomPad }}>
        {/* Canvas 1h — pedido EN CURSO: el mapa llena la parte alta a sangre
            y la hoja monta encima con asa; ETA y frescura viven en la hoja. */}
        {active && (
          <View style={styles.fullMapWrap}>
            <TrackingMap
              driverLocation={driverLocation}
              target={target}
              height={Math.round(Dimensions.get("window").height * 0.44)}
              bare
              onInfo={setMapInfo}
            />
          </View>
        )}

        {active && (
          <Card style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <ServiceIcon serviceKey={service?.key} size={38} />
              <View style={{ gap: 2, flex: 1 }}>
                <Title>{STATUS_LABELS[order.status] || order.status}</Title>
                {mapInfo.route ? (
                  <Caption>
                    Llega a {target.label} en ~{mapInfo.route.minutes} min · {mapInfo.route.km} km
                  </Caption>
                ) : (
                  <Caption>Calculando ruta…</Caption>
                )}
              </View>
            </View>
            {/* Compartir el seguimiento con quien espera la carga, como el
                «compartir viaje» de Uber: un enlace que funciona sin cuenta. */}
            <Pressable onPress={shareTracking} disabled={sharing} style={styles.shareRow}>
              <Ionicons name="share-social-outline" size={17} color={colors.primary} />
              <Text style={styles.shareText}>
                {sharing ? "Preparando el enlace…" : "Compartir seguimiento"}
              </Text>
            </Pressable>

            {mapInfo.freshness ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View
                  style={[
                    styles.freshDot,
                    { backgroundColor: mapInfo.freshness.fresh ? colors.success : colors.warning },
                  ]}
                />
                <Caption style={{ color: mapInfo.freshness.fresh ? colors.success : colors.warning }}>
                  {mapInfo.freshness.fresh
                    ? "Posición del conductor en vivo"
                    : `Última posición ${mapInfo.freshness.label}`}
                </Caption>
              </View>
            ) : null}
          </Card>
        )}

        {/* Canvas 1i — ENTREGADO: hora, firma y todo el post-servicio debajo. */}
        {delivered && (
          <View style={styles.deliveredHero}>
            <Ionicons name="checkmark-done" size={27} color={colors.success} />
            <Heading>{deliveredAt ? `Entregado a las ${deliveredAt}` : "Entregado"}</Heading>
            <Caption>
              {order.proof_signature_url
                ? `${driverFirst} firmó la entrega${order.recipient_name ? ` con ${order.recipient_name}` : ""}`
                : `${driverFirst} completó la entrega`}
            </Caption>
          </View>
        )}

        {/* Canvas 1g — BUSCANDO CONDUCTOR con oferta. */}
        {searching && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <ActivityIndicator color={colors.primary} />
              <View style={{ gap: 2, flex: 1 }}>
                <Heading>Buscando conductor…</Heading>
                <Caption>{service?.label || "Servicio"}</Caption>
              </View>
            </View>

            {/* Tu oferta · Respuestas · Caduca en */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{euro(Number(order.proposed_price))}</Text>
                <Caption>Tu oferta</Caption>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{priceOffers.length}</Text>
                <Caption>Respuestas</Caption>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, expiresMs === 0 && { color: colors.destructive }]}>
                  {expiresLabel}
                </Text>
                <Caption>Caduca en</Caption>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.overline}>Conductores que han respondido</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>En vivo</Text>
              </View>
            </View>

            {priceOffers.length === 0 ? (
              <Card>
                <Caption>
                  Aún no hay respuestas. Un conductor puede aceptar tu precio directamente o
                  proponerte otro — lo verás aquí al momento.
                </Caption>
              </Card>
            ) : (
              priceOffers.map(offer => {
                const prof = offerProfiles[offer.driver_id];
                const name = offer.driver_name || prof?.full_name || "Conductor";
                const acceptsMyPrice = Number(offer.amount) === Number(order.proposed_price);
                const km = prof
                  ? distanceKm(prof.current_lat, prof.current_lng, order.origin_lat, order.origin_lng)
                  : null;
                return (
                  <Card key={offer.id} style={{ gap: spacing.md }}>
                    <View style={styles.offerTop}>
                      {prof?.photo_url ? (
                        <Image source={{ uri: prof.photo_url }} style={styles.offerAvatar} />
                      ) : (
                        <View style={[styles.offerAvatar, styles.offerAvatarEmpty]}>
                          <Text style={styles.offerInitial}>{name.slice(0, 1).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Title>{name}</Title>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          {prof?.rating ? (
                            <>
                              <Ionicons name="star" size={11} color={colors.accent} />
                              <Caption>{rating1(prof.rating)}</Caption>
                            </>
                          ) : null}
                          {km != null ? (
                            <Caption>
                              {prof?.rating ? " · " : ""}a {km.toFixed(1).replace(".", ",")} km
                            </Caption>
                          ) : null}
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={styles.offerAmount}>{euro(Number(offer.amount))}</Text>
                        <View
                          style={[
                            styles.offerTag,
                            { backgroundColor: acceptsMyPrice ? colors.successBg : colors.warningBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.offerTagText,
                              { color: acceptsMyPrice ? colors.success : "#8A6D00" },
                            ]}
                          >
                            {acceptsMyPrice ? "acepta tu precio" : "contraoferta"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {offer.message ? <Body>«{offer.message}»</Body> : null}
                    {prof ? (
                      <Caption>
                        {prof.vehicle_brand || "Furgoneta"}
                        {prof.vehicle_plate ? ` · ${prof.vehicle_plate}` : ""}
                      </Caption>
                    ) : null}

                    <Button
                      title={`Aceptar por ${euro(Number(offer.amount))}`}
                      loading={negotiating}
                      onPress={() => acceptOffer(offer.id)}
                    />
                    <Pressable onPress={() => rejectOffer(offer.id)} disabled={negotiating}>
                      <Caption style={{ textAlign: "center" }}>Descartar esta respuesta</Caption>
                    </Pressable>
                  </Card>
                );
              })
            )}

            {raiseTo != null && (
              <Button
                title={`Subir mi oferta a ${euro(raiseTo)}`}
                variant="plain"
                loading={negotiating}
                onPress={() => raiseOffer(raiseTo)}
              />
            )}
            {actionError ? (
              <Caption style={{ color: colors.destructive, textAlign: "center" }}>{actionError}</Caption>
            ) : null}
          </>
        )}

        {/* Cabecera genérica (pendiente sin oferta, programado, cancelado) */}
        {!active && !delivered && !searching && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <ServiceIcon serviceKey={service?.key} size={44} />
            <View style={{ gap: 2, flex: 1 }}>
              <Heading>{service?.label || "Servicio"}</Heading>
              <Caption>{STATUS_LABELS[order.status] || order.status}</Caption>
            </View>
          </View>
        )}

        {/* Línea de estados: durante el servicio, no en la búsqueda con oferta
            ni en el cierre — el canvas no la pinta ahí. */}
        {!searching && !delivered && order.status !== "cancelled" && (
          <Card>
            {STATUS_FLOW.map((status, i) => {
              const done = currentStep >= i;
              return (
                <View key={status} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, done && { backgroundColor: colors.primary }]} />
                  <Text style={[styles.timelineLabel, done && { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
                    {STATUS_LABELS[status]}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Pago con tarjeta pendiente. En efectivo no aparece; y mientras se
            negocia tampoco: el importe aún no está pactado. */}
        {order.payment_method === "card" &&
          order.payment_status !== "paid" &&
          order.status !== "cancelled" &&
          !searching && <PayButton order={order} />}

        {/* Canvas 1i — «¿Cómo ha ido con Javier?» */}
        {delivered && !order.client_rating && (
          <Card>
            <Title>¿Cómo ha ido con {driverFirst}?</Title>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => setRating(n)}>
                  <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color={colors.accent} />
                </Pressable>
              ))}
            </View>
            {/* La etiqueta responde a la estrella elegida (canvas 1i: rateLabel) */}
            {rating > 0 ? (
              <Body style={{ fontFamily: "DMSans_700Bold" }}>{RATE_LABELS[rating]}</Body>
            ) : null}
            <Field
              value={review}
              onChangeText={setReview}
              placeholder="Cuenta algo del servicio (opcional)"
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

        {delivered && order.client_rating ? (
          <Card>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: order.client_rating }, (_, i) => (
                <Ionicons key={i} name="star" size={20} color={colors.accent} />
              ))}
            </View>
            <Body style={{ fontFamily: "DMSans_700Bold" }}>{RATE_LABELS[order.client_rating]}</Body>
            {order.client_review ? <Caption>{order.client_review}</Caption> : null}
          </Card>
        ) : null}

        {/* Lo que el conductor dejó como prueba de que entregó */}
        {delivered && <DeliveryProof order={order} />}

        {/* Propina: cargo Stripe aparte, 100 % para el conductor */}
        {delivered && <TipCard order={order} driverName={driverFirst} />}

        {/* Recibo (canvas 1i): dos filas, PDF y email */}
        {delivered && (
          <Card style={{ gap: 0 }}>
            <Pressable
              style={styles.receiptRow}
              onPress={async () => {
                setActionError("");
                try {
                  await downloadReceipt(order, service);
                } catch {
                  setActionError("No se pudo generar el recibo. Inténtalo de nuevo.");
                }
              }}
            >
              <Ionicons name="download-outline" size={20} color={colors.primary} />
              <Body style={{ flex: 1 }}>Descargar recibo en PDF</Body>
              <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
            </Pressable>
            <View style={styles.receiptDivider} />
            <Pressable
              style={styles.receiptRow}
              disabled={sendingReceipt || receiptSent}
              onPress={async () => {
                setSendingReceipt(true);
                setActionError("");
                try {
                  const { data } = await supabase.functions.invoke("send-receipt", {
                    body: { order_id: order.id },
                  });
                  if (data?.sent) setReceiptSent(true);
                  else setActionError(data?.error || "No se pudo enviar el recibo.");
                } catch {
                  setActionError("No se pudo enviar el recibo.");
                } finally {
                  setSendingReceipt(false);
                }
              }}
            >
              <Ionicons
                name={receiptSent ? "checkmark-circle" : "mail-outline"}
                size={20}
                color={receiptSent ? colors.success : colors.primary}
              />
              <Body style={{ flex: 1 }}>
                {receiptSent ? "Enviado a tu email" : "Enviármelo por email"}
              </Body>
              {!receiptSent && <Ionicons name="chevron-forward" size={16} color={colors.subtle} />}
            </Pressable>
            {actionError ? (
              <Caption style={{ color: colors.destructive, marginTop: spacing.sm }}>{actionError}</Caption>
            ) : null}
          </Card>
        )}

        {/* Quién va a venir: foto, valoración, servicios y la furgoneta */}
        {driver && !delivered && <DriverCard driver={driver} driverId={order.driver_id} />}

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
          {(order.final_price ?? order.estimated_price) != null ? (
            <Text style={styles.price}>{euro(Number(order.final_price ?? order.estimated_price), 2)}</Text>
          ) : null}
        </Card>

        {/* Cancelar: hasta que la carga esté recogida. Con conductor ya en
            marcha cuesta, y el aviso lo dice antes de aceptar. */}
        {["pending", "scheduled", "accepted", "in_transit"].includes(order.status) && (
          <Button title="Cancelar el pedido" variant="plain" onPress={cancelOrder} />
        )}

        {/* Ya recogida: se resuelve hablando, como en cualquier plataforma. */}
        {order.status === "picked_up" && (
          <Caption style={{ textAlign: "center" }}>
            Con la carga ya recogida el pedido no se cancela desde la app. Escríbele al conductor o
            avísanos desde Ayuda.
          </Caption>
        )}

        {order.cancellation_fee ? (
          <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
            <Body style={{ fontFamily: "DMSans_700Bold" }}>
              Penalización por cancelar: {euro(Number(order.cancellation_fee))}
            </Body>
            <Caption>
              El conductor ya había salido hacia la recogida. Se aplicará en tu próximo servicio.
            </Caption>
          </Card>
        ) : null}

        <ReportIncident orderId={order.id} user={user} />
      </ScrollView>

      {/* Chat flotante: siempre a la vista, con no leidos y "escribiendo" */}
      {order.driver_id ? (
        <ChatBubbleButton orderId={order.id} partnerName={driverFirst} bottom={24} />
      ) : null}
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
  price: { fontSize: 20, fontFamily: "Poppins_700Bold", color: colors.foreground },
  stars: { flexDirection: "row", gap: spacing.sm },

  // Canvas 1g — búsqueda y negociación
  statsRow: { flexDirection: "row", gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontSize: 17, fontFamily: "Poppins_700Bold", color: colors.foreground },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overline: {
    fontSize: 11.5,
    fontFamily: "DMSans_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.success },
  liveText: { fontSize: 11.5, fontFamily: "DMSans_500Medium", color: colors.success },
  offerTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  offerAvatar: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  offerAvatarEmpty: { alignItems: "center", justifyContent: "center" },
  offerInitial: { fontSize: 17, fontFamily: "Poppins_700Bold", color: colors.primary },
  offerAmount: { fontSize: 19, fontFamily: "Poppins_700Bold", color: colors.foreground },
  offerTag: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  offerTagText: { fontSize: 10.5, fontFamily: "DMSans_700Bold" },

  // Canvas 1i — entregado
  // Canvas 2h: el visto verde y el titular, alineados a la izquierda.
  deliveredHero: { gap: 6, paddingTop: spacing.sm },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  receiptDivider: { height: 1, backgroundColor: colors.border },

  // Canvas 1h: mapa a sangre + hoja con asa montando encima.
  fullMapWrap: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg },
  sheet: {
    marginTop: -30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: -4,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: 2,
  },
  freshDot: { width: 8, height: 8, borderRadius: radius.full },
  shareRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 2 },
  shareText: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary },
});
