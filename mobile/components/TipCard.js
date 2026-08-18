import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { euro } from "../lib/money";
import { Body, Button, Caption, Card, ErrorText, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Propina al conductor tras la entrega (canvas 2h): tres importes en fila,
 * «100 % para el conductor» y el total con propina antes de pagar.
 *
 * Cargo Stripe APARTE del servicio. El importe elegido aquí solo es una
 * petición: el servidor lo valida (0,50–20 €), crea el cargo y `confirm-tip`
 * verifica en Stripe que se pagó de verdad antes de anotarlo. Un solo intento
 * por pedido (idempotencia).
 */
const OPTIONS = [1, 2, 5];

export default function TipCard({ order, driverName }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (order.tip_amount || done) {
    return (
      <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Ionicons name="heart" size={20} color={colors.success} />
          <Body style={{ flex: 1 }}>
            Gracias — tu propina {order.tip_amount ? `de ${euro(Number(order.tip_amount), 2)} ` : ""}
            llega íntegra a {driverName || "tu conductor"}.
          </Body>
        </View>
      </Card>
    );
  }

  const servicePrice = Number(order.final_price ?? order.estimated_price ?? 0);

  const tip = async () => {
    if (!amount) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-tip-intent", {
        body: { order_id: order.id, amount_eur: amount },
      });
      if (fnError || !data || data.error || !data.client_secret) {
        setError(data?.error || "La propina no está disponible ahora mismo.");
        return;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "ClicyVoy",
        paymentIntentClientSecret: data.client_secret,
        googlePay: { merchantCountryCode: "ES", currencyCode: "EUR", testEnv: true },
      });
      if (initError) {
        setError("No se pudo abrir el pago: " + initError.message);
        return;
      }

      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        if (sheetError.code !== "Canceled") setError(sheetError.message);
        return;
      }

      const intentId = data.client_secret.split("_secret")[0];
      const { data: confirm } = await supabase.functions.invoke("confirm-tip", {
        body: { order_id: order.id, payment_intent_id: intentId },
      });
      if (confirm?.error) {
        setError(confirm.error);
        return;
      }
      setDone(true);
    } catch (err) {
      setError("No se pudo procesar la propina: " + (err.message || "inténtalo de nuevo"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>Dejar propina</Title>
          <Caption>100 % para el conductor</Caption>
        </View>
      </View>

      <View style={styles.row}>
        {OPTIONS.map(value => {
          const active = amount === value;
          return (
            <Pressable
              key={value}
              onPress={() => setAmount(active ? null : value)}
              style={[styles.tip, active && styles.tipOn]}
            >
              <Text style={[styles.tipText, active && { color: colors.primary }]}>{euro(value)}</Text>
            </Pressable>
          );
        })}
      </View>

      {servicePrice > 0 ? (
        <View style={styles.totalRow}>
          <Caption>Total con propina</Caption>
          <Text style={styles.total}>{euro(servicePrice + (amount || 0), 2)}</Text>
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button
        title={amount ? `Dar ${euro(amount)} de propina` : "Elige un importe"}
        onPress={tip}
        loading={loading}
        disabled={!amount}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  // Canvas 2h: 52 de alto, radio 16 y borde de 1,5.
  tip: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tipText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: colors.mutedForeground },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  total: { fontSize: 17, fontFamily: "Poppins_700Bold", color: colors.foreground },
});
