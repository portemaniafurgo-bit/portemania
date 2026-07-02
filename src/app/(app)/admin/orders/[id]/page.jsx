"use client";

import { useParams, useRouter } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/common/StatusBadge";
import PhotoLightbox from "@/components/common/PhotoLightbox";
import RatingVans from "@/components/common/RatingVans";
import { vehicleData } from "@/components/common/VehicleCard";
import {
  ArrowLeft, Phone, Banknote, CreditCard, Loader2, MessageCircle,
  CheckCircle2, Circle, XCircle, UserCog,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

function TimelineStep({ label, time, done }) {
  return (
    <div className="flex items-start gap-3">
      {done
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        : <Circle className="w-5 h-5 text-muted-foreground/30 flex-shrink-0" />}
      <div className="flex-1 flex items-center justify-between gap-2">
        <p className={`text-sm ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</p>
        {time && (
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(time), "d MMM, HH:mm", { locale: es })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showReassign, setShowReassign] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => base44.entities.TransportRequest.get(id),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-order-chat", id],
    queryFn: () => base44.entities.ChatMessage.filter({ request_id: id }, "created_date", 100),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["verified-drivers"],
    queryFn: () => base44.entities.DriverProfile.filter({ status: "verified" }, "-created_date", 100),
    enabled: showReassign,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.TransportRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  if (isLoading || !order) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const price = order.final_price || order.estimated_price;
  const isFinished = ["delivered", "cancelled"].includes(order.status);
  const statusReached = (s) => {
    const chain = ["pending", "accepted", "in_transit", "picked_up", "delivered"];
    return chain.indexOf(order.status) >= chain.indexOf(s);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/admin/orders")}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground">
            Pedido de {order.client_name || "—"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {order.created_date && format(new Date(order.created_date), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
            {" · "}#{String(order.id).slice(0, 8)}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Cronología */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h2 className="font-semibold text-sm text-foreground">Cronología</h2>
        <TimelineStep label="Solicitud creada" time={order.created_date} done />
        <TimelineStep label={`Aceptado por ${order.driver_name || "conductor"}`} time={order.accepted_at} done={statusReached("accepted")} />
        <TimelineStep label="Conductor en camino" done={statusReached("in_transit")} />
        <TimelineStep label="Carga recogida" time={order.pickup_time} done={statusReached("picked_up")} />
        <TimelineStep label="Entregado" time={order.delivery_time} done={statusReached("delivered")} />
        {order.status === "cancelled" && (
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive font-medium">Cancelado</p>
          </div>
        )}
      </div>

      {/* Cliente y conductor */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cliente</p>
          <p className="font-semibold text-foreground">{order.client_name || "—"}</p>
          {order.client_phone && (
            <a href={`tel:${order.client_phone}`} className="text-sm text-primary flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> {order.client_phone}
            </a>
          )}
          {!order.created_by_id && <p className="text-xs text-muted-foreground">Solicitud como invitado</p>}
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Conductor</p>
          <p className="font-semibold text-foreground">{order.driver_name || "Sin asignar"}</p>
          <button onClick={() => setShowReassign(v => !v)} className="text-sm text-primary flex items-center gap-1.5">
            <UserCog className="w-3.5 h-3.5" /> {order.driver_id ? "Reasignar" : "Asignar conductor"}
          </button>
        </div>
      </div>

      {/* Reasignar conductor */}
      {showReassign && (
        <div className="bg-card rounded-2xl border border-primary/30 p-5 space-y-2">
          <p className="text-sm font-medium text-foreground">Asignar a un conductor verificado:</p>
          {drivers.length === 0 && <p className="text-sm text-muted-foreground">No hay conductores verificados.</p>}
          {drivers.map(d => (
            <button
              key={d.id}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted text-left"
              onClick={() => {
                updateMutation.mutate({
                  driver_id: d.created_by_id,
                  driver_name: d.full_name,
                  status: order.status === "pending" ? "accepted" : order.status,
                  accepted_at: order.accepted_at || new Date().toISOString(),
                });
                setShowReassign(false);
              }}
            >
              <span className="text-sm font-medium text-foreground">{d.full_name}</span>
              <span className="text-xs text-muted-foreground">
                {vehicleData[d.vehicle_type]?.name || d.vehicle_type} {d.is_available ? "· disponible" : "· no disponible"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Ruta */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
          <span className="text-sm text-foreground">{order.origin_address}</span>
        </div>
        <div className="ml-1.5 border-l-2 border-dashed border-primary/30 h-4" />
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-sm text-foreground">{order.destination_address}</span>
        </div>
      </div>

      {/* Carga y ayuda */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Carga</p>
        <p className="text-sm text-foreground">
          {vehicleData[order.vehicle_type]?.icon} {vehicleData[order.vehicle_type]?.name || order.vehicle_type}
          {order.cargo_description ? ` — ${order.cargo_description}` : ""}
        </p>
        {order.needs_help && (
          <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span>🤝</span>
            <div>
              <p className="font-semibold text-amber-800">Pidió ayuda del conductor</p>
              <p className="text-amber-700">{order.help_description}</p>
            </div>
          </div>
        )}
        {order.notes && <p className="text-sm text-muted-foreground italic">Notas: {order.notes}</p>}
        {order.cargo_photos?.length > 0 && <PhotoLightbox photos={order.cargo_photos} />}
      </div>

      {/* Pago */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pago</p>
          <p className="text-2xl font-display font-bold text-foreground">{price?.toFixed(2)}€</p>
          <p className={`text-sm flex items-center gap-1.5 ${order.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>
            {order.payment_method === "card" ? <CreditCard className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
            {order.payment_status === "paid" ? "Pagado" : "Pendiente"} · {order.payment_method === "card" ? "tarjeta" : "efectivo"}
          </p>
        </div>
        {order.payment_status !== "paid" && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => updateMutation.mutate({ payment_status: "paid" })}
            disabled={updateMutation.isPending}
          >
            Marcar pagado
          </Button>
        )}
      </div>

      {/* Valoración */}
      {order.client_rating && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Valoración del cliente</p>
          <RatingVans rating={order.client_rating} size="small" showValue />
          {order.client_review && <p className="text-sm text-foreground italic">“{order.client_review}”</p>}
        </div>
      )}

      {/* Chat (solo lectura) */}
      {messages.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" /> Chat del pedido
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.map(m => (
              <div key={m.id} className={`text-sm p-2.5 rounded-xl max-w-[85%] ${m.sender_role === "driver" ? "bg-primary/10 ml-auto" : "bg-muted"}`}>
                <p className="text-xs text-muted-foreground mb-0.5">
                  {m.sender_name} · {m.created_date && format(new Date(m.created_date), "HH:mm", { locale: es })}
                </p>
                <p className="text-foreground">{m.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones. Confirmación en dos clics (el confirm() nativo congela el navegador) */}
      {!isFinished && (
        <Button
          variant="outline"
          className={`w-full rounded-xl ${confirmCancel ? "border-destructive bg-destructive/10 text-destructive font-semibold" : "border-destructive/30 text-destructive"}`}
          onClick={() => {
            if (!confirmCancel) {
              setConfirmCancel(true);
              setTimeout(() => setConfirmCancel(false), 4000);
            } else {
              updateMutation.mutate({ status: "cancelled" });
              setConfirmCancel(false);
            }
          }}
          disabled={updateMutation.isPending}
        >
          <XCircle className="w-4 h-4 mr-1" />
          {confirmCancel ? "¿Seguro? Pulsa otra vez para cancelar" : "Cancelar pedido"}
        </Button>
      )}
    </div>
  );
}
