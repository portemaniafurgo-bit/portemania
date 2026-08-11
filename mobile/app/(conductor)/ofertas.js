import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "../../lib/driverProfile";
import { serviceOf } from "../../lib/services";
import { stopTracking } from "../../lib/tracking";
import { Body, Button, Caption, Card, ErrorText, Heading, Loading, Title } from "../../components/ui";
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
          timer = setTimeout(load, 400);
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
                <Button
                  title="Aceptar servicio"
                  loading={accepting === order.id}
                  disabled={!!activeJob || incomplete || profile?.docs_expired || !profile?.is_available}
                  onPress={() => accept(order)}
                />
                {activeJob ? (
                  <Caption>Termina el servicio en curso antes de aceptar otro.</Caption>
                ) : null}
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
