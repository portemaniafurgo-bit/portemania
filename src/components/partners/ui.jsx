"use client";

import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Piezas compartidas de las pantallas de comerciales (panel y admin). */

export function LoadingBox({ text = "Cargando…", className }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <Loader2 className="w-4 h-4 animate-spin text-primary" />
      {text}
    </div>
  );
}

export function ErrorBox({ text = "No se ha podido cargar.", onRetry, className }) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1 text-destructive">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {text}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="rounded-lg gap-1.5" onClick={() => onRetry()}>
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </Button>
      )}
    </div>
  );
}

export function EmptyBox({ text, className }) {
  return (
    <p className={cn("py-8 text-center text-sm text-muted-foreground", className)}>{text}</p>
  );
}

export function Section({ title, icon: Icon, action, children, className }) {
  return (
    <section className={cn("bg-card rounded-2xl border border-border p-5 space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const COMMISSION_STATUS = {
  pending: { label: "En espera", className: "bg-amber-100 text-amber-800 border-amber-200" },
  awaiting_payment: { label: "Pendiente de pago", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  available: { label: "Disponible", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  held: { label: "En revisión", className: "bg-orange-100 text-orange-800 border-orange-200" },
  requested: { label: "Solicitada", className: "bg-blue-100 text-blue-800 border-blue-200" },
  paid: { label: "Cobrada", className: "bg-gray-100 text-gray-800 border-gray-200" },
  reversed: { label: "Anulada", className: "bg-red-100 text-red-800 border-red-200" },
};

const PAYOUT_STATUS = {
  requested: { label: "Solicitado", className: "bg-blue-100 text-blue-800 border-blue-200" },
  paid: { label: "Pagado", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rechazado", className: "bg-red-100 text-red-800 border-red-200" },
};

function StatusPill({ config, status }) {
  const c = config[status] || { label: status, className: "bg-gray-100 text-gray-800 border-gray-200" };
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border whitespace-nowrap", c.className)}>
      {c.label}
    </Badge>
  );
}

export function CommissionStatusBadge({ status }) {
  return <StatusPill config={COMMISSION_STATUS} status={status} />;
}

export function PayoutStatusBadge({ status }) {
  return <StatusPill config={PAYOUT_STATUS} status={status} />;
}

export const KIND_LABEL = { first: "Primer servicio", repeat: "Servicio siguiente" };
