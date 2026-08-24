import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "../../lib/driverProfile";
import { serviceOf } from "../../lib/services";
import { distanceKm } from "../../lib/eta";
import { euro } from "../../lib/money";
import { stopTracking } from "../../lib/tracking";
import EmptyState from "../../components/EmptyState";
import OfferCard from "../../components/OfferCard";
import { Body, Button, Caption, Card, ErrorText, Heading, Loading, Title } from "../../components/ui";
import { useBottomPadding } from "../../lib/layout";
import { colors, radius, spacing } from "../../theme";

/**
 * Ofertas del conductor (canvas 1i): interruptor de disponibilidad, avisos de
 * documentación y las ofertas cercanas con el precio que propone el cliente.
 *
 * Reglas heredadas de la web y que NO se pueden relajar:
 *  - Solo ve pedidos pendientes.
 *  - Los de furgoneta grande solo se muestran a conductores con furgón grande
 *    (un pequeño no puede hacerlos y aceptarlos bloqueaba el pedido).
 *  - Con el perfil incompleto no se trabaja: faltan documentos obligatorios.
 */

/** «Publicado hace 40 s» / «hace 6 min» / «hace 2 h». */
function publishedAgo(date, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `Publicado hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Publicado hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Publicado hace ${hours} h`;
  return `Publicado hace ${Math.floor(hours / 24)} días`;
}

// Motivos de contraoferta del canvas 1j: se tocan, no se escriben.
const COUNTER_REASONS = ["Sin ascensor", "Carga voluminosa", "Hora punta"];

