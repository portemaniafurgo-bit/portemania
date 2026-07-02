import { Truck } from "lucide-react";

export default function Logo({ size = "default", showSlogan = false }) {
  const sizes = {
    small: { icon: "w-5 h-5", text: "text-lg" },
    default: { icon: "w-7 h-7", text: "text-2xl" },
    large: { icon: "w-10 h-10", text: "text-4xl" },
  };

  const s = sizes[size];

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <div className="bg-primary rounded-xl p-1.5 flex items-center justify-center">
          <Truck className={`${s.icon} text-primary-foreground`} />
        </div>
        <span className={`${s.text} font-display font-bold tracking-tight text-foreground`}>
          Porte<span className="text-primary">Manía</span>
        </span>
      </div>
      {showSlogan && (
        <p className="text-muted-foreground text-sm mt-1 ml-1">
          Tu transporte en minutos.
        </p>
      )}
    </div>
  );
}