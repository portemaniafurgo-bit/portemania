"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/entities";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, Shield, Loader2, CheckCircle, CreditCard } from "lucide-react";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY)
  : null;

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1a1a2e",
      "::placeholder": { color: "#94a3b8" },
      fontFamily: "Inter, sans-serif",
    },
    invalid: { color: "#ef4444" },
  },
};

function CheckoutForm({ order, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      // Cargo real: PaymentIntent creado en el servidor (Edge Function con la
      // clave secreta, que recalcula el importe desde las tarifas). NUNCA se
      // marca un pedido como pagado sin un cobro real de Stripe.
      const { data, error: fnError } = await supabase.functions.invoke("create-payment-intent", {
        body: { order_id: order.id },
      });

      if (fnError || !data || data.error) {
        const code = data?.error;
        if (code === "not_configured") {
          throw new Error("El pago con tarjeta no está disponible ahora mismo. Elige pago en efectivo o inténtalo más tarde.");
        }
        throw new Error(code || "No se pudo iniciar el pago. Inténtalo de nuevo.");
      }
      if (!data.client_secret) throw new Error("No se pudo iniciar el pago. Inténtalo de nuevo.");

      const { error: payError, paymentIntent } = await stripe.confirmCardPayment(data.client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: order.client_name || "Cliente" },
        },
      });
      if (payError) throw new Error(payError.message);
      if (paymentIntent?.status !== "succeeded") throw new Error("El pago no se completó");
      // El pedido lo marca como pagado el SERVIDOR tras verificar el cargo en
      // Stripe (la RLS ya no deja al navegador escribir payment_status).
      const { data: confirm, error: confirmError } = await supabase.functions.invoke("confirm-payment", {
        body: { order_id: order.id, payment_intent_id: paymentIntent.id },
      });
      if (confirmError || confirm?.error) {
        throw new Error("El cobro se realizó pero no se pudo registrar. Contacta con ClicyVoy indicando tu pedido.");
      }
      onSuccess();
    } catch (err) {
      setError(err.message || "Error al procesar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Datos de tarjeta</span>
        </div>
        <div className="p-3 rounded-xl border border-input bg-background">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5 text-emerald-500" />
        <span>Pago 100% seguro con Stripe. Tus datos están encriptados.</span>
      </div>

      <Button
        type="submit"
        className="w-full h-12 rounded-xl text-base font-semibold"
        disabled={!stripe || loading}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        Pagar {(order.estimated_price || 0).toFixed(2)}€
      </Button>
    </form>
  );
}

function NoStripeForm() {
  // Sin clave pública de Stripe no se puede cobrar con tarjeta. NUNCA se marca
  // el pedido como pagado sin cobro: se ofrece el pago en efectivo al conductor.
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Pago con tarjeta no disponible</p>
        <p>Ahora mismo no podemos procesar el pago con tarjeta. Puedes pagar en efectivo directamente al conductor al recibir el servicio.</p>
      </div>
      <Button
        className="w-full h-12 rounded-xl text-base font-semibold"
        onClick={() => router.push("/my-orders")}
      >
        Volver a mis pedidos
      </Button>
    </div>
  );
}

export default function Payment() {
  const { id } = useParams();
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => base44.entities.TransportRequest.filter({ id }),
    select: (data) => data?.[0],
  });

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => router.push("/my-orders"), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Pedido no encontrado</p>
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/my-orders")}>
          Ver mis pedidos
        </Button>
      </div>
    );
  }

  // Ya pagado: no se puede volver a pagar (evita re-cobros al volver atrás).
  if (order.payment_status === "paid") {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">Este pedido ya está pagado</h2>
        <p className="text-muted-foreground">No es necesario volver a pagar.</p>
        <Button className="rounded-xl" onClick={() => router.push("/my-orders")}>
          Ver mis pedidos
        </Button>
      </div>
    );
  }

  // Pedido cancelado: no tiene sentido cobrarlo (la Edge Function también lo
  // rechaza en servidor; esto es solo la pantalla amable).
  if (order.status === "cancelled") {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <h2 className="text-2xl font-display font-bold text-foreground">Pedido cancelado</h2>
        <p className="text-muted-foreground">Este pedido está cancelado y no requiere pago.</p>
        <Button className="rounded-xl" onClick={() => router.push("/my-orders")}>
          Ver mis pedidos
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">¡Pago completado!</h2>
        <p className="text-muted-foreground">Tu pedido ha sido confirmado. Te redirigimos a tus pedidos...</p>
      </div>
    );
  }

  const vehicle = vehicleData[order.vehicle_type];

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Pago con tarjeta</h1>
          <p className="text-sm text-muted-foreground">Completa tu reserva</p>
        </div>
      </div>

      {/* Order summary */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resumen del pedido</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{vehicle?.icon}</span>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{vehicle?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{order.origin_address} → {order.destination_address}</p>
          </div>
          <p className="text-xl font-display font-bold text-foreground">{(order.estimated_price || 0).toFixed(2)}€</p>
        </div>
        {order.insurance_selected && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Seguro de mercancía incluido</span>
          </div>
        )}
      </div>

      {/* Payment form */}
      {stripePromise ? (
        <Elements stripe={stripePromise}>
          <CheckoutForm order={order} onSuccess={handleSuccess} />
        </Elements>
      ) : (
        <NoStripeForm />
      )}
    </div>
  );
}