export default function Ofertas() {
  // Aire al final para que ningun boton quede bajo la barra del sistema.
  const bottomPad = useBottomPadding();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [error, setError] = useState("");
  // Mi posición, para calcular "a X km de ti" en cada oferta.
  const [myPos, setMyPos] = useState(null);
  // Negociación (canvas 1i/1j): mis contraofertas vivas y la hoja de contraofertar.
  const [myOffers, setMyOffers] = useState([]);
  const [counterFor, setCounterFor] = useState(null);
  const [counterAmount, setCounterAmount] = useState(0);
  const [counterMessage, setCounterMessage] = useState("");
  const [negotiating, setNegotiating] = useState(false);
  // «Publicado hace X»: se refresca solo, si no envejece mal en pantalla.
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

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
      .select("id, status, service_type, origin_address, destination_address, estimated_price, final_price")
      .eq("driver_id", user.id)
      .in("status", ["accepted", "in_transit", "picked_up"])
      .order("created_date", { ascending: false })
      .limit(1);
    setActiveJob(mine?.[0] || null);

    const { data } = await supabase
      .from("transport_requests")
      .select("id, status, service_type, vehicle_type, origin_address, destination_address, origin_lat, origin_lng, origin_floors, origin_has_lift, destination_floors, destination_has_lift, estimated_price, proposed_price, needs_help, package_weight, distance_km, payment_method, created_date")
      .eq("status", "pending")
      .order("created_date", { ascending: false })
      .limit(50);

    setOrders(
      (data || []).filter(o => prof.vehicle_type === "large" || o.vehicle_type !== "large"),
    );
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Volver a la pestaña REFRESCA: tras terminar un viaje, el aviso de
  // "servicio en curso" y la lista no pueden quedarse viejos si Realtime
  // se cayó (bug real reportado el 2026-08-18).
  useFocusEffect(
    useCallback(() => {
      if (user) {
        load();
        loadMyOffers();
      }
    }, [user, load, loadMyOffers]),
  );

  // Ofertas en vivo: cuando un pedido nuevo entra (o uno pendiente cambia de
  // manos), la lista se recarga sola — sin el polling de 10 s de la web. El
  // debounce agrupa ráfagas de eventos en una sola recarga.
  useEffect(() => {
    if (!user) return;
    let timer = null;
    const channel = supabase
      .channel(`ofertas-conductor-${Math.random().toString(36).slice(2, 10)}`)
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
  }, [user, load, loadMyOffers]);

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
  const blocked = !!activeJob || incomplete || profile?.docs_expired || !profile?.is_available;
  const counterOrder = orders.find(o => o.id === counterFor);
  const counterService = counterOrder ? serviceOf(counterOrder) : null;
  const counterBase = counterOrder ? Number(counterOrder.proposed_price) : 0;
  const counterDelta = counterAmount - counterBase;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {/* Cabecera blanca fija del canvas 1i: título, avatar y disponibilidad */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTop}>
          <Heading>Ofertas</Heading>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(profile?.full_name || user?.email || "C").slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>

        {profile && (
          <View style={[styles.availability, !profile.is_available && styles.availabilityOff]}>
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: profile.is_available ? colors.success : colors.subtle },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.availabilityTitle, !profile.is_available && { color: colors.mutedForeground }]}
              >
                {profile.is_available ? "Disponible" : "No disponible"}
              </Text>
              <Text
                style={[styles.availabilityHint, !profile.is_available && { color: colors.subtle }]}
              >
                {profile.is_available
                  ? "Recibes avisos de nuevos portes"
                  : "No te llegarán ofertas mientras esté apagado"}
              </Text>
            </View>
            <Switch
              value={!!profile.is_available}
              onValueChange={toggleAvailable}
              disabled={saving || profile.status !== "verified"}
              trackColor={{ true: colors.success, false: colors.hairline }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingHorizontal: spacing.screen, gap: 12, paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
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
            <Body style={{ fontFamily: "DMSans_700Bold", color: colors.destructive }}>
              Tienes documentación caducada.
            </Body>
            <Caption>
              No recibirás ofertas hasta subir el documento en vigor desde tu perfil.
            </Caption>
          </Card>
        )}

        {/* Cabecera de la lista: cuántas y en vivo (canvas 1i) */}
        {orders.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.overline}>
              {orders.length} {orders.length === 1 ? "oferta cerca de ti" : "ofertas cerca de ti"}
            </Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>En vivo</Text>
            </View>
          </View>
        )}

        {orders.length === 0 ? (
          <EmptyState
            title="Aún no hay ofertas"
            hint="Te avisamos en cuanto entre un porte cerca. Mantén el GPS activo para aparecer primero."
          />
        ) : (
          orders.map(order => {
            const service = serviceOf(order);
            const pickup =
              order.origin_lat && order.origin_lng
                ? { lat: order.origin_lat, lng: order.origin_lng }
                : null;
            const km = myPos && pickup ? distanceKm(myPos, pickup) : null;
            const negotiable = order.proposed_price != null;
            const mine = myOfferFor(order.id);
            return (
              <OfferCard
                key={order.id}
                order={order}
                service={service}
                publishedLabel={publishedAgo(order.created_date, now)}
                distanceLabel={km != null ? `a ${km.toFixed(1).replace(".", ",")} km de ti` : null}
                pickup={pickup}
                negotiable={negotiable}
                myOffer={mine}
                blocked={blocked}
                busy={accepting === order.id || negotiating}
                onAccept={() => (negotiable ? acceptAtClientPrice(order) : accept(order))}
                onCounter={() => {
                  setCounterFor(order.id);
                  // Se abre en la tarifa calculada: es el precio que la empresa
                  // considera justo para ese servicio.
                  setCounterAmount(Math.round(order.estimated_price || order.proposed_price || 40));
                  setCounterMessage("");
                }}
                onChangeCounter={() => {
                  setCounterFor(order.id);
                  setCounterAmount(Math.round(mine.amount));
                  setCounterMessage("");
                }}
              />
            );
          })
        )}
      </ScrollView>
      {/* Hoja de contraoferta (canvas 1j): importe grande con +/−, atajos y motivo */}
      <Modal
        visible={counterFor != null}
        transparent
        animationType="slide"
        onRequestClose={() => !negotiating && setCounterFor(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => !negotiating && setCounterFor(null)} />
        <View style={styles.counterSheet}>
          <View style={styles.sheetHandle} />

          {counterOrder ? (
            <View style={styles.header}>
              <Caption>
                {counterService?.label || "Servicio"}
                {counterOrder.needs_help ? " · con ayuda" : ""}
              </Caption>
              <Text style={styles.counterClientPrice}>{euro(counterBase)}</Text>
            </View>
          ) : null}

          <Title>Tu contraoferta</Title>
          <Caption>
            El cliente pide {euro(counterBase)}. Di tu precio y por qué: con motivo se acepta el
            doble de veces.
          </Caption>

          {/* Importe grande con +/−, y cuánto sube sobre lo que pide el cliente */}
          <View style={styles.counterRow}>
            <Pressable
              onPress={() => setCounterAmount(a => Math.max(5, a - 1))}
              style={styles.stepper}
              hitSlop={6}
            >
              <Ionicons name="remove" size={22} color={colors.primary} />
            </Pressable>
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={styles.counterBig}>{euro(counterAmount)}</Text>
              {counterDelta !== 0 ? (
                <Caption>
                  {counterDelta > 0 ? "+" : "−"}
                  {euro(Math.abs(counterDelta))} sobre su oferta
                </Caption>
              ) : (
                <Caption>igual que su oferta</Caption>
              )}
            </View>
            <Pressable
              onPress={() => setCounterAmount(a => Math.min(500, a + 1))}
              style={styles.stepper}
              hitSlop={6}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          </View>

          {/* Atajos: la tarifa y dos escalones por encima */}
          <View style={styles.chips}>
            {[0, 2, 5].map(extra => {
              const value = Math.round((counterOrder?.estimated_price || counterBase) + extra);
              const active = counterAmount === value;
              return (
                <Pressable
                  key={extra}
                  onPress={() => setCounterAmount(value)}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={[styles.chipText, active && { color: colors.primary }]}>
                    {euro(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.overline}>Motivo (opcional)</Text>
          <View style={styles.chips}>
            {COUNTER_REASONS.map(reason => {
              const active = counterMessage.includes(reason);
              return (
                <Pressable
                  key={reason}
                  onPress={() =>
                    setCounterMessage(prev =>
                      prev.includes(reason)
                        ? prev.replace(reason, "").replace(/\s*·\s*$/, "").trim()
                        : prev
                          ? `${prev} · ${reason}`
                          : reason,
                    )
                  }
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={[styles.chipText, active && { color: colors.primary }]}>{reason}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={counterMessage}
            onChangeText={setCounterMessage}
            placeholder="Y si quieres, cuéntaselo con tus palabras…"
            placeholderTextColor={colors.subtle}
            style={styles.counterInput}
            multiline
          />

          <Button
            title={`Enviar ${euro(counterAmount)}`}
            loading={negotiating}
            disabled={counterAmount < 5}
            onPress={() => counterOrder && sendCounterOffer(counterOrder)}
          />
          <Button title="Cancelar" variant="plain" disabled={negotiating} onPress={() => setCounterFor(null)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  // Cabecera blanca del canvas 1i
  headerBlock: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.screen,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 16,
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: colors.primary },
  availability: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.successBg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  availabilityOff: { backgroundColor: colors.background },
  availabilityDot: { width: 10, height: 10, borderRadius: 5 },
  availabilityTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#0B6E4F" },
  availabilityHint: { fontSize: 12, fontFamily: "DMSans_400Regular", color: "#0B8C63", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  overline: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.subtle, textTransform: "uppercase" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.success },
  liveText: { fontSize: 11.5, fontFamily: "DMSans_500Medium", color: "#0B8C63" },
  myOfferBox: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  backdrop: { flex: 1, backgroundColor: "#00000066" },
  counterSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
  counterClientPrice: { fontSize: 17, fontFamily: "Poppins_700Bold", color: colors.foreground },
  counterRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepper: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBig: { fontSize: 34, fontFamily: "Poppins_700Bold", color: colors.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  counterInput: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "DMSans_400Regular",
    color: colors.foreground,
    minHeight: 60,
  },
});
