"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, UserPlus, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const handleSolicitarTransporte = () => {
    if (isAuthenticated) {
      router.push("/new-request");
    } else {
      setShowModal(true);
    }
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Banner image */}
      <div className="relative w-full">
        <img
          src="https://media.base44.com/images/public/6a32f79927b9d0ad42c1c9e5/dcf2d978a_bannerweb.png"
          alt="PorteManía — Espacio para lo importante. Nosotros lo llevamos."
          className="w-full object-cover object-center"
          style={{ maxHeight: "520px" }}
        />
      </div>

      {/* CTAs below banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 justify-center px-6 py-6 bg-background"
      >
        <Button size="lg" onClick={handleSolicitarTransporte} className="rounded-full px-8 text-base font-semibold h-12 gap-2 shadow-md">
          Solicitar transporte
          <ArrowRight className="w-4 h-4" />
        </Button>
        <a href="mailto:Renato.0550.calero@gmail.com">
          <Button size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold h-12 w-full sm:w-auto">
            Quiero ser conductor
          </Button>
        </a>
      </motion.div>

      {/* Modal de acceso */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-0"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🚐</div>
                <h2 className="text-xl font-display font-bold text-foreground">¿Cómo quieres continuar?</h2>
                <p className="text-sm text-muted-foreground mt-1">Elige una opción para solicitar tu transporte</p>
              </div>

              <div className="space-y-3">
                <Link href="/login-clientes" onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                      <LogIn className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Iniciar sesión</p>
                      <p className="text-xs text-muted-foreground">Accede a tu cuenta para seguimiento completo</p>
                    </div>
                  </button>
                </Link>

                <Link href="/register" onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/30 hover:bg-muted transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Crear cuenta</p>
                      <p className="text-xs text-muted-foreground">Gratis · Gestiona tus pedidos online</p>
                    </div>
                  </button>
                </Link>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Link href="/solicitar" onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/30 hover:bg-muted transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Continuar como invitado</p>
                      <p className="text-xs text-muted-foreground">Sin cuenta · Pago en efectivo al conductor</p>
                    </div>
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
