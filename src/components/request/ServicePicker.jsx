"use client";

import { motion } from "framer-motion";
import { SERVICE_LIST } from "@/lib/services";
import { cn } from "@/lib/utils";

/**
 * "¿Qué necesitas transportar hoy?" — los cuatro servicios en un toque.
 *
 * Es el mismo control en el hero de la home (sobre morado) y dentro del
 * asistente (sobre fondo claro): `variant` solo cambia la piel.
 */
export default function ServicePicker({
  value,
  onChange,
  variant = "card",
  title = "¿Qué necesitas transportar hoy?",
  className,
}) {
  const onHero = variant === "hero";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Etiqueta del grupo de botones, no un encabezado de sección: el H1 de la
          home es el bloque de texto de servicios. */}
      {title && (
        <p
          className={cn(
            "text-base font-bold tracking-tight",
            onHero ? "text-white" : "text-foreground",
          )}
        >
          {title}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {SERVICE_LIST.map((service, i) => {
          const selected = value === service.key;
          return (
            <motion.button
              key={service.key}
              type="button"
              onClick={() => onChange(service.key)}
              aria-pressed={selected}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.3, ease: "easeOut" }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "p-4 rounded-2xl border-2 flex flex-col gap-2 text-left transition-colors",
                onHero
                  ? selected
                    ? "border-white bg-white/20"
                    : "border-white/40 bg-white/5 hover:bg-white/10"
                  : selected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined",
                  onHero ? (selected ? "text-white" : "text-white/70") : "text-primary",
                )}
              >
                {service.icon}
              </span>
              <div>
                <div
                  className={cn(
                    "font-semibold text-sm",
                    onHero ? (selected ? "text-white" : "text-white/80") : "text-foreground",
                  )}
                >
                  {service.label}
                </div>
                <div className={cn("text-xs", onHero ? "text-white/60" : "text-muted-foreground")}>
                  {service.tagline}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
