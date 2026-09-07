import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import { uniqueChannel } from "../lib/orders";
import { Body, Caption, Card, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Las incidencias que el cliente reportó sobre este pedido, CON la respuesta
 * de ClicyVoy. Antes el admin resolvía desde el panel y el cliente no se
 * enteraba de nada (petición de Renato, 01/09/2026). La RLS solo devuelve las
 * suyas.
 */
const TYPE_LABELS = {
  damage: "Daño en la mercancía",
  delay: "Retraso",
  lost_item: "Objeto perdido",
  payment: "Problema con el pago",
  behavior: "Comportamiento",
  other: "Otro",
};

const STATUS_LABELS = {
  open: "Recibida",
  in_progress: "En estudio",
  resolved: "Resuelta",
  closed: "Cerrada",
};

export default function IncidentList({ orderId }) {
  const [incidents, setIncidents] = useState([]);

  const load = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from("incidents")
      .select("id, type, status, description, resolution, created_date, updated_date")
      .eq("request_id", orderId)
      .order("created_date", { ascending: false });
    setIncidents(data || []);
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // La respuesta del admin llega en vivo, sin tener que salir y volver.
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(uniqueChannel(`incidents-${orderId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents", filter: `request_id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, load]);

  if (!incidents.length) return null;

  return (
    <Card>
      <Title>Tus incidencias</Title>
      {incidents.map(inc => {
        const answered = !!inc.resolution;
        return (
          <View key={inc.id} style={styles.item}>
            <View style={styles.row}>
              <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>
                {TYPE_LABELS[inc.type] || inc.type}
              </Caption>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: answered ? colors.successBg : colors.warningBg },
                ]}
              >
                <Text style={[styles.badgeText, { color: answered ? colors.success : "#B27700" }]}>
                  {STATUS_LABELS[inc.status] || inc.status}
                </Text>
              </View>
            </View>
            <Caption>
              {format(new Date(inc.created_date), "d MMM, HH:mm", { locale: es })}
            </Caption>
            <Body>{inc.description}</Body>
            {answered ? (
              <View style={styles.answer}>
                <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.primary }}>
                  Respuesta de ClicyVoy
                </Caption>
                <Body>{inc.resolution}</Body>
              </View>
            ) : (
              <Caption>Pendiente de respuesta. Te avisaremos en cuanto la haya.</Caption>
            )}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontFamily: "DMSans_700Bold" },
  answer: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
    marginTop: 4,
  },
});
