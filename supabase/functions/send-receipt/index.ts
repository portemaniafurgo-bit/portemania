// Edge Function: send-receipt
// Envía por email el recibo de un pedido ENTREGADO a su dueño (propuesta §2.2,
// "descarga de recibo/factura"). El PDF descargable ya existe en la app
// (expo-print); esto cubre el envío por correo, con el mismo contenido.
//
// Seguridad: el llamante solo manda order_id. El servidor comprueba que el
// pedido es SUYO y está entregado, y el email de destino sale de auth — nadie
// puede hacerse mandar recibos ajenos ni a direcciones arbitrarias.
import { createClient } from "jsr:@supabase/supabase-js@2";

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

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "not_configured" }, 200);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user?.email) return json({ error: "No autenticado" }, 401);

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.order_id) return json({ error: "order_id requerido" }, 400);

  const { data: order } = await admin
    .from("transport_requests")
    .select(
      "id, created_by_id, status, service_type, client_name, origin_address, destination_address, payment_method, payment_status, estimated_price, final_price, tip_amount, delivery_time, created_date",
    )
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);
  if (order.created_by_id !== caller.user.id) return json({ error: "No es tu pedido" }, 403);
  if (order.status !== "delivered") return json({ error: "El pedido aún no está entregado" }, 400);

  const ref = String(order.id).slice(0, 8).toUpperCase();
  const total = order.final_price || order.estimated_price || 0;
  const paid = order.payment_status === "paid";
  const date = new Date(order.delivery_time || order.created_date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const html = `
  <div style="font-family:Arial,sans-serif;color:#1a1b20;max-width:560px;margin:0 auto;padding:24px">
    <div style="border-bottom:3px solid #7145d6;padding-bottom:14px;display:flex;justify-content:space-between">
      <div style="font-size:24px;font-weight:800">Clicy<span style="color:#F5B400">Voy</span></div>
      <div style="color:#64748B;font-size:13px;text-align:right">Recibo <b>${ref}</b><br/>${esc(date)}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px">
      <tr><td style="color:#64748B;padding:8px 4px;border-bottom:1px solid #E5E7EB">Cliente</td><td style="padding:8px 4px;border-bottom:1px solid #E5E7EB">${esc(order.client_name)}</td></tr>
      <tr><td style="color:#64748B;padding:8px 4px;border-bottom:1px solid #E5E7EB">Recogida</td><td style="padding:8px 4px;border-bottom:1px solid #E5E7EB">${esc(order.origin_address)}</td></tr>
      <tr><td style="color:#64748B;padding:8px 4px;border-bottom:1px solid #E5E7EB">Entrega</td><td style="padding:8px 4px;border-bottom:1px solid #E5E7EB">${esc(order.destination_address)}</td></tr>
      <tr><td style="color:#64748B;padding:8px 4px;border-bottom:1px solid #E5E7EB">Pago</td><td style="padding:8px 4px;border-bottom:1px solid #E5E7EB">${order.payment_method === "card" ? "Tarjeta" : "Efectivo"} · ${paid ? "PAGADO" : "pendiente"}</td></tr>
      ${order.tip_amount ? `<tr><td style="color:#64748B;padding:8px 4px;border-bottom:1px solid #E5E7EB">Propina al conductor</td><td style="padding:8px 4px;border-bottom:1px solid #E5E7EB">${esc(order.tip_amount)} €</td></tr>` : ""}
      <tr><td style="padding:12px 4px;font-size:17px;font-weight:800">Total del servicio</td><td style="padding:12px 4px;font-size:17px;font-weight:800;color:#7145d6">${esc(total)} €</td></tr>
    </table>
    <p style="color:#64748B;font-size:12px;margin-top:28px">
      Documento informativo del servicio prestado a través de clicyvoy.es.<br/>
      ¿Dudas? Responde a este correo indicando la referencia ${ref}.
    </p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [caller.user.email],
      subject: `Tu recibo ClicyVoy · ${ref}`,
      html,
    }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("send-receipt fallo:", result?.message);
    return json({ sent: false, error: result?.message || "No se pudo enviar" });
  }
  return json({ sent: true, to: caller.user.email });
});
