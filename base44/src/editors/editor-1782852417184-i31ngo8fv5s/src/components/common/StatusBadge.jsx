import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  accepted: { label: "Aceptado", className: "bg-blue-100 text-blue-800 border-blue-200" },
  in_transit: { label: "En camino", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  picked_up: { label: "Recogido", className: "bg-purple-100 text-purple-800 border-purple-200" },
  delivered: { label: "Entregado", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800 border-red-200" },
  pending_verification: { label: "Pendiente", className: "bg-amber-100 text-amber-800 border-amber-200" },
  verified: { label: "Verificado", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  suspended: { label: "Suspendido", className: "bg-red-100 text-red-800 border-red-200" },
  rejected: { label: "Rechazado", className: "bg-red-100 text-red-800 border-red-200" },
  open: { label: "Abierta", className: "bg-amber-100 text-amber-800 border-amber-200" },
  in_progress: { label: "En proceso", className: "bg-blue-100 text-blue-800 border-blue-200" },
  resolved: { label: "Resuelta", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  closed: { label: "Cerrada", className: "bg-gray-100 text-gray-800 border-gray-200" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" };
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border", config.className)}>
      {config.label}
    </Badge>
  );
}