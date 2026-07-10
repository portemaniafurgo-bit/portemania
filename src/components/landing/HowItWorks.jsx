"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Indica origen y destino",
    description: "Introduce las direcciones de recogida y entrega. Puedes añadir fotos de la carga.",
    icon: "📍",
  },
  {
    number: "02",
    title: "Elige tu vehículo",
    description: "Selecciona el tamaño de furgoneta adecuado y consulta el precio estimado al instante.",
    icon: "🚛",
  },
  {
    number: "03",
    title: "Un conductor acepta",
    description: "Conductores verificados cercanos reciben tu solicitud y uno acepta el servicio.",
    icon: "✅",
  },
  {
    number: "04",
    title: "Seguimiento en tiempo real",
    description: "Desde tu perfil de cliente puedes ver el estado del servicio: conductor asignado, en camino, recogida y entrega. Todo actualizado al momento.",
    icon: "📲",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Proceso</span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mt-2">
            ¿Cómo funciona?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Solicita una furgoneta con conductor para tu porte en Albacete. En solo 4 pasos.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
            >
              <div className="text-4xl mb-4">{step.icon}</div>
              <span className="text-xs font-mono text-primary font-bold">{step.number}</span>
              <h3 className="font-heading font-semibold text-foreground mt-1 text-lg">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {step.description}
              </p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 border-t-2 border-dashed border-primary/20" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
