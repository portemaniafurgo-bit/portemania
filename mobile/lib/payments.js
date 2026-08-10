import { supabase } from "./supabase";

/**
 * Pago con tarjeta desde la app, contra las MISMAS Edge Functions que la web:
 *
 *   create-payment-intent → crea el cargo con la clave secreta y RECALCULA el
 *                           importe desde las tarifas (el móvil no dice cuánto
 *                           se cobra; probado en su día: enviar 1 € cobraba 90).
 *   confirm-payment       → verifica el cargo real en Stripe y solo entonces
 *                           marca el pedido como pagado. La RLS no deja que lo
 *                           escriba el cliente.
 *
 * La única diferencia con la web es la interfaz: aquí se usa PaymentSheet, que
 * trae Google Pay y el 3DS nativo.
 */

// Clave PUBLICABLE (de prueba, igual que la web hoy): es pública por diseño.
// Al lanzar, cambiar a la pk_live a la vez que la web.
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLIC_KEY ||
  "pk_test_51ToqiV0CdR56sVIhFufXDcekZbDuW8xrQXuvqtzep1EC7KJE2bfyLhqBqGxd4WtB2BayPc4bvjuAYHF3RL4cH5uW001A0gC2qo";

export const STRIPE_MERCHANT_ID = "merchant.com.clicyvoy.app";

/** Pide al servidor el intento de pago. Devuelve { clientSecret } o { error }. */
export async function createPaymentIntent(orderId) {
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { order_id: orderId },
  });

  if (error || !data || data.error) {
    if (data?.error === "not_configured") {
      return {
        error:
          "El pago con tarjeta no está disponible ahora mismo. Elige pago en efectivo o inténtalo más tarde.",
      };
    }
    return { error: data?.error || "No se pudo iniciar el pago. Inténtalo de nuevo." };
  }
  if (!data.client_secret) return { error: "No se pudo iniciar el pago. Inténtalo de nuevo." };

  return { clientSecret: data.client_secret };
}

/**
 * Registra el cobro. Si esto falla el dinero YA se ha cobrado, así que el
 * mensaje tiene que decírselo al cliente en vez de invitarle a pagar otra vez.
 */
export async function confirmPayment(orderId, paymentIntentId) {
  const { data, error } = await supabase.functions.invoke("confirm-payment", {
    body: { order_id: orderId, payment_intent_id: paymentIntentId },
  });
  if (error || data?.error) {
    return {
      error:
        "El cobro se realizó pero no se pudo registrar. Contacta con ClicyVoy indicando tu pedido.",
    };
  }
  return { ok: true };
}
