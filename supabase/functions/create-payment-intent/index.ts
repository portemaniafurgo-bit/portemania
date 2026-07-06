// Edge Function: create-payment-intent
// Crea el cargo real en Stripe (PaymentIntent) para un pedido del usuario
// autenticado. El cliente lo confirma con stripe.confirmCardPayment.
// El IMPORTE se recalcula en el servidor desde las tarifas (app_settings) —
// nunca se confía en el estimated_price que manda el cliente.
// Requiere el secreto STRIPE_SECRET_KEY; si no está, devuelve not_configured.
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

const DEFAULT_TARIFFS = {
  small: 40, large: 60, extra_hour: 15, insurance: 12, help_price: 30, commission_pct: 15,
};

// Misma fórmula que src/lib/tariffs.js estimatePrice (mantener en sincronía).
function computePrice(t: Record<string, number>, order: Record<string, unknown>): number {
  const vt = order.vehicle_type === "large" ? "large" : "small";
  const base = Number(t[vt] ?? DEFAULT_TARIFFS[vt]);
  const extraHours = Number(order.extra_hours) || 0;
  const insurance = order.insurance_selected ? Number(t.insurance ?? DEFAULT_TARIFFS.insurance) : 0;
  const help = order.needs_help ? Number(t.help_price ?? DEFAULT_TARIFFS.help_price) : 0;
  return base + extraHours * Number(t.extra_hour ?? DEFAULT_TARIFFS.extra_hour) + insurance + help;
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

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.order_id) return json({ error: "order_id requerido" }, 400);

  const { data: order } = await admin
    .from("transport_requests")
    .select("id, created_by_id, payment_status, client_name, vehicle_type, extra_hours, insurance_selected, needs_help")
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);
  if (order.payment_status === "paid") return json({ error: "Ya está pagado" }, 400);

  // Importe recalculado en servidor desde las tarifas vigentes (no el del cliente).
  const { data: settings } = await admin
    .from("app_settings").select("value").eq("key", "tariffs").maybeSingle();
  const tariffs = { ...DEFAULT_TARIFFS, ...((settings?.value as Record<string, number>) || {}) };
  const price = computePrice(tariffs, order);
  const amount = Math.round(price * 100);
  if (!Number.isFinite(amount) || amount < 50) return json({ error: "Importe no válido" }, 400);

  const params = new URLSearchParams({
    amount: String(amount),
    currency: "eur",
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
      // Idempotencia por pedido: reintentos no crean cargos duplicados.
      "Idempotency-Key": `order_${order.id}`,
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
