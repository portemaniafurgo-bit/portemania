"use client";

import { motion } from "framer-motion";
import { Package, ArrowRight, Zap, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useTariffs, PACKAGE_WEIGHTS } from "@/lib/tariffs";

export default function PackageSection() {
  const tariffs = useTariffs();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const go = () => {
    router.push(isAuthenticated ? "/new-request?service=package" : "/solicitar?service=package");
  };

  return (
    <section className="py-24 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Nuevo</span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mt-2">
            Envío de paquetes el mismo día
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            ¿Solo necesitas mover un paquete? Lo recogemos y entregamos el mismo día dentro de Albacete capital. Hasta 30 kg, precio fijo por peso.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /> El mismo día</span>
            <span className="inline-flex items-center gap-1.5"><Package className="w-4 h-4 text-primary" /> Hasta 30 kg</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" /> Albacete capital</span>
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {PACKAGE_WEIGHTS.map((b, i) => (
            <motion.button
              key={b.key}
              type="button"
              onClick={go}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border p-6 text-center hover:shadow-xl hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-7 h-7 text-primary" />
              </div>
              <p className="mt-4 font-heading font-semibold text-foreground">{b.label}</p>
              <p className="mt-1 text-3xl font-display font-bold text-foreground">
                {Number(tariffs[b.priceKey]).toFixed(2)}€
              </p>
            </motion.button>
          ))}
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Sin cuenta, en 2 minutos</li>
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Repartidor verificado</li>
          <li className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Pago en efectivo o tarjeta</li>
        </ul>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mt-10"
        >
          <Button
            size="lg"
            onClick={go}
            className="rounded-full px-10 text-base font-bold h-14 gap-2 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground text-lg"
          >
            Enviar un paquete
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
