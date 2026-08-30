"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UserPlus, Zap, ShieldCheck, KeyRound } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { buildRequestHref, hasRequestDraft } from "@/lib/requestIntent";

/**
 * Alta SOLO con Google (decisión de negocio, 27/08/2026).
 *
 * Fuera el formulario de email/contraseña/OTP: una cuenta de Google trae el
 * email verificado y el nombre, y nos ahorra contraseñas olvidadas y códigos
 * que no llegan. El teléfono se pide una vez dentro, al completar el perfil.
 *
 * El login con contraseña sigue vivo para las cuentas antiguas.
 */
const VENTAJAS = [
  { icon: Zap, text: "Entras en un toque, sin formularios" },
  { icon: ShieldCheck, text: "Tu email ya llega verificado" },
  { icon: KeyRound, text: "Sin otra contraseña que recordar" },
];

export default function RegisterContent() {
  const searchParams = useSearchParams();
  // Quien venía a pedir algo vuelve a su pedido al terminar el alta.
  const redirectUrl = hasRequestDraft(searchParams)
    ? buildRequestHref("/new-request", searchParams)
    : "/dashboard";

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crea tu cuenta"
      subtitle="El registro es con tu cuenta de Google. Rápido y sin contraseñas."
    >
      <div className="space-y-3 mb-6">
        {VENTAJAS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <Button
        className="w-full h-12 rounded-xl gap-3 text-base"
        variant="outline"
        onClick={() => base44.auth.loginWithProvider("google", redirectUrl)}
      >
        <GoogleIcon className="w-5 h-5" />
        Continuar con Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta con contraseña?{" "}
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Entrar
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Al crear la cuenta aceptas los{" "}
        <Link href="/terminos" className="underline">términos</Link> y la{" "}
        <Link href="/privacidad" className="underline">política de privacidad</Link> de ClicyVoy.
      </p>
    </AuthLayout>
  );
}
