"use client";

import { useTariffs } from "@/lib/tariffs";
import { vehicleData } from "@/components/common/VehicleCard";

/**
 * Precios vigentes en los Términos: leen las tarifas vivas de Ajustes para que
 * el texto legal nunca quede desactualizado al cambiarlas.
 */
export default function PreciosVigentes() {
  const tariffs = useTariffs();
  return (
    <>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li><strong>{vehicleData.small.name}</strong> — {tariffs.small} € las primeras 2 horas</li>
        <li><strong>{vehicleData.large.name}</strong> — {tariffs.large} € las primeras 2 horas</li>
        <li><strong>Ayuda del conductor</strong> (subir/bajar mercancía) — suplemento de {tariffs.help_price} €</li>
      </ul>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Cada hora adicional se factura a <strong>{tariffs.extra_hour} €/hora</strong>. El seguro opcional de
        mercancía tiene un coste de {tariffs.insurance} €. Los precios incluyen IVA.
      </p>
    </>
  );
}
