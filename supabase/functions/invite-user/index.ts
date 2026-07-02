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
    const token = authHeader.replace("Bearer ", "");
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: { user: callerUser } } = await caller.auth.getUser();
    if (callerUser) {
      const { data: prof } = await admin
        .from("profiles").select("role,email").eq("id", callerUser.id).single();
      if (prof?.role === "admin" || (prof?.email || "").toLowerCase() === MASTER_ADMIN) {
        authorized = true;
      }
    }
  }
  if (!authorized) return json({ error: "No autorizado" }, 403);

  // Contraseña: usa la indicada o genera una temporal.
  const password = body.password ||
    (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!7");
  const finalRole = email === MASTER_ADMIN ? "admin" : role;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: finalRole },
  });
  if (error) {
    return json({ error: error.message }, 400);
  }

  // Asegura el rol en el perfil (por si el trigger ya creó la fila).
  await admin.from("profiles").update({ role: finalRole }).eq("id", data.user.id);

  return json({ user: { id: data.user.id, email: data.user.email }, role: finalRole, password });
});
