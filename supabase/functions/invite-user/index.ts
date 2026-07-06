// Edge Function: invite-user (código original recuperado del proyecto onivkquggfshyjqfpuuw)
// Crea usuarios (conductor/trabajador) con service role. Autoriza: admin o bootstrap
// del admin maestro. Devuelve la contraseña para que el admin la comunique.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MASTER_ADMIN = "renato.0550.calero@gmail.com";

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

// Decodifica el payload de un JWT (ya verificado por la plataforma).
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: { email?: string; role?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const email = (body.email || "").trim().toLowerCase();
  const role = body.role || "driver";
  if (!email) return json({ error: "email requerido" }, 400);

  // --- Autorización ---
  // Permitido si: el llamante es admin, O se está creando el admin maestro (bootstrap).
  let authorized = email === MASTER_ADMIN;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authorized && authHeader.startsWith("Bearer ")) {
    // verify_jwt=true → la plataforma ya validó la FIRMA del token antes de
    // llegar aquí. Decodificamos sus claims (sub = id del usuario) y confirmamos
    // que es admin consultando profiles con el cliente service-role.
    const token = authHeader.replace("Bearer ", "");
    const claims = decodeJwtPayload(token);
    if (claims?.sub) {
      const { data: prof } = await admin
        .from("profiles").select("role,email").eq("id", claims.sub).maybeSingle();
      const email2 = (prof?.email || claims.email || "").toLowerCase();
      if (prof?.role === "admin" || email2 === MASTER_ADMIN) {
        authorized = true;
      }
    }
  }
  if (!authorized) return json({ error: "No autorizado" }, 403);

  // Si el email YA tiene cuenta (cliente/admin al que se da de alta como
  // conductor), NO se llama a createUser (podría alterar su contraseña):
  // se devuelve OK y el panel crea su perfil de conductor. Entra con su clave.
  const { data: existing } = await admin
    .from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return json({ user: { id: existing.id, email }, already_existed: true });
  }

  const finalRole = email === MASTER_ADMIN ? "admin" : role;
  const password = body.password ||
    (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!7");

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: finalRole },
  });
  if (error) return json({ error: error.message }, 400);

  await admin.from("profiles").update({ role: finalRole }).eq("id", data.user.id);
  return json({ user: { id: data.user.id, email: data.user.email }, role: finalRole, password });
});
