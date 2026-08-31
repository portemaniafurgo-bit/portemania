"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { PackagePlus, Zap, ShieldCheck, Bell } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { buildRequestHref } from "@/lib/requestIntent";

/**
 * Hacer un pedido exige cuenta de Google (decisión de negocio, 31/08/2026).
 *
 * Esta ruta era la solicitud de invitado; los enlaces antiguos siguen
 * funcionando, pero ahora desembocan aquí: un toque con Google y el asistente
 * continúa con lo que el visitante ya traía en la URL (servicio, direcciones).
 */
const VENTAJAS = [
  { icon: Zap, text: "Un toque y sigues con tu pedido donde estabas" },
  { icon: Bell, text: "Ves las respuestas de los conductores y el estado en vivo" },
  { icon: ShieldCheck, text: "Tus recibos y facturas quedan guardados en tu cuenta" },
];

export default function GuestRequestContent() {
  const searchParams = useSearchParams();
  // El pedido continúa con lo que ya venía en la URL: nada de empezar de cero.
  const redirectUrl = buildRequestHref("/new-request", searchParams);

  return (
    <AuthLayout
      icon={PackagePlus}
      title="Entra para pedir"
      subtitle="Para publicar un pedido hace falta tu cuenta de Google. Sin formularios ni contraseñas."
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
        <Link href="/login-clientes" className="text-primary font-semibold hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
