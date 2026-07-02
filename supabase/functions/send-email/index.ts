// Edge Function: send-email
// Envía notificaciones vía Resend. La invoca el shim SendEmail (avisos de nuevos
// trabajos a admins/conductores). Puede llamarla cualquiera (el flujo de invitado
// no tiene sesión), así que la protección es una LISTA BLANCA de destinatarios:
// solo los emails de administración y los de conductores verificados en la BD.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_RECIPIENTS = [
  "renato.0550.calero@gmail.com",
  "renatocaleromartinez407@gmail.com",
  "portemaniafurgo@gmail.com",
];

// Sin dominio verificado en Resend se envía desde la dirección de onboarding.
const FROM = "PorteManía <onboarding@resend.dev>";

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

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY no configurada" }, 500);

  let body: { to?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const to = (body.to || "").trim().toLowerCase();
  const subject = (body.subject || "").slice(0, 200);
  const text = (body.body || "").slice(0, 5000);
  if (!to || !subject || !text) return json({ error: "to, subject y body son obligatorios" }, 400);

  // Lista blanca: admins fijos o conductor verificado en la BD.
  let allowed = ADMIN_RECIPIENTS.includes(to);
  if (!allowed) {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin
      .from("driver_profiles")
      .select("id")
      .eq("status", "verified")
      .ilike("email", to)
      .limit(1);
    allowed = !!data?.length;
  }
  if (!allowed) return json({ error: "Destinatario no permitido" }, 403);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  const result = await res.json();
  if (!res.ok) return json({ error: result?.message || "Fallo al enviar" }, 502);

  return json({ sent: true, id: result?.id });
});
