import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { serviceOf } from "../../lib/services";
import { countUnread } from "../../lib/unread";
import { Button, Caption, Card, Heading, Loading, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Mis pedidos. La RLS ya limita lo que el cliente puede ver, así que basta un
 * select sin filtro de propietario: el servidor no devolverá pedidos ajenos.
 */
const ACTIVE_STATUSES = ["pending", "accepted", "in_transit", "picked_up"];

const FILTERS = [
  { key: "active", label: "Activos" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
];

const STATUS = {
  pending: { label: "Buscando conductor", color: colors.warning, bg: colors.warningBg },
  accepted: { label: "Conductor asignado", color: colors.primary, bg: "#EFF6FF" },
  in_transit: { label: "En camino", color: colors.primary, bg: "#EFF6FF" },
  picked_up: { label: "Carga recogida", color: colors.primary, bg: "#EFF6FF" },
  delivered: { label: "Entregado", color: colors.success, bg: colors.successBg },
  cancelled: { label: "Cancelado", color: colors.destructive, bg: "#FEF2F2" },
};

export default function MisPedidos() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("active");
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
      insurance_selected: order.insurance_selected,
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone,
      payment_method: order.payment_method,
    };
    await AsyncStorage.setItem("request_draft_v1", JSON.stringify({ form: draft, photos: [] }));
    router.push("/(cliente)");
  };

  useEffect(() => {
    if (user) load();
  }, [user, load]);

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
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
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
          <Card>
            <Caption>
              {orders.length === 0
                ? "Todavía no has pedido nada. Cuando lo hagas, aparecerá aquí."
                : "No hay pedidos en esta pestaña."}
            </Caption>
          </Card>
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
                  <Title>
                    {service?.emoji} {service?.label || "Servicio"}
                    {unread[order.id] ? (
                      <Text style={styles.unread}>  💬 {unread[order.id]}</Text>
                    ) : null}
                  </Title>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Caption>{order.origin_address || "—"}</Caption>
                <Caption>→ {order.destination_address || "—"}</Caption>
                {order.estimated_price != null && (
                  <Text style={styles.price}>{order.estimated_price} €</Text>
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
  badgeText: { fontSize: 12, fontWeight: "600" },
  price: { fontSize: 16, fontWeight: "700", color: colors.foreground },
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
  filterText: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },
  unread: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
