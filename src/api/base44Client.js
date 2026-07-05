"use client";

/**
 * Shim de compatibilidad con el SDK de Base44, respaldado por Supabase.
 *
 * Permite portar las páginas originales con cambios mínimos: mantienen
 *   import { base44 } from "@/api/base44Client";
 *   base44.entities.TransportRequest.create(...)
 *   base44.integrations.Core.UploadFile({ file })
 *   base44.auth.me()
 *
 * NO usa Base44 AI: todo va contra Supabase (DB, Realtime, Storage, Auth).
 */

import { supabase, createEntity } from "@/lib/entities";

// --- Entidades (nombre Base44 -> tabla Supabase) ---
const transportRequestsBase = createEntity("transport_requests");
const TransportRequest = {
  ...transportRequestsBase,
  // Sin sesión (solicitud como invitado) el insert+returning choca con la RLS;
  // se pasa por la RPC create_guest_request (security definer, solo campos del formulario).
  async create(values) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return transportRequestsBase.create(values);
    const { data, error } = await supabase.rpc("create_guest_request", {
      payload: values,
    });
    if (error) throw error;
    return data;
  },
};
const DriverProfile = createEntity("driver_profiles");
const ChatMessage = createEntity("chat_messages");
const Incident = createEntity("incidents");
// Candidaturas del formulario público "Quiero ser conductor" (solo las ve el admin).
const DriverApplication = createEntity("driver_applications");
// Blog para SEO (lo edita el admin; el público solo ve lo publicado).
const BlogPost = createEntity("blog_posts");

// Entidad User -> tabla profiles, con helpers de Base44 (me / updateMyUserData)
const User = {
  ...createEntity("profiles"),
  async me() {
    return me();
  },
  async updateMyUserData(values) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    const { data, error } = await supabase
      .from("profiles")
      .update(values)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// --- Integraciones (Core.UploadFile / Core.SendEmail) ---
async function UploadFile({ file, bucket = "cargo-photos" }) {
  const ext = file.name?.split(".").pop() || "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

async function SendEmail({ to, subject, body }) {
  // Sin proveedor de email configurado todavía. Best-effort vía Edge Function
  // si existe; si no, no bloquea el flujo (las notificaciones en-app + la lista
  // de solicitudes del conductor cubren el caso de uso principal).
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, body },
    });
    if (error) throw error;
    return data;
  } catch (e) {
    if (typeof console !== "undefined") {
      console.info("[SendEmail] omitido (sin proveedor):", subject, "->", to);
    }
    return { skipped: true };
  }
}

// --- Auth ---
async function me() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const err = new Error("No autenticado");
    err.status = 401;
    throw err;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return {
    id: user.id,
    email: user.email,
    ...(profile || {}),
    full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
    role: profile?.role || "client",
  };
}

async function logout(redirectTo) {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    window.location.href = redirectTo || "/";
  }
}

// Actualiza el perfil del usuario actual (equivale a Base44 auth.updateMe).
async function updateMe(values) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data, error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

function absoluteUrl(path) {
  if (typeof window === "undefined") return path;
  if (!path) return window.location.origin;
  if (path.startsWith("http")) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function loginViaEmailPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

async function loginWithProvider(provider, redirectTo) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: absoluteUrl(redirectTo || "/dashboard") },
  });
  if (error) throw error;
  return data;
}

async function register({ email, password, role }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: role ? { role } : undefined,
      emailRedirectTo: absoluteUrl("/login-clientes"),
    },
  });
  if (error) throw error;
  return data;
}

async function verifyOtp({ email, otpCode }) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otpCode,
    type: "signup",
  });
  if (error) throw error;
  return { access_token: data?.session?.access_token, session: data?.session };
}

async function resendOtp(email) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
  return { success: true };
}

function setToken() {
  // Supabase gestiona la sesión en cookies/localStorage automáticamente.
  return true;
}

async function resetPasswordRequest(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteUrl("/reset-password"),
  });
  if (error) throw error;
  return { success: true };
}

async function resetPassword({ newPassword }) {
  // El enlace de recuperación de Supabase establece una sesión temporal;
  // basta con actualizar la contraseña del usuario activo.
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return { success: true };
}

// --- Gestión de usuarios (admin) ---
// Crea un usuario (conductor/trabajador) vía Edge Function con service role.
async function inviteUser(email, role = "driver") {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email, role },
  });
  if (error) throw error;
  return data;
}

export const base44 = {
  users: { inviteUser },
  entities: {
    TransportRequest,
    DriverProfile,
    ChatMessage,
    Incident,
    DriverApplication,
    BlogPost,
    User,
  },
  integrations: {
    Core: { UploadFile, SendEmail },
  },
  auth: {
    me,
    logout,
    updateMe,
    loginViaEmailPassword,
    loginWithProvider,
    register,
    verifyOtp,
    resendOtp,
    setToken,
    resetPasswordRequest,
    resetPassword,
  },
};

export default base44;
