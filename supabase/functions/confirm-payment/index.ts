// Edge Function: confirm-payment
// Marca un pedido como pagado SOLO tras verificar el cargo en Stripe con la
// clave secreta. Antes era el navegador quien escribía payment_status='paid'
// tras confirmCardPayment — y la RLS permitía a cualquier cliente marcar su
// pedido como pagado sin pagar. Ahora la escritura la hace el service role
// aquí (y la migración 0007 bloquea el cambio de payment_status a no-staff).
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return json({ error: "No autenticado" }, 401);

  let body: { order_id?: string; payment_intent_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.order_id || !body.payment_intent_id) {
    return json({ error: "order_id y payment_intent_id requeridos" }, 400);
  }

  const { data: order } = await admin
    .from("transport_requests")
    .select("id, created_by_id, payment_status")
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);
  if (order.payment_status === "paid") return json({ ok: true, already_paid: true });

  // Verificación REAL contra Stripe: el intent debe existir, estar cobrado y
  // pertenecer a ESTE pedido (metadata.order_id se fijó al crearlo en servidor).
  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(body.payment_intent_id)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const intent = await res.json();
  if (!res.ok) {
    console.error("stripe error:", intent?.error?.message);
    return json({ error: "No se pudo verificar el pago" }, 502);
  }
  if (intent.status !== "succeeded") return json({ error: "El pago no está completado" }, 400);
  if (intent.metadata?.order_id !== order.id) return json({ error: "El pago no corresponde a este pedido" }, 400);

  const { error: upError } = await admin
    .from("transport_requests")
    .update({ payment_status: "paid", stripe_session_id: intent.id })
    .eq("id", order.id);
  if (upError) return json({ error: upError.message }, 500);

  return json({ ok: true, amount: intent.amount });
});
