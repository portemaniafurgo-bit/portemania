import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { serviceOf } from "../../lib/services";
import { euro } from "../../lib/money";
import { downloadReceipt } from "../../lib/receipt";
import { Caption, Card, Heading, Loading, Overline, Screen, Title } from "../../components/ui";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../theme";

/**
 * Las facturas del conductor: las que ÉL ha emitido, agrupadas por mes.
 *
 * El cliente ya podía descargar la suya; el conductor no tenía forma de ver las
 * suyas, y es quien las necesita para el trimestre. Mismo PDF, misma
 * numeración: no se genera nada nuevo, se enseña lo que ya existe.
 */
export default function MisFacturas() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // Últimos 12 meses: para lo de más atrás está la gestoría, no la app.
    const since = startOfMonth(subMonths(new Date(), 11)).toISOString();
    const { data } = await supabase
      .from("transport_requests")
      .select("*")
      .eq("driver_id", user.id)
      .eq("status", "delivered")
      .gte("created_date", since)
      .order("delivery_time", { ascending: false });
    setJobs(data || []);
  }, [user?.id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (jobs === null) return <Loading label="Cargando tus facturas…" />;

  // Agrupadas por mes, que es como se declaran.
  const months = [];
  for (const job of jobs) {
    const date = new Date(job.delivery_time || job.created_date);
    const key = format(date, "yyyy-MM");
    let group = months.find(m => m.key === key);
    if (!group) {
      group = { key, label: format(date, "MMMM 'de' yyyy", { locale: es }), jobs: [], total: 0 };
      months.push(group);
    }
    group.jobs.push(job);
    group.total += Number(job.final_price || job.estimated_price || 0);
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Mis facturas" }} />
      <Heading>Mis facturas</Heading>
      <Caption>
        Las emites tú como autónomo. Cada una lleva tu NIF y su número correlativo; el cliente
        recibe exactamente este mismo documento.
      </Caption>

      {error ? <Caption style={{ color: colors.destructive }}>{error}</Caption> : null}

      {jobs.length === 0 ? (
        <EmptyState
          title="Todavía no has emitido facturas"
          hint="En cuanto termines un servicio aparecerá aquí, lista para descargar."
        />
      ) : (
        months.map(month => (
          <View key={month.key} style={{ gap: spacing.sm }}>
            <View style={styles.monthHeader}>
              <Overline>{month.label.toUpperCase()}</Overline>
              <Caption>
                {month.jobs.length} · {euro(month.total, 2)}
              </Caption>
            </View>

            <Card style={{ gap: 0 }}>
              {month.jobs.map((job, i) => {
                const service = serviceOf(job);
                const date = new Date(job.delivery_time || job.created_date);
                return (
                  <View key={job.id}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <Pressable
                      style={styles.row}
                      disabled={downloading === job.id}
                      onPress={async () => {
                        setDownloading(job.id);
                        setError("");
                        try {
                          await downloadReceipt(job, service);
                        } catch {
                          setError("No se pudo generar el PDF. Inténtalo de nuevo.");
                        } finally {
                          setDownloading(null);
                        }
                      }}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Title>{job.invoice_number || "Sin numerar todavía"}</Title>
                        <Caption>
                          {format(date, "d MMM", { locale: es })} · {service?.label || "Servicio"} ·{" "}
                          {job.client_name || "Cliente"}
                        </Caption>
                      </View>
                      <Text style={styles.amount}>
                        {euro(job.final_price || job.estimated_price || 0, 2)}
                      </Text>
                      <Ionicons
                        name={downloading === job.id ? "hourglass-outline" : "download-outline"}
                        size={19}
                        color={colors.primary}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}

      <Caption>
        El número se asigna la primera vez que se descarga la factura y ya no cambia nunca: una
        factura renumerada no vale.
      </Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: colors.hairline },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 14 },
  amount: { fontSize: 15, fontFamily: "Poppins_700Bold", color: colors.foreground },
});
