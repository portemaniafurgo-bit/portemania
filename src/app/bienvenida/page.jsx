"use client";

import Link from "next/link";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus, User } from "lucide-react";
import Logo from "@/components/common/Logo";
import GoogleIcon from "@/components/GoogleIcon";

export default function Bienvenida() {
  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/new-request");
  };

  const handleGuest = () => {
    window.location.href = "/solicitar";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="large" />
          <h1 className="text-2xl font-display font-bold text-foreground mt-2">¿Cómo quieres continuar?</h1>
          <p className="text-sm text-muted-foreground">Elige una opción para solicitar tu transporte</p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium gap-3"
            onClick={handleGoogle}
          >
            <GoogleIcon className="w-5 h-5" />
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">o</span>
            </div>
          </div>

          <Link href="/register">
            <Button className="w-full h-12 font-medium gap-2">
              <UserPlus className="w-4 h-4" />
              Registrarse con correo electrónico
            </Button>
          </Link>

          <button
            onClick={handleGuest}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <User className="w-4 h-4" />
            Continuar como invitado
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login-clientes" className="text-primary font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
