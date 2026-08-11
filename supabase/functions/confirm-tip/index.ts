// Edge Function: confirm-tip
// Registra la propina SOLO tras verificar en Stripe que el cargo existe, está
// pagado y corresponde a este pedido — espejo exacto de confirm-payment: el
// móvil nunca escribe importes, y un client_secret inventado no cuela.
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
    return json({ error: "order_id y payment_intent_id son obligatorios" }, 400);
  }

  const { data: order } = await admin
    .from("transport_requests")
    .select("id, created_by_id, driver_id")
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);

  // El cargo REAL, contado por Stripe — no por el móvil.
  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(body.payment_intent_id)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const intent = await res.json();
  if (!res.ok) return json({ error: "No se pudo verificar el cargo" }, 502);

  if (
    intent.status !== "succeeded" ||
    intent.metadata?.order_id !== order.id ||
    intent.metadata?.kind !== "tip"
  ) {
    return json({ error: "El cargo no corresponde a una propina de este pedido" }, 400);
  }

  const tipEur = intent.amount_received / 100;
  const { error: updateError } = await admin
    .from("transport_requests")
    .update({ tip_amount: tipEur })
    .eq("id", order.id);
  if (updateError) return json({ error: "Cobrada pero no registrada; contacta con ClicyVoy" }, 500);

  return json({ ok: true, tip_amount: tipEur });
});
