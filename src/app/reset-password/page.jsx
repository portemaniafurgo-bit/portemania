"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

/**
 * Página a la que llegan los enlaces de "invitación" y "restablecer contraseña".
 * El email lleva ?token_hash=...&type=invite|recovery. Aquí se CANJEA el token
 * (verifyOtp) para abrir una sesión temporal y dejar al usuario fijar su clave.
 *
 * A prueba de escáneres: los antivirus de Gmail/Outlook que "pre-abren" el
 * enlace solo cargan el HTML; el token se consume cuando ESTE JS llama a
 * verifyOtp, cosa que el escáner no hace → el enlace sigue válido para la persona.
 */
function ResetPasswordInner() {
  const params = useSearchParams();
  // estado: "checking" | "ready" (token válido) | "invalid"
  const [state, setState] = useState("checking");
  const [isInvite, setIsInvite] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const tokenHash = params.get("token_hash");
      const type = params.get("type") || "recovery";
      setIsInvite(type === "invite");

      // Flujo nuevo: canjear el token_hash del email
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!active) return;
        setState(error ? "invalid" : "ready");
        return;
      }

      // Compatibilidad: si ya hay sesión (enlace antiguo con hash), también vale
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setState(data.session ? "ready" : "invalid");
    })();
    return () => { active = false; };
  }, [params]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Ya tiene sesión: al login correspondiente
      window.location.href = "/login-conductores";
    } catch (err) {
      setError(err.message || "No se pudo guardar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  if (state === "checking") {
    return (
      <AuthLayout icon={Lock} title="Un momento…" subtitle="Validando tu enlace">
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (state === "invalid") {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enlace no válido o caducado"
        subtitle="Este enlace ya se usó o expiró"
        footer={
          <Link href="/forgot-password" className="text-primary font-medium hover:underline">
            Pedir un enlace nuevo
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          Solicita un nuevo enlace y ábrelo en cuanto llegue. Los enlaces caducan por seguridad.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title={isInvite ? "Crea tu contraseña" : "Nueva contraseña"}
      subtitle={isInvite ? "Bienvenido a ClicyVoy — elige tu contraseña para entrar" : "Introduce tu nueva contraseña"}
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repite la contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando…
            </>
          ) : (
            isInvite ? "Crear contraseña y entrar" : "Guardar contraseña"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<AuthLayout icon={Lock} title="Un momento…" subtitle="Cargando" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
