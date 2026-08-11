// Edge Function: create-tip-intent
// Propina al conductor tras un servicio entregado (propuesta comercial, §2.2
// "Post-servicio"). Cargo Stripe APARTE del servicio: el 100% es para el
// conductor y en las liquidaciones no debe mezclarse con la tarifa.
//
// Mismo patrón de seguridad que create-payment-intent: el cliente solo dice
// CUÁNTO quiere dar (dentro de un rango sensato); a quién y por qué pedido lo
// decide el servidor mirando la BD.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MIN_TIP_EUR = 0.5;
const MAX_TIP_EUR = 20;

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

  let body: { order_id?: string; amount_eur?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.order_id) return json({ error: "order_id requerido" }, 400);

  const amountEur = Number(body.amount_eur);
  if (!Number.isFinite(amountEur) || amountEur < MIN_TIP_EUR || amountEur > MAX_TIP_EUR) {
    return json({ error: `La propina debe estar entre ${MIN_TIP_EUR} y ${MAX_TIP_EUR} €` }, 400);
  }

  const { data: order } = await admin
    .from("transport_requests")
    .select("id, status, created_by_id, driver_id, driver_name, tip_amount")
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);
  if (order.status !== "delivered") return json({ error: "El servicio aún no ha terminado" }, 400);
  if (!order.driver_id) return json({ error: "El pedido no tiene conductor" }, 400);
  if (order.tip_amount) return json({ error: "Ya diste propina en este pedido" }, 400);

  const amount = Math.round(amountEur * 100);
  const params = new URLSearchParams({
    amount: String(amount),
    currency: "eur",
    "automatic_payment_methods[enabled]": "true",
    "automatic_payment_methods[allow_redirects]": "never",
    "metadata[order_id]": order.id,
    "metadata[kind]": "tip",
    description: `ClicyVoy propina · ${order.driver_name || "conductor"} · pedido ${String(order.id).slice(0, 8)}`,
  });
  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Un solo intento de propina por pedido: reintentos no duplican cargos.
      "Idempotency-Key": `tip_${order.id}`,
    },
    body: params,
  });
  const intent = await res.json();
  if (!res.ok) {
    console.error("stripe error:", intent?.error?.message);
    return json({ error: intent?.error?.message || "Error de Stripe" }, 502);
  }

  return json({ client_secret: intent.client_secret, amount });
});
