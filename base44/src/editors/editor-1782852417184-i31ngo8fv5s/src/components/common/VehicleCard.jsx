import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const vehicleData = {
  l1h1: {
    name: "Furgoneta L1H1",
    description: "Ideal para mudanzas pequeñas, cajas y objetos ligeros",
    capacity: "Hasta 5m³ · 800kg",
    photo: "https://media.base44.com/images/public/6a32f79927b9d0ad42c1c9e5/6786c0cfd_l1h1.png",
    basePrice: 50,
    includedHours: 2,
  },
  l1h2: {
    name: "Furgoneta L1H2",
    description: "Mayor altura, perfecta para muebles altos y electrodomésticos",
    capacity: "Hasta 7m³ · 1.000kg",
    photo: "https://media.base44.com/images/public/6a32f79927b9d0ad42c1c9e5/1a7857a53_l1h2.png",
    basePrice: 60,
    includedHours: 2,
  },
  l2h2: {
    name: "Furgoneta L2H2",
    description: "Gran capacidad para mudanzas medianas y cargas voluminosas",
    capacity: "Hasta 12m³ · 1.500kg",
    photo: "https://media.base44.com/images/public/6a32f79927b9d0ad42c1c9e5/b65b63982_l2h2.png",
    basePrice: 85,
    includedHours: 2,
  },
};

export { vehicleData };

export default function VehicleCard({ type, selected, onClick }) {
  const vehicle = vehicleData[type];
  if (!vehicle) return null;

  return (
    <button
      onClick={() => onClick(type)}
      className={cn(
        "relative w-full text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:border-primary/40",
        selected
          ? "border-primary shadow-md"
          : "border-border bg-card"
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 z-10 bg-primary rounded-full p-0.5">
          <Check className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      )}
      <div className="h-36 w-full overflow-hidden">
        <img
          src={vehicle.photo}
          alt={vehicle.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="font-heading font-semibold text-foreground">{vehicle.name}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{vehicle.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{vehicle.capacity}</span>
          <span className="font-semibold text-primary">
            {vehicle.basePrice}€ / 2h
          </span>
        </div>
      </div>
    </button>
  );
}