import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { serviceOf } from "../../lib/services";
import { Caption, Card, Heading, Loading, Title } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../theme";

/**
 * Historial del conductor (paridad con driver/history de la web): sus
 * servicios terminados, con fecha, importe y acceso al detalle (el detalle en
 * estado terminado muestra el chat como historial y la prueba de entrega).
 */
export default function HistorialConductor() {
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transport_requests")
      .select("id, status, service_type, origin_address, destination_address, estimated_price, final_price, delivery_time, created_date, client_rating")
      .eq("driver_id", user.id)
      .in("status", ["delivered", "cancelled"])
      .order("created_date", { ascending: false })
      .limit(100);
    setJobs(data || []);
  }, [user?.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (jobs === null) return <Loading label="Cargando tu historial…" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Heading>Mis servicios</Heading>

        {jobs.length === 0 ? (
          <EmptyState
            title="Aún no has completado servicios"
            hint="Cuando termines tu primer trabajo aparecerá aquí, con su importe y su prueba de entrega."
          />
        ) : (
          jobs.map(job => {
            const service = serviceOf(job);
            const delivered = job.status === "delivered";
            return (
              <Pressable key={job.id} onPress={() => router.push(`/(conductor)/job/${job.id}`)}>
                <Card>
                  <View style={styles.row}>
                    <Title>
                      {service?.emoji} {service?.label || "Servicio"}
                    </Title>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: delivered ? colors.successBg : "#FEF2F2" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: delivered ? colors.success : colors.destructive },
                        ]}
                      >
                        {delivered ? "Entregado" : "Cancelado"}
                      </Text>
                    </View>
                  </View>
                  <Caption>
                    {format(new Date(job.delivery_time || job.created_date), "d MMM yyyy · HH:mm", { locale: es })}
                  </Caption>
                  <Caption>{job.origin_address} → {job.destination_address}</Caption>
                  <View style={styles.row}>
                    <Text style={styles.price}>{job.final_price || job.estimated_price || 0} €</Text>
                    {job.client_rating ? (
                      <Text style={styles.stars}>{"★".repeat(job.client_rating)}</Text>
                    ) : null}
                  </View>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 12, fontWeight: "600" },
  price: { fontSize: 18, fontFamily: "Poppins_700Bold", color: colors.foreground },
  stars: { fontSize: 14, color: colors.accent },
});
