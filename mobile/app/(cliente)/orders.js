import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { serviceOf } from "../../lib/services";
import { Caption, Card, Heading, Loading, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Mis pedidos. La RLS ya limita lo que el cliente puede ver, así que basta un
 * select sin filtro de propietario: el servidor no devolverá pedidos ajenos.
 */
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

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transport_requests")
      .select("id, status, service_type, origin_address, destination_address, estimated_price, created_date")
      .order("created_date", { ascending: false })
      .limit(50);
    setOrders(data || []);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (orders === null) return <Loading label="Cargando tus pedidos…" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Heading>Mis pedidos</Heading>

        {orders.length === 0 ? (
          <Card>
            <Caption>Todavía no has pedido nada. Cuando lo hagas, aparecerá aquí.</Caption>
          </Card>
        ) : (
          orders.map(order => {
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
});
