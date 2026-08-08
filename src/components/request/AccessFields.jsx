"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Ascensor y plantas de una dirección.
 *
 * Solo aparece cuando el cliente ha contratado la ayuda del conductor: sin
 * ayuda el servicio es a pie de calle y nadie sube nada, así que preguntarlo
 * sería fricción gratuita. El recargo por planta se ve al elegirlo.
 */
export default function AccessFields({ label, hasLift, floors, floorPrice, onChange }) {
  const total = hasLift === false ? (Number(floors) || 0) * floorPrice : 0;

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>

      <div className="grid grid-cols-2 gap-2">
        {[
          { value: true, text: "Hay ascensor", hint: "Sin recargo" },
          { value: false, text: "Sin ascensor", hint: `${floorPrice}€ / planta` },
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange({ hasLift: option.value })}
            className={cn(
              "rounded-xl border-2 px-3 py-2.5 text-left transition-all",
              hasLift === option.value
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span className="block text-sm font-medium text-foreground">{option.text}</span>
            <span className="block text-xs text-muted-foreground">{option.hint}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {hasLift === false && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 pt-1">
              <label className="text-sm text-muted-foreground flex-1" htmlFor={`floors-${label}`}>
                ¿Cuántas plantas hay que subir o bajar?
              </label>
              <select
                id={`floors-${label}`}
                value={floors}
                onChange={(e) => onChange({ floors: Number(e.target.value) })}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground"
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} planta{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            {total > 0 && (
              <p className="text-xs text-primary font-medium mt-2">
                Recargo por acceso: +{total}€
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
