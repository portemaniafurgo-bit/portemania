import { Check, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_TARIFFS } from "@/lib/tariffs";

// Tarjeta de tramo de peso para el envío de paquetes (mismo día, máx. 30 kg).
// `bracket` es un elemento de PACKAGE_WEIGHTS; `price` es la tarifa viva.
export default function WeightCard({ bracket, selected, onClick, price }) {
  if (!bracket) return null;
  const amount = price ?? DEFAULT_TARIFFS[bracket.priceKey];

  return (
    <button
      type="button"
      onClick={() => onClick(bracket.key)}
      className={cn(
        "relative w-full text-left rounded-2xl border-2 transition-all duration-200 p-4 flex items-center gap-4",
        "hover:shadow-md hover:border-primary/40",
        selected ? "border-primary shadow-md" : "border-border bg-card"
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10 bg-primary rounded-full p-0.5">
          <Check className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
        selected ? "bg-primary/10" : "bg-muted"
      )}>
        <Package className={cn("w-6 h-6", selected ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-heading font-semibold text-foreground">{bracket.label}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{bracket.hint}</p>
      </div>
      <span className="font-display font-bold text-lg text-primary whitespace-nowrap">
        {Number(amount).toFixed(2)}€
      </span>
    </button>
  );
}
