"use client";

import { useEffect, useState } from "react";
import { MapPin, PenLine, Building2, User } from "lucide-react";
import { serviceOf } from "@/lib/services";
import { billableFloors } from "@/lib/pricing";
import { resolveProofUrl } from "@/lib/deliveryProof";

/**
 * Detalles del pedido que la migración 0010 añadió: paradas intermedias,
 * accesos sin ascensor, receptor de una entrega firmada y desglose del precio.
 *
 * Lo comparten el seguimiento del cliente, el trabajo del conductor y la ficha
 * del admin: los tres tienen que ver exactamente lo mismo, sobre todo el
 * conductor, que es quien se encuentra las escaleras.
 */
export default function ServiceExtras({ order, showBreakdown = true }) {
  if (!order) return null;

  const service = serviceOf(order);
  const stops = (order.stops || []).filter((s) => s?.address);
  const originFloors = billableFloors(order.origin_has_lift, order.origin_floors);
  const destinationFloors = billableFloors(order.destination_has_lift, order.destination_floors);
  const hasAccessInfo = order.needs_help && (originFloors > 0 || destinationFloors > 0);
  const breakdown = showBreakdown ? order.price_breakdown || [] : [];

  if (!stops.length && !hasAccessInfo && !order.signature_required && !breakdown.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {stops.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {stops.length} parada{stops.length === 1 ? "" : "s"} intermedia
            {stops.length === 1 ? "" : "s"}
          </p>
          <ol className="space-y-1">
            {stops.map((stop, i) => (
              <li key={i} className="text-sm text-amber-900 flex gap-2">
                <span className="font-semibold flex-shrink-0">{i + 1}.</span>
                <span>{stop.address}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {hasAccessInfo && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-1">
          <p className="text-sm font-semibold text-orange-800 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Accesos sin ascensor
          </p>
          {originFloors > 0 && (
            <p className="text-sm text-orange-900">
              Recogida: {originFloors} planta{originFloors === 1 ? "" : "s"} a pie
            </p>
          )}
          {destinationFloors > 0 && (
            <p className="text-sm text-orange-900">
              Entrega: {destinationFloors} planta{destinationFloors === 1 ? "" : "s"} a pie
            </p>
          )}
        </div>
      )}

      {order.signature_required && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-1">
          <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
            <PenLine className="w-4 h-4" />
            Entrega con firma obligatoria
          </p>
          {order.recipient_name && (
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              Recibe: {order.recipient_name}
              {order.recipient_phone ? ` · ${order.recipient_phone}` : ""}
            </p>
          )}
          {order.delivered_signature_at && (
            <p className="text-sm text-blue-900">
              Firmada el{" "}
              {new Date(order.delivered_signature_at).toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
          <SignatureImage reference={order.proof_signature_url} />
        </div>
      )}

      {breakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Desglose del precio · {service.label}
          </p>
          <ul className="space-y-1">
            {breakdown.map((line) => (
              <li key={line.key} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{line.label}</span>
                <span className="font-medium text-foreground whitespace-nowrap">
                  {Number(line.amount).toFixed(2)}€
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="font-display font-bold text-foreground">
              {Number(order.final_price ?? order.estimated_price ?? 0).toFixed(2)}€
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * La firma vive en un bucket privado: hay que pedir una URL firmada para
 * enseñarla, y solo la obtienen el cliente del pedido, su conductor y el staff.
 */
function SignatureImage({ reference }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    resolveProofUrl(reference).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [reference]);

  if (!reference || !url) return null;

  return (
    <img
      src={url}
      alt="Firma del receptor"
      className="mt-2 w-full max-w-xs rounded-xl border border-blue-200 bg-white"
    />
  );
}
