import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { serviceOf } from "../../lib/services";
import { countUnread } from "../../lib/unread";
import { euro } from "../../lib/money";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { Button, Caption, Card, Heading, Loading, Title } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import ServiceIcon from "../../components/ServiceIcon";
import { Ionicons } from "@expo/vector-icons";
import { useBottomPadding } from "../../lib/layout";
import { colors, radius, spacing } from "../../theme";

/**
 * Mis pedidos. La RLS ya limita lo que el cliente puede ver, así que basta un
 * select sin filtro de propietario: el servidor no devolverá pedidos ajenos.
 */
const ACTIVE_STATUSES = ["scheduled", "pending", "accepted", "in_transit", "picked_up"];

const FILTERS = [
  { key: "active", label: "Activos" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
];

const STATUS = {
  scheduled: { label: "Programado", color: colors.primary, bg: colors.primarySoft },
  pending: { label: "Buscando conductor", color: colors.warning, bg: colors.warningBg },
  accepted: { label: "Conductor asignado", color: colors.primary, bg: colors.primarySoft },
  in_transit: { label: "En camino", color: colors.primary, bg: colors.primarySoft },
  picked_up: { label: "Carga recogida", color: colors.primary, bg: colors.primarySoft },
  delivered: { label: "Entregado", color: colors.success, bg: colors.successBg },
  cancelled: { label: "Cancelado", color: colors.destructive, bg: "#FEF2F2" },
};

/** «Hoy 11:08», «Ayer 18:40» o «12 ago 09:15». */
function whenLabel(order) {
  const date = new Date(order.delivery_time || order.scheduled_at || order.created_date);
  const hour = format(date, "HH:mm");
  if (isToday(date)) return `Hoy ${hour}`;
  if (isYesterday(date)) return `Ayer ${hour}`;
  return format(date, "d MMM · HH:mm", { locale: es });
}

export default function MisPedidos() {
  // Aire al final para que ningun boton quede bajo la barra del sistema.
  const bottomPad = useBottomPadding();
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // «Mis recibos» (perfil) entra aquí ya filtrado por entregados.
  const { filter: filterParam } = useLocalSearchParams();
  const [filter, setFilter] = useState(
    ["active", "delivered", "cancelled"].includes(filterParam) ? filterParam : "active",
  );
  const [unread, setUnread] = useState({});

  const load = useCallback(async () => {
    // `select("*")` a propósito: "repetir pedido" necesita todos los campos del
    // original para rellenar el asistente, no solo los que se pintan aquí.
    const { data } = await supabase
      .from("transport_requests")
      .select("*")
      .order("created_date", { ascending: false })
      .limit(50);
    setOrders(data || []);
    setUnread(await countUnread((data || []).map(o => o.id), user?.id));
  }, [user?.id]);

  /**
   * Repetir un pedido: deja el borrador que lee el asistente y lleva a él. No
   * se copia el estado ni el precio, que los fija el servidor de nuevo — sería
   * fácil colar el precio viejo de un servicio cuya tarifa ha cambiado.
   */
  const repeat = async order => {
    const draft = {
      service: order.service_type,
      destination_zone: order.destination_zone,
      client_name: order.client_name,
      client_phone: order.client_phone,
      origin_address: order.origin_address,
      destination_address: order.destination_address,
      stops: order.stops || [],
      cargo_description: order.cargo_description,
      items_count: order.items_count,
      needs_help: order.needs_help,
      help_description: order.help_description,
      origin_has_lift: order.origin_has_lift,
      origin_floors: order.origin_floors,
      destination_has_lift: order.destination_has_lift,
      destination_floors: order.destination_floors,
      package_weight: order.package_weight,
      extra_hours: order.extra_hours,
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone,
      payment_method: order.payment_method,
    };
    await AsyncStorage.setItem("request_draft_v1", JSON.stringify({ form: draft, photos: [] }));
    router.push("/(cliente)/pedir");
  };

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // La pestaña ya está montada cuando se entra desde «Mis recibos», así que el
  // estado inicial no basta: hay que obedecer al parámetro cuando cambia.
  useEffect(() => {
    if (["active", "delivered", "cancelled"].includes(filterParam)) setFilter(filterParam);
  }, [filterParam]);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (orders === null) return <Loading label="Cargando tus pedidos…" />;

  const visible = orders.filter(o => {
    if (filter === "active") return ACTIVE_STATUSES.includes(o.status);
    if (filter === "delivered") return o.status === "delivered";
    return o.status === "cancelled";
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg, paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Heading>Mis pedidos</Heading>

        <View style={styles.filters}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filter, filter === f.key && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            title={orders.length === 0 ? "Todavía no has pedido nada" : "Nada en esta pestaña"}
            hint={orders.length === 0 ? "Tu primer porte está a un minuto: pide desde la pestaña Pedir." : undefined}
          />
        ) : (
          visible.map(order => {
            const status = STATUS[order.status] || {
              label: order.status,
              color: colors.mutedForeground,
              bg: colors.secondary,
            };
            const service = serviceOf(order);
            return (
              <Pressable key={order.id} onPress={() => router.push(`/(cliente)/order/${order.id}`)}>
              <Card>
                <View style={styles.header}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 }}>
                    <ServiceIcon serviceKey={service?.key} size={34} />
                    <Title>{service?.label || "Servicio"}</Title>
                    {unread[order.id] ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                        <Text style={styles.unread}>{unread[order.id]}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                {/* Cuándo se pidió (canvas 2f: cada tarjeta lleva su fecha) */}
                <Caption>{whenLabel(order)}</Caption>
                {/* Que el pedido guarda foto y/o firma de la entrega: es lo que
                    respalda una reclamación, y hasta ahora no se veía. */}
                {order.status === "delivered" && (order.proof_photo_url || order.proof_signature_url) ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
                    <Text style={styles.proofTag}>
                      {order.proof_photo_url && order.proof_signature_url
                        ? "Con foto y firma de entrega"
                        : order.proof_signature_url
                          ? "Con firma de entrega"
                          : "Con foto de entrega"}
                    </Text>
                  </View>
                ) : null}
                <Caption>{order.origin_address || "—"}</Caption>
                <Caption>→ {order.destination_address || "—"}</Caption>
                {(order.final_price ?? order.estimated_price) != null && (
                  <Text style={styles.price}>
                    {euro(Number(order.final_price ?? order.estimated_price), 2)}
                  </Text>
                )}
                {["delivered", "cancelled"].includes(order.status) ? (
                  <Button title="Repetir este pedido" variant="plain" onPress={() => repeat(order)} />
                ) : null}
              </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 12, fontFamily: "DMSans_700Bold" },
  price: { fontSize: 16, fontFamily: "Poppins_700Bold", color: colors.foreground },
  filters: { flexDirection: "row", gap: spacing.sm },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: 13, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  unread: { fontSize: 13, fontFamily: "DMSans_700Bold", color: colors.primary },
  proofTag: { fontSize: 11.5, fontFamily: "DMSans_500Medium", color: colors.success },
});
