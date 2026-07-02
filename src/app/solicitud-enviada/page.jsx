"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home } from "lucide-react";
import { motion } from "framer-motion";

export default function SolicitudEnviada() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-sm w-full text-center space-y-6"
      >
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">¡Solicitud enviada!</h1>
          <p className="text-muted-foreground text-sm">
            Hemos recibido tu solicitud. Uno de nuestros conductores te contactará pronto por teléfono para confirmar el servicio.
          </p>
        </div>
        <div className="bg-muted rounded-2xl p-4 text-sm text-left space-y-1">
          <p className="font-medium text-foreground">¿Quieres hacer seguimiento online?</p>
          <p className="text-muted-foreground text-xs">Crea una cuenta gratuita para ver el estado de tu pedido en tiempo real.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/register">
            <Button className="w-full rounded-xl h-12">Crear cuenta gratis</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full rounded-xl h-12 gap-2">
              <Home className="w-4 h-4" /> Volver al inicio
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
