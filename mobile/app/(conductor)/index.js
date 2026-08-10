import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "../../lib/driverProfile";
import { serviceOf } from "../../lib/services";
import { Body, Caption, Card, Heading, Loading, Title } from "../../components/ui";
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
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const prof = await fetchMyDriverProfile(user);
    setProfile(prof);

    if (!prof || prof.status !== "verified") {
      setOrders([]);
      return;
    }

    let query = supabase
      .from("transport_requests")
      .select("id, status, service_type, vehicle_type, origin_address, destination_address, estimated_price, needs_help, created_date")
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

  const toggleAvailable = async (value) => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("driver_profiles")
      .update({ is_available: value })
      .eq("id", profile.id);
    if (!error) setProfile(prev => ({ ...prev, is_available: value }));
    setSaving(false);
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

        {profile && (
          <Card>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Title>{profile.is_available ? "Disponible" : "No disponible"}</Title>
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

        {orders.length === 0 ? (
          <Card>
            <Caption>Ahora mismo no hay pedidos disponibles para tu furgoneta.</Caption>
          </Card>
        ) : (
          orders.map(order => {
            const service = serviceOf(order);
            return (
              <Card key={order.id}>
                <View style={styles.header}>
                  <Title>
                    {service?.emoji} {service?.label || "Servicio"}
                  </Title>
                  <Text style={styles.price}>{order.estimated_price} €</Text>
                </View>
                <Caption>Recogida: {order.origin_address || "—"}</Caption>
                <Caption>Entrega: {order.destination_address || "—"}</Caption>
                <View style={styles.tags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {order.vehicle_type === "large" ? "Furgoneta grande" : "Furgoneta pequeña"}
                    </Text>
                  </View>
                  {order.needs_help ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>Con ayuda de carga</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  price: { fontSize: 18, fontWeight: "700", color: colors.primary },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { backgroundColor: colors.secondary, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  tagText: { fontSize: 12, color: colors.mutedForeground },
});
