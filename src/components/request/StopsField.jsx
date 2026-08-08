"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MAX_STOPS } from "@/lib/pricing";

/**
 * Paradas intermedias de la mini mudanza.
 *
 * Se recoge en la calle uno, se para en la calle dos y se termina en la calle
 * tres: tres direcciones son UNA parada adicional. El recargo se muestra aquí
 * mismo, mientras el cliente la añade, nunca como sorpresa en el resumen.
 */
export default function StopsField({ stops, errors = [], price, onAdd, onUpdate, onRemove }) {
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {stops.map((stop, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                Parada {index + 1}
                <span className="text-xs font-normal text-muted-foreground">+{price}€</span>
              </label>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                aria-label={`Quitar parada ${index + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Input
              placeholder="Calle, número — Albacete"
              value={stop.address}
              onChange={(e) => onUpdate(index, e.target.value)}
              className={`h-12 rounded-xl ${errors[index] ? "border-destructive" : ""}`}
            />
            {errors[index] && <p className="text-xs text-destructive">{errors[index]}</p>}
          </motion.div>
        ))}
      </AnimatePresence>

      {stops.length < MAX_STOPS && (
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="w-4 h-4" />
          Añadir parada intermedia
          <span className="text-xs text-muted-foreground font-normal">+{price}€ cada una</span>
        </button>
      )}
    </div>
  );
}
