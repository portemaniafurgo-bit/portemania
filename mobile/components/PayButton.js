import { useState } from "react";
import { useStripe } from "@stripe/stripe-react-native";
import { confirmPayment, createPaymentIntent } from "../lib/payments";
import { Body, Button, Caption, Card, ErrorText } from "./ui";
import { colors } from "../theme";

/**
 * Pago con tarjeta usando PaymentSheet: trae Google Pay, tarjetas guardadas y
 * 3DS nativo sin construir un formulario propio.
 *
 * El orden importa: primero se cobra, después se registra. Nunca al revés — la
 * web tenía un camino que marcaba el pedido como pagado sin cobro real y se
 * eliminó por eso.
 */
export default function PayButton({ order, onPaid }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  const pay = async () => {
    setLoading(true);
    setError("");
    try {
      const intent = await createPaymentIntent(order.id);
      if (intent.error) {
        setError(intent.error);
        return;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "ClicyVoy",
        paymentIntentClientSecret: intent.clientSecret,
        googlePay: { merchantCountryCode: "ES", currencyCode: "EUR", testEnv: true },
        defaultBillingDetails: { name: order.client_name || "Cliente" },
      });
      if (initError) {
        setError("No se pudo abrir el pago: " + initError.message);
        return;
      }

      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        // Cancelar no es un fallo: no hay nada que explicar.
        if (sheetError.code !== "Canceled") setError(sheetError.message);
        return;
      }

      // PaymentSheet confirma el cobro; el id del intent va dentro del
      // client_secret, cuya primera parte ES el id.
      const paymentIntentId = intent.clientSecret.split("_secret")[0];
      const registered = await confirmPayment(order.id, paymentIntentId);
      if (registered.error) {
        setError(registered.error);
        return;
      }

      setPaid(true);
      onPaid?.();
    } catch (err) {
      setError("Error al procesar el pago: " + (err.message || "inténtalo de nuevo"));
    } finally {
      setLoading(false);
    }
  };

  if (paid || order.payment_status === "paid") {
    return (
      <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
        <Body>Pedido pagado. Gracias.</Body>
      </Card>
    );
  }

  return (
    <Card>
      <Body>Pago con tarjeta</Body>
      <Caption>
        {order.estimated_price != null ? `${order.estimated_price} €` : ""} · tarjeta o Google Pay
      </Caption>
      <ErrorText>{error}</ErrorText>
      <Button title="Pagar ahora" onPress={pay} loading={loading} />
    </Card>
  );
}
