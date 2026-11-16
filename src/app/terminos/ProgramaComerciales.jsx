"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProgramSettings, formatEuro, formatPct } from "@/lib/partners";

/**
 * Condiciones del programa de comerciales en los Términos. Lee los valores
 * vivos de app_settings.partner_program para que el texto legal no quede
 * desactualizado al cambiarlos; sin ellos, remite al área del comercial.
 */
export default function ProgramaComerciales() {
  const { data: s } = useQuery({ queryKey: ["partner-program"], queryFn: fetchProgramSettings });
  const live = s && typeof s === "object";

  const pct = live
    ? `el ${formatPct(s.first_pct)} del precio del primer servicio entregado de cada cliente y el ${formatPct(s.repeat_pct)} de cada servicio entregado posterior`
    : "los porcentajes vigentes, publicados en el área del comercial, sobre el precio de cada servicio entregado";
  const hold = live ? `${s.hold_days} días` : "el plazo vigente";
  const min = live ? formatEuro(s.min_payout) : "el importe mínimo vigente";
  const interval = live ? `una vez cada ${s.payout_interval_days} días` : "con la periodicidad vigente";

  return (
    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
      <li>
        Cualquier persona con cuenta puede activar un perfil de comercial y compartir su enlace
        personal. Se le atribuyen las personas que llegan a través de ese enlace y tienen una cuenta
        nueva, sin pedidos anteriores; cada cliente se atribuye a un único comercial.
      </li>
      <li>
        El comercial recibe {pct}. La base es el precio del servicio sin propina ni penalizaciones
        de cancelaciones anteriores. Un servicio cancelado o no entregado no genera comisión. Si
        un servicio deja de constar como entregado antes de que su comisión se haya solicitado o
        pagado, la comisión se anula; si ocurre después, ClicyVoy la revisa.
      </li>
      <li>
        Cada comisión puede cobrarse cuando el servicio está entregado y pagado y han pasado {hold}
        desde la entrega. El comercial
        solicita el cobro desde su área a partir de {min} disponibles, {interval}, y ClicyVoy lo paga
        por transferencia bancaria a la cuenta indicada, tras revisarlo.
      </li>
      <li>
        ClicyVoy puede retener, revisar o anular comisiones y bloquear perfiles ante indicios de
        fraude o uso indebido (por ejemplo, servicios ficticios, en los que el propio comercial es
        el conductor, de importe alto o con un precio muy por encima del presupuesto) y rechazar
        solicitudes de cobro que no se ajusten a estas condiciones.
      </li>
      <li>
        De cada cliente, el comercial ve su nombre de pila, la fecha de alta y el número de
        servicios; de cada comisión, la fecha, el porcentaje y el importe (con los que se puede
        deducir el precio de ese servicio). Nunca ve apellidos, datos de contacto ni direcciones.
        No puede presentarse como empleado ni representante de ClicyVoy.
      </li>
      <li>
        El comercial actúa por cuenta propia y es responsable de sus obligaciones fiscales y, en su
        caso, de Seguridad Social derivadas de las comisiones que cobre.
      </li>
      <li>
        ClicyVoy puede modificar los porcentajes, plazos y condiciones del programa, o darlo por
        terminado; los cambios no afectan a las comisiones ya generadas.
      </li>
    </ul>
  );
}
