"use client";

import { useTariffs } from "@/lib/tariffs";

/**
 * Precios vigentes en los Términos: leen las tarifas vivas de Ajustes para que
 * el texto legal nunca quede desactualizado al cambiarlas.
 */
export default function PreciosVigentes() {
  const t = useTariffs();

  return (
    <>
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        <li>
          <strong>Porte</strong> — {t.porte_base} €, recogida y entrega a pie de calle en Albacete
          capital.
        </li>
        <li>
          <strong>Mini mudanza</strong> — {t.mudanza_base} € con 2 horas incluidas. Hora adicional{" "}
          {t.mudanza_extra_hour} €.
        </li>
        <li>
          <strong>Ayuda del conductor</strong> (cargar y descargar junto al cliente) —{" "}
          {t.mudanza_help} €. Con ayuda contratada, cada planta sin ascensor añade{" "}
          {t.mudanza_floor} € por dirección.
        </li>
        <li>
          <strong>Parada intermedia</strong> en mini mudanza — {t.mudanza_stop} € por parada.
        </li>
        <li>
          <strong>Compra en tienda / portes para tiendas</strong> — {t.tienda_base} € por servicio,
          con subida a domicilio si el edificio tiene ascensor y firma del receptor.
        </li>
        <li>
          <strong>Envío de paquetes en Albacete</strong> — {Number(t.pkg_light).toFixed(2)} € hasta
          9 kg, {Number(t.pkg_medium).toFixed(2)} € de 10 a 19 kg y{" "}
          {Number(t.pkg_heavy).toFixed(2)} € de 20 a 30 kg.
        </li>
        <li>
          <strong>Envío de paquetes a Villarrobledo</strong> —{" "}
          {Number(t.pkg_villarrobledo).toFixed(2)} € hasta 10 kg, con recogida en Albacete y entrega
          en 24 horas.
        </li>
      </ul>
      <p className="text-sm text-muted-foreground leading-relaxed">
        El seguro opcional de mercancía tiene un coste de {t.insurance} €. En la mini mudanza el
        tiempo empieza a contar cuando el conductor llega a la dirección de recogida; si el servicio
        se prolonga más allá de las horas contratadas, cada hora adicional se abona al conductor a
        razón de {t.mudanza_extra_hour} €/hora. Todos los precios incluyen IVA y se muestran
        desglosados antes de confirmar la reserva.
      </p>
    </>
  );
}
