import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "../lib/supabase";
import { Body, Button, Caption, Card, ErrorText, Title } from "./ui";
import { colors, spacing } from "../theme";

/**
 * Propina al conductor tras la entrega. Cargo Stripe APARTE del servicio,
 * 100 % para el conductor (propuesta §2.2 «Post-servicio»).
 *
 * El importe elegido aquí solo es una petición: el servidor lo valida
 * (0,50–20 €), crea el cargo y `confirm-tip` verifica en Stripe que se pagó de
 * verdad antes de anotarlo. Un solo intento por pedido (idempotencia).
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
        <Body>
          Gracias — tu propina {order.tip_amount ? `de ${order.tip_amount} €` : ""} llega íntegra a{" "}
          {driverName || "tu conductor"}. 💛
        </Body>
      </Card>
    );
  }

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
      <Title>¿Le dejas propina a {driverName || "tu conductor"}?</Title>
      <Caption>Va íntegra para él. Se cobra a tu tarjeta, aparte del servicio.</Caption>
      <View style={styles.row}>
        {OPTIONS.map(value => (
          <Button
            key={value}
            title={`${value} €`}
            variant={amount === value ? "primary" : "plain"}
            onPress={() => setAmount(value)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Dar propina" onPress={tip} loading={loading} disabled={!amount} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
});
