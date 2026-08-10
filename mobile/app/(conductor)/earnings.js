import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { format, isAfter, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { DEFAULT_TARIFFS, fetchTariffs } from "../../lib/tariffs";
import { Caption, Card, Heading, Loading, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Ganancias del conductor — MISMA fórmula que la web (driver/earnings):
 * parte del conductor = (final_price || estimated_price) × (100 − comisión)%.
 * La comisión es editable por el admin en Ajustes (tariffs.commission_pct).
 *
 * Gráfico de 7 días en SVG puro: recharts no existe en React Native y para
 * siete barras no hace falta ninguna librería de gráficos.
 */
export default function Ganancias() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [tariffs, setTariffs] = useState(DEFAULT_TARIFFS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, t] = await Promise.all([
      supabase
        .from("transport_requests")
        .select("id, final_price, estimated_price, created_date")
        .eq("driver_id", user.id)
        .eq("status", "delivered")
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

  if (jobs === null) return <Loading label="Calculando tus ganancias…" />;

  const commissionPct = tariffs.commission_pct ?? 15;
  const share = (100 - commissionPct) / 100;
  const amountOf = j => (j.final_price || j.estimated_price || 0) * share;

  const total = jobs.reduce((acc, j) => acc + amountOf(j), 0);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());
  const week = jobs.filter(j => j.created_date && isAfter(new Date(j.created_date), weekStart));
  const month = jobs.filter(j => j.created_date && isAfter(new Date(j.created_date), monthStart));

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = format(date, "yyyy-MM-dd");
    const amount = jobs
      .filter(j => j.created_date && format(new Date(j.created_date), "yyyy-MM-dd") === key)
      .reduce((acc, j) => acc + amountOf(j), 0);
    days.push({ label: format(date, "EEE", { locale: es }), amount: Math.round(amount) });
  }
  const max = Math.max(...days.map(d => d.amount), 1);

  const CHART_H = 150;
  const BAR_W = 34;
  const GAP = 12;
  const chartWidth = days.length * (BAR_W + GAP);

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
        <Heading>Mis ganancias</Heading>

        <View style={styles.grid}>
          <Card style={styles.stat}>
            <Caption>Total</Caption>
            <Text style={styles.statValue}>{total.toFixed(0)} €</Text>
          </Card>
          <Card style={styles.stat}>
            <Caption>Este mes</Caption>
            <Text style={styles.statValue}>
              {month.reduce((a, j) => a + amountOf(j), 0).toFixed(0)} €
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Caption>Esta semana</Caption>
            <Text style={styles.statValue}>
              {week.reduce((a, j) => a + amountOf(j), 0).toFixed(0)} €
            </Text>
          </Card>
          <Card style={styles.stat}>
            <Caption>Servicios</Caption>
            <Text style={styles.statValue}>{jobs.length}</Text>
          </Card>
        </View>

        <Card>
          <Title>Últimos 7 días</Title>
          <View style={{ alignItems: "center" }}>
            <Svg width={chartWidth} height={CHART_H + 40}>
              {days.map((d, i) => {
                const h = Math.max((d.amount / max) * CHART_H, d.amount > 0 ? 6 : 2);
                const x = i * (BAR_W + GAP);
                return (
                  <G key={d.label + i}>
                    <Rect
                      x={x}
                      y={CHART_H - h}
                      width={BAR_W}
                      height={h}
                      rx={6}
                      fill={d.amount > 0 ? colors.primary : colors.border}
                    />
                    <SvgText x={x + BAR_W / 2} y={CHART_H - h - 6} fontSize="11" fill={colors.mutedForeground} textAnchor="middle">
                      {d.amount > 0 ? `${d.amount}€` : ""}
                    </SvgText>
                    <SvgText x={x + BAR_W / 2} y={CHART_H + 16} fontSize="11" fill={colors.mutedForeground} textAnchor="middle">
                      {d.label}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>
          </View>
        </Card>

        <Card style={{ backgroundColor: "#EFF6FF", borderColor: colors.primary }}>
          <Caption>
            💡 Recibes el <Caption style={{ fontWeight: "700", color: colors.foreground }}>{100 - commissionPct}%</Caption> de
            cada servicio. La comisión de plataforma es del {commissionPct}%.
          </Caption>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { flexBasis: "47%", flexGrow: 1 },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.foreground },
});
