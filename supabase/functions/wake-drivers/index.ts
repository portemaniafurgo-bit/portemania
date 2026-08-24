/**
 * «El dinero te persigue, pero tú eres más rápido.»
 *
 * Email a los conductores que están DESCONECTADOS cuando hay pedidos esperando.
 * Los avisos normales por correo siguen igual: esto es solo para el que tiene
 * la app cerrada y no se entera de que hay trabajo entrando.
 *
 * Reglas para no quemar a nadie:
 *   · Solo si hay pedidos pendientes de verdad.
 *   · Solo a verificados, sin documentación caducada y NO disponibles.
 *   · Como mucho un correo cada 6 horas por conductor.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const HOURS_BETWEEN = 6;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. ¿Hay trabajo esperando?
  const { data: pending } = await admin
    .from("transport_requests")
    .select("id, service_type, origin_address, estimated_price, proposed_price")
    .eq("status", "pending")
    .limit(20);

  if (!pending?.length) return json({ sent: 0, skipped: "no hay pedidos pendientes" });

  // 2. Conductores listos para trabajar pero desconectados.
  const { data: drivers } = await admin
    .from("driver_profiles")
    .select("id, email, full_name, is_available, docs_expired, status, woken_at")
    .eq("status", "verified");

  const now = Date.now();
  const targets = (drivers || []).filter((d: Record<string, unknown>) => {
    if (!d.email || d.is_available !== false || d.docs_expired) return false;
    const last = d.woken_at ? new Date(d.woken_at as string).getTime() : 0;
    return now - last > HOURS_BETWEEN * 3600 * 1000;
  });

  if (!targets.length) return json({ sent: 0, skipped: "nadie a quien avisar" });

  const total = pending.length;
  const mejor = pending.reduce(
    (max: number, p: Record<string, number | null>) =>
      Math.max(max, Number(p.proposed_price ?? p.estimated_price ?? 0)),
    0,
  );

  let sent = 0;
  for (const driver of targets) {
    const nombre = String(driver.full_name || "").split(" ")[0] || "conductor";
    const html = `
      <div style="font-family:-apple-system,Roboto,Arial,sans-serif;color:#14141A;max-width:520px">
        <div style="font-size:24px;font-weight:800">Clicy<span style="color:#F5B400">Voy</span></div>
        <h2 style="font-size:20px;margin:20px 0 8px">El dinero te persigue, pero tú eres más rápido</h2>
        <p style="font-size:15px;line-height:1.6;color:#31313B">
          ${nombre}, ahora mismo hay <b>${total} ${total === 1 ? "pedido esperando" : "pedidos esperando"}</b>
          ${mejor > 0 ? `y el mejor pagado va por <b>${mejor.toFixed(2)} €</b>` : ""}.
          Entra en la app y ponte disponible para aceptar los pedidos que están entrando de nuestros clientes.
        </p>
        <p style="font-size:14px;color:#6C6C78">
          Estás marcado como <b>no disponible</b>, así que no te están llegando avisos.
          Se cambia con un toque desde la pantalla de Ofertas.
        </p>
        <p style="font-size:12px;color:#9A9AA6;margin-top:28px">
          Te escribimos como mucho una vez cada ${HOURS_BETWEEN} horas, y solo cuando hay trabajo de verdad.
        </p>
      </div>`;

    const { error } = await admin.functions.invoke("send-email", {
      body: {
        to: driver.email,
        subject: `Hay ${total} ${total === 1 ? "pedido" : "pedidos"} esperando en Albacete`,
        html,
      },
    });
    if (!error) {
      sent++;
      await admin
        .from("driver_profiles")
        .update({ woken_at: new Date().toISOString() })
        .eq("id", driver.id);
    }
  }

  return json({ sent, candidates: targets.length, pending: total });
});
