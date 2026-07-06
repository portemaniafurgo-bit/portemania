// Edge Function: send-email
// Dos modos:
//  1) mode:"new_request" (público) — aviso de PEDIDO NUEVO. El servidor resuelve
//     destinatarios (admins + conductores verificados compatibles con el tamaño)
//     y redacta el contenido. Seguro: ni destinatario ni texto los pone el cliente.
//  2) { to, subject, body } (legacy) — contenido libre. Como puede llamarse sin
//     sesión (candidatura de conductor), la protección es una LISTA BLANCA de
//     destinatarios: solo emails de administración y conductores verificados.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_RECIPIENTS = [
  "renato.0550.calero@gmail.com",
  "renatocaleromartinez407@gmail.com",
  "portemaniafurgo@gmail.com",
];

// Dominio clicyvoy.es verificado en Resend: se envía desde él, lo que permite
// entregar también a conductores (no solo al correo del negocio).
const FROM = "ClicyVoy <noreply@clicyvoy.es>";

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

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function sendOne(apiKey: string, to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  const result = await res.json().catch(() => ({}));
  return { ok: res.ok, to, message: result?.message, id: result?.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY no configurada" }, 500);

  let body: { mode?: string; order_id?: string; to?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ---------- Modo 1: aviso de pedido nuevo (contenido y destinatarios en servidor) ----------
  if (body.mode === "new_request") {
    if (!body.order_id) return json({ error: "order_id requerido" }, 400);
    const admin = serviceClient();
    const { data: order } = await admin
      .from("transport_requests")
      .select("id, client_name, client_phone, origin_address, destination_address, vehicle_type, estimated_price, needs_help")
      .eq("id", body.order_id)
      .single();
    if (!order) return json({ error: "Pedido no encontrado" }, 404);

    // Conductores verificados compatibles: los pedidos de furgón grande solo a
    // conductores con furgón grande; los pequeños, a todos los verificados.
    let q = admin.from("driver_profiles").select("email, vehicle_type").eq("status", "verified");
    const { data: drivers } = await q;
    const driverEmails = (drivers || [])
      .filter((d) => d.email && (order.vehicle_type !== "large" || d.vehicle_type === "large"))
      .map((d) => d.email.toLowerCase());

    const recipients = Array.from(new Set([...ADMIN_RECIPIENTS, ...driverEmails]));
    const size = order.vehicle_type === "large" ? "Furgoneta grande" : "Furgoneta pequeña";
    const subject = `🚚 Nuevo pedido — ${size}`;
    const text = [
      `Nuevo pedido en ClicyVoy:`,
      ``,
      `Vehículo: ${size}${order.needs_help ? " · con ayuda de carga" : ""}`,
      `Origen: ${order.origin_address || "—"}`,
      `Destino: ${order.destination_address || "—"}`,
      order.estimated_price != null ? `Precio estimado: ${order.estimated_price}€` : ``,
      ``,
      `Entra en la app para aceptarlo: https://clicyvoy.es/driver/requests`,
    ].filter(Boolean).join("\n");

    const results = await Promise.all(recipients.map((to) => sendOne(apiKey, to, subject, text)));
    const sent = results.filter((r) => r.ok).length;
    return json({ sent, total: recipients.length });
  }

  // ---------- Modo 2: contenido libre con lista blanca de destinatarios ----------
  const to = (body.to || "").trim().toLowerCase();
  const subject = (body.subject || "").slice(0, 200);
  const text = (body.body || "").slice(0, 5000);
  if (!to || !subject || !text) return json({ error: "to, subject y body son obligatorios" }, 400);

  let allowed = ADMIN_RECIPIENTS.includes(to);
  if (!allowed) {
    const admin = serviceClient();
    const { data } = await admin
      .from("driver_profiles")
      .select("id")
      .eq("status", "verified")
      .ilike("email", to)
      .limit(1);
    allowed = !!data?.length;
  }
  if (!allowed) return json({ error: "Destinatario no permitido" }, 403);

  const r = await sendOne(apiKey, to, subject, text);
  if (!r.ok) {
    console.warn("send-email fallo de entrega:", to, r.message);
    return json({ sent: false, error: r.message || "Fallo al enviar" });
  }
  return json({ sent: true, id: r.id });
});
