// Edge Function: create-payment-intent
// Crea el cargo real en Stripe (PaymentIntent) para un pedido del usuario
// autenticado. El cliente lo confirma con stripe.confirmCardPayment.
// Requiere el secreto STRIPE_SECRET_KEY; si no está configurado devuelve
// not_configured y la app cae al modo simulado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "not_configured" }, 200);

  // Usuario autenticado (verify_jwt exige token válido; comprobamos identidad)
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return json({ error: "No autenticado" }, 401);

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.order_id) return json({ error: "order_id requerido" }, 400);

  // El pedido debe ser del usuario, estar sin pagar y tener importe válido.
  const { data: order } = await admin
    .from("transport_requests")
    .select("id, created_by_id, estimated_price, payment_status, client_name")
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);
  if (order.payment_status === "paid") return json({ error: "Ya está pagado" }, 400);
  const amount = Math.round(Number(order.estimated_price) * 100);
  if (!Number.isFinite(amount) || amount < 50) return json({ error: "Importe no válido" }, 400);

  // PaymentIntent vía API REST de Stripe (form-encoded)
  const params = new URLSearchParams({
    amount: String(amount),
    currency: "eur",
    // Solo tarjeta, sin métodos con redirección: confirmCardPayment no necesita return_url
    "automatic_payment_methods[enabled]": "true",
    "automatic_payment_methods[allow_redirects]": "never",
    "metadata[order_id]": order.id,
    "metadata[client_name]": order.client_name || "",
    description: `ClicyVoy pedido ${String(order.id).slice(0, 8)}`,
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const intent = await res.json();
  if (!res.ok) {
    console.error("stripe error:", intent?.error?.message);
    return json({ error: intent?.error?.message || "Error de Stripe" }, 502);
  }

  return json({ client_secret: intent.client_secret, intent_id: intent.id, amount });
});
