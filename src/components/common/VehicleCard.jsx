import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Dos tamaños de cara al cliente: pequeña y grande. Las fotos son solo una
// referencia orientativa del tamaño (no el modelo exacto del conductor).
const vehicleData = {
  small: {
    name: "Furgoneta pequeña",
    icon: "🚐",
    description: "Ideal para cajas, electrodomésticos y muebles sueltos",
    capacity: "Tamaño orientativo · carga pequeña",
    photo: "/vehicles/pequena.jpeg",
    basePrice: 40,
    includedHours: 2,
  },
  large: {
    name: "Furgoneta grande",
    icon: "🚚",
    description: "Para mudanzas pequeñas y cargas voluminosas",
    capacity: "Tamaño orientativo · carga grande",
    photo: "/vehicles/grande.jpeg",
    basePrice: 60,
    includedHours: 2,
  },
};

export { vehicleData };

// `price` (opcional) sobreescribe el precio por defecto con la tarifa viva
// de app_settings (ver src/lib/tariffs.js).
export default function VehicleCard({ type, selected, onClick, price }) {
  const vehicle = vehicleData[type];
  if (!vehicle) return null;

  return (
    <button
      onClick={() => onClick(type)}
      className={cn(
        "relative w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:border-primary/40",
        selected ? "border-primary shadow-md" : "border-border bg-card"
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10 bg-primary rounded-full p-0.5">
          <Check className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className="h-36 w-full overflow-hidden bg-white relative">
        <img src={vehicle.photo} alt={vehicle.name} className="w-full h-full object-contain" />
        <span className="absolute bottom-1.5 right-2 text-[10px] text-muted-foreground bg-white/80 rounded px-1.5 py-0.5">
          Imagen de referencia (tamaño aprox.)
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-heading font-semibold text-foreground">{vehicle.name}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{vehicle.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{vehicle.capacity}</span>
          <span className="font-semibold text-primary">{price ?? vehicle.basePrice}€ / 2h</span>
        </div>
      </div>
    </button>
  );
}
