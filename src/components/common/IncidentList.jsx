"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquareReply } from "lucide-react";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/common/StatusBadge";

const TYPE_LABELS = {
  damage: "Daño en la mercancía",
  delay: "Retraso",
  lost_item: "Objeto perdido",
  payment: "Problema con el pago",
  behavior: "Comportamiento",
  other: "Otro",
};

/**
 * Las incidencias del pedido con la respuesta del admin. El panel las resolvía
 * y el cliente nunca veía la resolución (petición de Renato, 01/09/2026). La
 * RLS solo devuelve las del propio usuario.
 */
export default function IncidentList({ orderId }) {
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", orderId],
    queryFn: () => base44.entities.Incident.filter({ request_id: orderId }, "-created_date", 20),
    enabled: !!orderId,
    // La respuesta del admin llega sin recargar la página.
    refetchInterval: 15000,
  });

  if (!incidents.length) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <h3 className="font-heading font-semibold text-foreground">Tus incidencias</h3>
      {incidents.map(inc => (
        <div key={inc.id} className="border-t border-border pt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{TYPE_LABELS[inc.type] || inc.type}</span>
            <StatusBadge status={inc.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            {inc.created_date && format(new Date(inc.created_date), "d MMM yyyy, HH:mm", { locale: es })}
          </p>
          <p className="text-sm text-foreground">{inc.description}</p>
          {inc.resolution ? (
            <div className="flex gap-2 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <MessageSquareReply className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary">Respuesta de ClicyVoy</p>
                <p className="text-sm text-foreground">{inc.resolution}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Pendiente de respuesta. Te avisaremos en cuanto la haya.</p>
          )}
        </div>
      ))}
    </div>
  );
}
