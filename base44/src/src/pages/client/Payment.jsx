import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, Shield, Loader2, CheckCircle, CreditCard } from "lucide-react";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
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

    // Create payment method
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
      billing_details: {
        name: order.client_name || "Cliente",
      },
    });

    if (pmError) {
      setError(pmError.message);
      setLoading(false);
      return;
    }

    // Mark as paid in our DB (in production, confirm server-side with PaymentIntent)
    await base44.entities.TransportRequest.update(order.id, {
      payment_status: "paid",
      stripe_session_id: paymentMethod.id,
    });

    onSuccess();
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

function NoStripeForm({ order, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    await base44.entities.TransportRequest.update(order.id, {
      payment_status: "paid",
    });
    setTimeout(onSuccess, 500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">⚠️ Modo de prueba</p>
        <p>Para activar el pago real, configura tu clave pública de Stripe en las variables de entorno (<code>VITE_STRIPE_PUBLIC_KEY</code>).</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Simular tarjeta de prueba</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Número</p>
            <p className="font-mono bg-muted rounded px-2 py-1">4242 4242 4242 4242</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Caducidad / CVC</p>
            <p className="font-mono bg-muted rounded px-2 py-1">12/34 / 123</p>
          </div>
        </div>
      </div>

      <Button
        className="w-full h-12 rounded-xl text-base font-semibold"
        disabled={loading}
        onClick={handleSimulate}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Simular pago de {(order.estimated_price || 0).toFixed(2)}€
      </Button>
    </div>
  );
}

export default function Payment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => base44.entities.TransportRequest.filter({ id }),
    select: (data) => data?.[0],
  });

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => navigate("/my-orders"), 2500);
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
      <div className="text-center py-20">
        <p className="text-muted-foreground">Pedido no encontrado</p>
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
        <button onClick={() => navigate(-1)}>
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
        <NoStripeForm order={order} onSuccess={handleSuccess} />
      )}
    </div>
  );
}