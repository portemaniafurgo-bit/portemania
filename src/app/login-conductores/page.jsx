"use client";

import { useState } from "react";
import Link from "next/link";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function LoginConductores() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/driver";
    } catch (err) {
      // No colapsar todos los errores en "credenciales incorrectas": un
      // invitado sin contraseña o un rate-limit necesitan otro mensaje.
      const msg = err?.message || "";
      if (/rate limit|security purposes/i.test(msg)) {
        setError("Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.");
      } else if (/not confirmed/i.test(msg)) {
        setError("Tu cuenta aún no está activada. Abre el enlace del correo de invitación o pide uno nuevo en «Restablecerla».");
      } else {
        setError("Email o contraseña incorrectos. Si te acaban de invitar, crea tu contraseña desde el enlace del correo; si no la recuerdas, pulsa «Restablecerla» abajo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Truck}
      title="Acceso conductores"
      subtitle="Usa las credenciales facilitadas por el administrador"
      footer={
        <>
          ¿Olvidaste tu contraseña?{" "}
          <Link href="/forgot-password" className="text-primary font-medium hover:underline">
            Restablecerla
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" placeholder="conductor@clicyvoy.es" value={email}
              onChange={e => setEmail(e.target.value)} className="pl-10 h-12" required autoFocus />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Entrando...</> : "Iniciar sesión"}
        </Button>
      </form>

      <p className="mt-6 text-xs text-center text-muted-foreground">
        Una vez dentro podrás cambiar tu contraseña desde «Mi perfil».
      </p>
    </AuthLayout>
  );
}
