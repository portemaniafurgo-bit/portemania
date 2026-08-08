"use client";

/**
 * Desglose del precio antes de confirmar.
 *
 * Regla del proyecto: ningún importe llega al total sin figurar aquí como una
 * línea con nombre. Lo que ve el cliente es exactamente lo que guarda el
 * servidor en `price_breakdown`.
 */
export default function PriceSummary({ quote, title = "Precio total" }) {
  if (!quote?.lines?.length) return null;

  return (
    <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-5 space-y-3">
      <ul className="space-y-1.5">
        {quote.lines.map((line) => (
          <li key={line.key} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{line.label}</span>
            <span className="font-medium text-foreground whitespace-nowrap">
              {line.amount.toFixed(2)}€
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-primary/20 pt-3 flex items-end justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <span className="text-3xl font-display font-bold text-foreground">
          {quote.total.toFixed(2)}€
        </span>
      </div>
      <p className="text-xs text-muted-foreground">IVA incluido. Sin cargos ocultos.</p>
    </div>
  );
}
