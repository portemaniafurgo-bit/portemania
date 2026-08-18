import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "../../lib/driverProfile";
import { serviceOf } from "../../lib/services";
import { distanceKm } from "../../lib/eta";
import { stopTracking } from "../../lib/tracking";
import TrackingMap from "../../components/TrackingMap";
import EmptyState from "../../components/EmptyState";
import ServiceIcon, { SERVICE_ICONS } from "../../components/ServiceIcon";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Loading, Title } from "../../components/ui";
import { Counter } from "../../components/wizard";
import { colors, radius, spacing } from "../../theme";

/**
 * Ofertas disponibles para el conductor.
 *
 * Reglas heredadas de la web y que NO se pueden relajar:
 *  - Solo ve pedidos pendientes.
 *  - Los de furgoneta grande solo se muestran a conductores con furgón grande
 *    (un pequeño no puede hacerlos y aceptarlos bloqueaba el pedido).
 *  - Con el perfil incompleto no se trabaja: faltan documentos obligatorios.
 *
 * En la Etapa 4 esta lista pasa a Realtime y se le añaden el detalle y la
 * aceptación anti-carrera; aquí se carga bajo demanda.
 */
export default function Ofertas() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [error, setError] = useState("");
  // Oferta expandida (mapa + distancia, estilo Uber: ver DÓNDE está el trabajo
  // antes de aceptarlo) y mi posición para calcular "a X km de ti".
  const [expandedId, setExpandedId] = useState(null);
  const [myPos, setMyPos] = useState(null);
  // Negociación (canvas 1i/1j): mis contraofertas vivas y la hoja de contraofertar.
  const [myOffers, setMyOffers] = useState([]);
  const [counterFor, setCounterFor] = useState(null);
  const [counterAmount, setCounterAmount] = useState(0);
  const [counterMessage, setCounterMessage] = useState("");
  const [negotiating, setNegotiating] = useState(false);

  const loadMyOffers = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("price_offers")
      .select("id, request_id, amount, status")
      .eq("driver_id", user.id)
      .eq("status", "pending");
    setMyOffers(data || []);
  }, [user?.id]);

  useEffect(() => {
    loadMyOffers();
  }, [loadMyOffers]);

  const myOfferFor = requestId => myOffers.find(o => o.request_id === requestId);

  /** El conductor acepta el precio que propuso el cliente (RPC: fija el
   *  final_price pactado, cosa que el update directo no puede). */
  const acceptAtClientPrice = async order => {
    setNegotiating(true);
    setError("");
    try {
      const { data, error: err } = await supabase.rpc("accept_at_client_price", {
        p_request_id: order.id,
      });
      if (err) throw err;
      supabase.functions
        .invoke("send-push", { body: { mode: "driver_assigned", order_id: data.id } })
        .catch(() => {});
      router.push(`/(conductor)/job/${data.id}`);
    } catch (err) {
      setError(err.message || "No se pudo aceptar.");
      await load();
    } finally {
      setNegotiating(false);
    }
  };

  const sendCounterOffer = async order => {
    setNegotiating(true);
    setError("");
    try {
      const { data, error: err } = await supabase.rpc("make_price_offer", {
        p_request_id: order.id,
        p_amount: counterAmount,
        p_message: counterMessage || null,
      });
      if (err) throw err;
      setCounterFor(null);
      setCounterMessage("");
      await loadMyOffers();
      // Push al cliente; sin Firebase aún cae en silencio.
      supabase.functions
        .invoke("send-push", { body: { mode: "price_offer", order_id: order.id, offer_id: data.id } })
        .catch(() => {});
    } catch (err) {
      setError(err.message || "No se pudo enviar la contraoferta.");
    } finally {
      setNegotiating(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) return; // no pedirlo aquí: se pide al aceptar un trabajo
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    const prof = await fetchMyDriverProfile(user);
    setProfile(prof);

    if (!prof || prof.status !== "verified") {
      setOrders([]);
      setActiveJob(null);
      return;
    }

    // Un trabajo en curso manda sobre todo lo demás: es lo primero que el
    // conductor necesita ver al abrir la app.
    const { data: mine } = await supabase
      .from("transport_requests")
      .select("id, status, service_type, origin_address, destination_address, estimated_price")
      .eq("driver_id", user.id)
      .in("status", ["accepted", "in_transit", "picked_up"])
      .order("created_date", { ascending: false })
      .limit(1);
    setActiveJob(mine?.[0] || null);

    let query = supabase
      .from("transport_requests")
      .select("id, status, service_type, vehicle_type, origin_address, destination_address, origin_lat, origin_lng, estimated_price, proposed_price, needs_help, created_date")
      .eq("status", "pending")
      .order("created_date", { ascending: false })
      .limit(50);

    const { data } = await query;
    setOrders(
      (data || []).filter(o => prof.vehicle_type === "large" || o.vehicle_type !== "large"),
    );
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Ofertas en vivo: cuando un pedido nuevo entra (o uno pendiente cambia de
  // manos), la lista se recarga sola — sin el polling de 10 s de la web. El
  // debounce agrupa ráfagas de eventos en una sola recarga.
  useEffect(() => {
    if (!user) return;
    let timer = null;
    const channel = supabase
      .channel("ofertas-conductor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transport_requests" },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            load();
            loadMyOffers(); // si el cliente aceptó/rechazó, mi estado cambia
          }, 400);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const toggleAvailable = async (value) => {
    if (!profile) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("driver_profiles")
      .update({ is_available: value })
      .eq("id", profile.id);
    if (!err) {
      setProfile(prev => ({ ...prev, is_available: value }));
      // Al desconectarse deja de compartir posición: seguir emitiendo cuando ya
      // no se trabaja es gastar batería y publicar dónde está sin motivo.
      if (!value) await stopTracking();
    }
    setSaving(false);
  };

  /**
   * Aceptar con update CONDICIONADO a que siga pendiente: si otro conductor se
   * adelantó, el update no afecta a ninguna fila y se avisa en vez de robarle
   * el servicio. Es la misma protección anti-carrera que la web.
   */
  const accept = async (order) => {
    setAccepting(order.id);
    setError("");
    try {
      const { data: updated, error: err } = await supabase
        .from("transport_requests")
        .update({
          status: "accepted",
          driver_id: user.id,
          // El nombre del PERFIL primero: en cuentas invitadas por email
          // profiles.full_name está vacío y el cliente veía el correo del
          // conductor como nombre.
          driver_name: profile?.full_name || user?.user_metadata?.full_name || "Conductor",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending")
        .select();
      if (err) throw err;

      if (!updated || updated.length === 0) {
        setError("Otro conductor ha aceptado este servicio antes que tú.");
        await load();
        return;
      }

      supabase.functions
        .invoke("send-push", { body: { mode: "driver_assigned", order_id: order.id } })
        .catch(() => {});

      router.push(`/(conductor)/job/${order.id}`);
    } catch (err) {
      setError("No se pudo aceptar: " + (err.message || "error de conexión"));
    } finally {
      setAccepting(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (orders === null) return <Loading label="Buscando pedidos…" />;

  const incomplete = profile && isDriverProfileIncomplete(profile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Heading>Pedidos disponibles</Heading>

        {activeJob && (
          <Card style={{ borderColor: colors.primary, borderWidth: 2 }}>
            <Title>Tienes un servicio en curso</Title>
            <Caption>{activeJob.origin_address} → {activeJob.destination_address}</Caption>
            <Button
              title="Continuar servicio"
              onPress={() => router.push(`/(conductor)/job/${activeJob.id}`)}
            />
          </Card>
        )}

        <ErrorText>{error}</ErrorText>

        {profile && (
          <Card
            style={
              profile.is_available
                ? { backgroundColor: colors.successBg, borderColor: colors.success }
                : null
            }
          >
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Title style={profile.is_available ? { color: colors.success } : null}>
                  {profile.is_available ? "Disponible" : "No disponible"}
                </Title>
                <Caption>
                  {profile.is_available
                    ? "Recibes avisos de pedidos nuevos."
                    : "No te llegarán ofertas mientras esté apagado."}
                </Caption>
              </View>
              <Switch
                value={!!profile.is_available}
                onValueChange={toggleAvailable}
                disabled={saving || profile.status !== "verified"}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </Card>
        )}

        {!profile && (
          <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
            <Body>Todavía no tienes perfil de conductor.</Body>
            <Caption>Completa tu alta en clicyvoy.es/ser-conductor o pídelo a la empresa.</Caption>
          </Card>
        )}

        {profile && profile.status !== "verified" && (
          <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
            <Body>Tu perfil está pendiente de verificación.</Body>
            <Caption>En cuanto la empresa lo apruebe empezarás a ver pedidos.</Caption>
          </Card>
        )}

        {incomplete && (
          <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
            <Body>Te faltan documentos obligatorios.</Body>
            <Caption>Complétalos en tu perfil para poder aceptar servicios.</Caption>
          </Card>
        )}

        {profile?.docs_expired && (
          <Card style={{ backgroundColor: "#FEF2F2", borderColor: colors.destructive }}>
            <Body>Tienes documentación caducada.</Body>
            <Caption>
              Sube el documento renovado con su nueva fecha en tu perfil y vuelve a ponerte
              disponible.
            </Caption>
          </Card>
        )}

        {orders.length === 0 ? (
          <EmptyState
            title="No hay pedidos ahora mismo"
            hint="Te avisaremos en cuanto entre uno compatible con tu furgoneta. Mantente disponible."
          />
        ) : (
          orders.map(order => {
            const service = serviceOf(order);
            const expanded = expandedId === order.id;
            const pickup =
              order.origin_lat && order.origin_lng
                ? { lat: order.origin_lat, lng: order.origin_lng }
                : null;
            const km = myPos && pickup ? distanceKm(myPos, pickup) : null;
            return (
              <Pressable key={order.id} onPress={() => setExpandedId(expanded ? null : order.id)}>
              <Card style={expanded ? { borderColor: colors.primary, borderWidth: 2 } : null}>
                <View style={styles.header}>
                  <View style={styles.serviceChip}>
                    <Ionicons name={SERVICE_ICONS[service?.key] || "cube-outline"} size={15} color={colors.primary} />
                    <Text style={styles.serviceChipText}>{service?.label || "Servicio"}</Text>
                  </View>
                  {order.proposed_price != null ? (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.price}>{Number(order.proposed_price).toFixed(0)} €</Text>
                      <Caption>ofrece el cliente · tarifa {order.estimated_price} €</Caption>
                    </View>
                  ) : (
                    <Text style={styles.price}>{order.estimated_price} €</Text>
                  )}
                </View>
                <Caption>Recogida: {order.origin_address || "—"}</Caption>
                <Caption>Entrega: {order.destination_address || "—"}</Caption>
                <View style={styles.tags}>
                  {km != null ? (
                    <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.tagText, { color: colors.primary, fontFamily: "DMSans_700Bold" }]}>
                        a {km.toFixed(1)} km de ti
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {order.vehicle_type === "large" ? "Furgoneta grande" : "Furgoneta pequeña"}
                    </Text>
                  </View>
                  {order.needs_help ? (
                    <View style={[styles.tag, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.tagText, { color: colors.warning, fontFamily: "DMSans_700Bold" }]}>
                        Con ayuda de carga
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Al tocar la tarjeta: DÓNDE está la recogida, antes de aceptar */}
                {expanded && pickup ? (
                  <TrackingMap driverLocation={null} target={pickup} height={170} />
                ) : null}
                {expanded && !pickup ? (
                  <Caption>Este pedido no tiene coordenadas de recogida (dirección manual).</Caption>
                ) : null}

                {order.proposed_price == null ? (
                  /* Sin negociación: flujo clásico intacto */
                  <Button
                    title="Aceptar servicio"
                    loading={accepting === order.id}
                    disabled={!!activeJob || incomplete || profile?.docs_expired || !profile?.is_available}
                    onPress={() => accept(order)}
                  />
                ) : myOfferFor(order.id) && counterFor !== order.id ? (
                  <View style={styles.myOfferBox}>
                    <Body style={{ fontFamily: "DMSans_700Bold" }}>
                      Tu contraoferta: {Number(myOfferFor(order.id).amount).toFixed(2)} €
                    </Body>
                    <Caption>Esperando al cliente.</Caption>
                    <Button
                      title="Cambiar contraoferta"
                      variant="plain"
                      onPress={() => {
                        setCounterFor(order.id);
                        setCounterAmount(Math.round(myOfferFor(order.id).amount));
                        setCounterMessage("");
                      }}
                    />
                  </View>
                ) : (
                  /* Negociación: aceptar el precio del cliente o contraofertar */
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      title={`Aceptar por ${Number(order.proposed_price).toFixed(0)} €`}
                      loading={negotiating}
                      disabled={!!activeJob || incomplete || profile?.docs_expired || !profile?.is_available}
                      onPress={() => acceptAtClientPrice(order)}
                      style={{ flex: 2 }}
                    />
                    <Button
                      title="Contraofertar"
                      variant="plain"
                      disabled={!!activeJob || incomplete || profile?.docs_expired || !profile?.is_available}
                      onPress={() => {
                        setCounterFor(order.id);
                        setCounterAmount(Math.round(order.estimated_price || order.proposed_price || 40));
                        setCounterMessage("");
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
                {activeJob ? (
                  <Caption>Termina el servicio en curso antes de aceptar otro.</Caption>
                ) : null}
              </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Hoja inferior de contraoferta (canvas 1j): importe grande, +/− y motivo */}
      <Modal
        visible={counterFor != null}
        transparent
        animationType="slide"
        onRequestClose={() => !negotiating && setCounterFor(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => !negotiating && setCounterFor(null)} />
        <View style={styles.counterSheet}>
          <View style={styles.sheetHandle} />
          <Title>Tu contraoferta</Title>
          {(() => {
            const order = orders?.find(o => o.id === counterFor);
            return order ? (
              <Caption>
                El cliente ofrece {Number(order.proposed_price).toFixed(0)} € · tarifa{" "}
                {order.estimated_price} €
              </Caption>
            ) : null;
          })()}
          <Text style={styles.counterBig}>{counterAmount} €</Text>
          <Counter label="Ajusta el importe" value={counterAmount} onChange={setCounterAmount} min={5} max={500} />
          <Field
            value={counterMessage}
            onChangeText={setCounterMessage}
            placeholder="Motivo (opcional): distancia, plantas…"
          />
          <Button
            title={`Enviar contraoferta de ${counterAmount} €`}
            loading={negotiating}
            disabled={counterAmount < 5}
            onPress={() => {
              const order = orders?.find(o => o.id === counterFor);
              if (order) sendCounterOffer(order);
            }}
          />
          <Button title="Cancelar" variant="plain" disabled={negotiating} onPress={() => setCounterFor(null)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  price: { fontSize: 22, fontFamily: "Poppins_700Bold", color: colors.primary },
  serviceChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primarySoft, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  serviceChipText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: colors.primary },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.secondary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  tagText: { fontSize: 12, color: colors.mutedForeground },
  myOfferBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  backdrop: { flex: 1, backgroundColor: "#00000066" },
  counterSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  counterBig: { fontSize: 28, fontFamily: "Poppins_700Bold", color: colors.primary, textAlign: "center" },
});
