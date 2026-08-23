import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format, isAfter, isToday, isYesterday, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { DEFAULT_TARIFFS, fetchTariffs } from "../../lib/tariffs";
import { serviceOf } from "../../lib/services";
import { euro, rating1 } from "../../lib/money";
import { Caption, Card, Loading, Title } from "../../components/ui";
import { useBottomPadding } from "../../lib/layout";
import { colors, radius, spacing } from "../../theme";

/**
 * Ganancias del conductor — MISMA fórmula que la web (driver/earnings):
 * parte del conductor = (final_price || estimated_price) × (100 − comisión)%,
 * MÁS las propinas íntegras (no llevan comisión).
 *
 * La estructura es la del canvas 3d: total grande arriba, tres cifras (mes,
 * semana, servicios), barras L-D con el total de la semana, la nota del reparto
 * y la lista de últimos servicios. Las barras van en SVG-menos: Views con
 * altura — para siete barras no hace falta ninguna librería.
 */
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

export default function Ganancias() {
  // Aire al final para que ningun boton quede bajo la barra del sistema.
  const bottomPad = useBottomPadding();
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState(null);
  const [tariffs, setTariffs] = useState(DEFAULT_TARIFFS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, t] = await Promise.all([
      supabase
        .from("transport_requests")
        .select("id, status, service_type, final_price, estimated_price, tip_amount, created_date, delivery_time, destination_address, client_rating")
        .eq("driver_id", user.id)
        .in("status", ["delivered", "cancelled"])
        .order("created_date", { ascending: false })
        .limit(100),
      fetchTariffs(),
    ]);
    setJobs(data || []);
    setTariffs(t);
  }, [user?.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Al entrar en Ganancias tras terminar un viaje, los importes se refrescan
  // solos — antes había que tirar de la lista a mano.
  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load]),
  );

  if (jobs === null) return <Loading label="Calculando tus ganancias…" />;

  const commissionPct = tariffs.commission_pct ?? 15;
  const share = (100 - commissionPct) / 100;
  // La propina va íntegra: entra sin aplicar comisión.
  const amountOf = j =>
    j.status === "delivered"
      ? (j.final_price || j.estimated_price || 0) * share + (j.tip_amount || 0)
      : 0;

  const delivered = jobs.filter(j => j.status === "delivered");
  const total = delivered.reduce((acc, j) => acc + amountOf(j), 0);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());
  const week = delivered.filter(j => j.created_date && isAfter(new Date(j.created_date), weekStart));
  const month = delivered.filter(j => j.created_date && isAfter(new Date(j.created_date), monthStart));

  // Barras de los últimos 7 días, de lunes a domingo como en el canvas.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = format(date, "yyyy-MM-dd");
    const amount = delivered
      .filter(j => j.created_date && format(new Date(j.created_date), "yyyy-MM-dd") === key)
      .reduce((acc, j) => acc + amountOf(j), 0);
    // getDay(): 0 = domingo. El canvas empieza en lunes.
    days.push({ letter: DAY_LETTERS[(date.getDay() + 6) % 7], amount, today: i === 0 });
  }
  const max = Math.max(...days.map(d => d.amount), 1);
  const last7 = days.reduce((acc, d) => acc + d.amount, 0);

  const whenLabel = job => {
    const date = new Date(job.delivery_time || job.created_date);
    const hour = format(date, "HH:mm");
    if (isToday(date)) return `Hoy ${hour}`;
    if (isYesterday(date)) return `Ayer ${hour}`;
    return `${format(date, "EEEE", { locale: es })} ${hour}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg, paddingBottom: bottomPad }}
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
        {/* Total grande, sin etiqueta que compita (canvas 3d) */}
        <View style={styles.hero}>
          <Caption>Total ganado</Caption>
          <Text style={styles.heroValue}>{euro(total)}</Text>
        </View>

        {/* Este mes · Esta semana · Servicios */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{euro(month.reduce((a, j) => a + amountOf(j), 0))}</Text>
            <Caption>Este mes</Caption>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{euro(week.reduce((a, j) => a + amountOf(j), 0))}</Text>
            <Caption>Esta semana</Caption>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{delivered.length}</Text>
            <Caption>Servicios</Caption>
          </View>
        </View>

        {/* Últimos 7 días + total de la semana + barras L-D */}
        <Card>
          <View style={styles.chartHeader}>
            <Title>Últimos 7 días</Title>
            <Caption>{euro(last7)} en total</Caption>
          </View>
          <View style={styles.chart}>
            {days.map((d, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max((d.amount / max) * 100, d.amount > 0 ? 8 : 3)}%`,
                        backgroundColor: d.amount > 0 ? colors.primary : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLetter, d.today && { color: colors.primary, fontFamily: "DMSans_700Bold" }]}>
                  {d.letter}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Caption style={{ textAlign: "center" }}>
          Recibes el {100 - commissionPct} % de cada servicio. Las propinas son íntegras para ti.
        </Caption>

        {/* Últimos servicios */}
        <Text style={styles.overline}>Últimos servicios</Text>
        {jobs.length === 0 ? (
          <Card>
            <Caption>Cuando termines tu primer servicio verás aquí lo que has ganado.</Caption>
          </Card>
        ) : (
          <Card style={{ gap: 0 }}>
            {jobs.slice(0, 12).map((job, i) => {
              const service = serviceOf(job);
              const cancelled = job.status === "cancelled";
              return (
                <View key={job.id}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    style={styles.jobRow}
                    onPress={() => router.push(`/(conductor)/job/${job.id}`)}
                  >
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.jobTitle}>
                        {service?.label || "Servicio"}
                        {cancelled ? " · cancelada" : ""}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Caption>{whenLabel(job)}</Caption>
                        {cancelled ? (
                          <Caption>· cliente canceló</Caption>
                        ) : job.client_rating ? (
                          <>
                            <Caption>· </Caption>
                            <Ionicons name="star" size={11} color={colors.accent} />
                            <Caption>{rating1(job.client_rating)}</Caption>
                          </>
                        ) : null}
                      </View>
                    </View>
                    <Text style={[styles.jobAmount, cancelled && { color: colors.subtle }]}>
                      {cancelled ? "—" : euro(amountOf(job), 2)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 2, paddingTop: spacing.sm },
  heroValue: { fontSize: 40, fontFamily: "Poppins_700Bold", color: colors.foreground, letterSpacing: -0.5 },
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
  chartHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, height: 132 },
  barCol: { flex: 1, alignItems: "center", gap: spacing.sm },
  barTrack: { height: 100, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 6, minHeight: 4 },
  barLetter: { fontSize: 11.5, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  overline: {
    fontSize: 11.5,
    fontFamily: "DMSans_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  divider: { height: 1, backgroundColor: colors.border },
  jobRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  jobTitle: { fontSize: 14.5, fontFamily: "DMSans_700Bold", color: colors.foreground },
  jobAmount: { fontSize: 16, fontFamily: "Poppins_700Bold", color: colors.foreground },
});
