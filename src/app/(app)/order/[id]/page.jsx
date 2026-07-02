"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/common/StatusBadge";
import RatingVans from "@/components/common/RatingVans";
import { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, Send, MessageCircle, Loader2, CreditCard, Banknote } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import DriverTrackingMap from "@/components/common/DriverTrackingMap";

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const chatEndRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [orderLoading, setOrderLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    base44.entities.TransportRequest.get(id).then(async res => {
      setOrder(res);
      setOrderLoading(false);
      if (res?.driver_id) {
        const profiles = await base44.entities.DriverProfile.filter({ created_by_id: res.driver_id });
        setDriverProfile(profiles?.[0] || null);
      }
    });
    base44.entities.ChatMessage.filter({ request_id: id }, "created_date", 100).then(setMessages);

    const unsubOrder = base44.entities.TransportRequest.subscribe((event) => {
      if (event.data?.id === id || event.id === id) {
        if (event.type === "update") {
          setOrder(prev => ({ ...prev, ...event.data }));
          if (event.data?.driver_id) {
            base44.entities.DriverProfile.filter({ created_by_id: event.data.driver_id }).then(p => {
              const prof = p?.[0] || null;
              setDriverProfile(prof);
              if (prof?.current_lat && prof?.current_lng) {
                setDriverLocation({ lat: prof.current_lat, lng: prof.current_lng });
              }
            });
          }
        }
      }
    });
    const unsubChat = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.request_id === id) {
        if (event.type === "create") setMessages(prev => [...prev, event.data]);
      }
    });
    return () => { unsubOrder(); unsubChat(); };
  }, [id]);

  // Poll driver location every 10s when job is active
  useEffect(() => {
    if (!order?.driver_id) return;
    const statuses = ["accepted", "in_transit", "picked_up"];
    if (!statuses.includes(order?.status)) return;

    const poll = async () => {
      const profiles = await base44.entities.DriverProfile.filter({ created_by_id: order.driver_id });
      const prof = profiles?.[0];
      if (prof?.current_lat && prof?.current_lng) {
        setDriverLocation({ lat: prof.current_lat, lng: prof.current_lng });
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [order?.driver_id, order?.status]);

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.entities.ChatMessage.create({
      request_id: id,
      sender_id: user?.id,
      sender_name: user?.full_name || "Cliente",
      sender_role: "client",
      message: msg,
    }),
    onSuccess: () => setMessage(""),
  });

  const rateMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.TransportRequest.update(id, {
        client_rating: rating,
        client_review: review,
      });
      // Actualizar puntuación media del conductor
      if (order?.driver_id) {
        const profiles = await base44.entities.DriverProfile.filter({ created_by_id: order.driver_id });
        const profile = profiles?.[0];
        if (profile) {
          const allRated = await base44.entities.TransportRequest.filter({ driver_id: order.driver_id });
          const rated = allRated.filter(r => r.client_rating && r.id !== id);
          const total = rated.length + 1;
          const sum = rated.reduce((acc, r) => acc + r.client_rating, 0) + rating;
          const newAvg = sum / total;
          await base44.entities.DriverProfile.update(profile.id, {
            average_rating: Math.round(newAvg * 10) / 10,
            total_trips: total,
          });
        }
      }
    },
    onSuccess: async () => {
      const res = await base44.entities.TransportRequest.get(id);
      setOrder(res);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => base44.entities.TransportRequest.update(id, { status: "cancelled" }),
    onSuccess: () => setOrder(prev => ({ ...prev, status: "cancelled" })),
  });

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages]);

  const isLoading = orderLoading;
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Pedido no encontrado</p>
      </div>
    );
  }

  const vehicle = vehicleData[order.vehicle_type];
  const isActive = !["delivered", "cancelled"].includes(order.status);
  const canRate = order.status === "delivered" && !order.client_rating;

  const trackingSteps = [
    { status: "pending",    label: "Pedido recibido",   desc: "Esperando conductor" },
    { status: "accepted",   label: "Conductor asignado", desc: order.driver_name || "Conductor en camino" },
    { status: "in_transit", label: "En camino",          desc: "El conductor se dirige a la recogida" },
    { status: "picked_up",  label: "Carga recogida",     desc: "El conductor ha llegado y cargado" },
    { status: "delivered",  label: "¡Entregado!",        desc: "Servicio completado" },
  ];
  const statusOrder = ["pending", "accepted", "in_transit", "picked_up", "delivered"];
  const currentIdx = statusOrder.indexOf(order.status);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <style>{`
        @keyframes pulseStep {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 hsl(var(--primary) / 0.5); }
          50% { opacity: 0.75; transform: scale(1.12); box-shadow: 0 0 0 8px hsl(var(--primary) / 0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-foreground">Detalle del pedido</h1>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Chat — arriba del todo cuando hay conductor activo */}
      {isActive && order.driver_id && order.status !== "pending" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Chat con el conductor</span>
          </div>
          <div className="h-48 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_role === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender_role === "client"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && message.trim() && sendMutation.mutate(message)}
              className="rounded-xl"
            />
            <Button
              size="icon"
              className="rounded-xl flex-shrink-0"
              disabled={!message.trim()}
              onClick={() => sendMutation.mutate(message)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Map */}
      {order.status !== "cancelled" && (
        <DriverTrackingMap
          driverLocation={driverLocation}
          originLat={order.origin_lat}
          originLng={order.origin_lng}
          destLat={order.destination_lat}
          destLng={order.destination_lng}
        />
      )}

      {/* Live Tracking */}
      {order.status !== "cancelled" && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            Seguimiento en tiempo real
          </h2>
          <div className="space-y-3">
            {trackingSteps.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={step.status} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                    done ? (active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-primary/80 text-primary-foreground") : "bg-muted text-muted-foreground"
                  }`} style={active ? { animation: "pulseStep 1.2s ease-in-out infinite" } : {}}>
                    {i < currentIdx ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                    {active && <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Route */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-primary mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Recogida</p>
              <p className="text-sm font-medium text-foreground">{order.origin_address}</p>
            </div>
          </div>
          <div className="ml-1.5 border-l-2 border-dashed border-primary/30 h-3" />
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Entrega</p>
              <p className="text-sm font-medium text-foreground">{order.destination_address}</p>
            </div>
          </div>
        </div>
        {order.distance_km && (
          <p className="text-xs text-muted-foreground mt-3">Distancia: {order.distance_km} km</p>
        )}
      </div>

      {/* Vehicle & Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-3xl mb-2">{vehicle?.icon}</div>
          <p className="font-semibold text-sm text-foreground">{vehicle?.name}</p>
          <p className="text-xs text-muted-foreground">{vehicle?.capacity}</p>
        </div>
        <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4">
          <p className="text-xs text-muted-foreground">Precio</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {(order.final_price || order.estimated_price)?.toFixed(2)}€
          </p>
          {order.insurance_selected && <p className="text-xs text-emerald-600 mt-1">🛡️ Asegurado</p>}
          {order.payment_method === "card" && (
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium ${
              order.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"
            }`}>
              <CreditCard className="w-3.5 h-3.5" />
              {order.payment_status === "paid" ? "Pagado con tarjeta" : "Pago pendiente"}
            </div>
          )}
          {order.payment_method === "cash" && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Banknote className="w-3.5 h-3.5" />
              Pago en efectivo
            </div>
          )}
        </div>
      </div>

      {/* Driver info */}
      {order.driver_name && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-heading font-semibold text-foreground text-sm">Tu conductor</h3>
          <div className="flex items-center gap-4">
            {driverProfile?.photo_url ? (
              <img src={driverProfile.photo_url} alt="Conductor" className="w-14 h-14 rounded-full object-cover flex-shrink-0 border-2 border-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                {order.driver_name[0]}
              </div>
            )}
            <div>
              <p className="font-semibold text-foreground">{order.driver_name.split(" ")[0]}</p>
              {driverProfile?.phone && (
                <a href={`tel:${driverProfile.phone}`} className="text-sm text-primary font-medium flex items-center gap-1">
                  📞 {driverProfile.phone}
                </a>
              )}
            </div>
          </div>
          {/* Fotos del vehículo */}
          {driverProfile && [driverProfile.vehicle_photo_left_url, driverProfile.vehicle_photo_right_url, driverProfile.vehicle_photo_front_url, driverProfile.vehicle_photo_rear_url].some(Boolean) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Fotos del vehículo</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { url: driverProfile.vehicle_photo_left_url, label: "Izquierdo" },
                  { url: driverProfile.vehicle_photo_right_url, label: "Derecho" },
                  { url: driverProfile.vehicle_photo_front_url, label: "Delantera" },
                  { url: driverProfile.vehicle_photo_rear_url, label: "Trasera" },
                ].map(({ url, label }) => url ? (
                  <div key={label} className="space-y-1">
                    <img src={url} alt={label} className="w-full aspect-square rounded-xl object-cover border border-border" />
                    <p className="text-xs text-center text-muted-foreground">{label}</p>
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cargo */}
      {order.cargo_description && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Descripción de la carga</p>
          <p className="text-sm text-foreground">{order.cargo_description}</p>
          {order.cargo_photos?.length > 0 && (
            <div className="flex gap-2 mt-3">
              {order.cargo_photos.map((url, i) => (
                <img key={i} src={url} alt="cargo" className="w-16 h-16 rounded-xl object-cover border border-border" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat — moved to bottom, rendered after driver section */}

      {/* Rating */}
      {canRate && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-heading font-semibold text-foreground">Valora el servicio</h3>
          <RatingVans rating={rating} onRate={setRating} size="large" />
          <Textarea
            placeholder="Deja un comentario (opcional)"
            value={review}
            onChange={e => setReview(e.target.value)}
            className="rounded-xl"
          />
          <Button
            className="rounded-xl"
            disabled={!rating || rateMutation.isPending}
            onClick={() => rateMutation.mutate()}
          >
            Enviar valoración
          </Button>
        </div>
      )}

      {/* Cancel */}
      {order.status === "pending" && (
        <Button
          variant="outline"
          className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
          onClick={() => cancelMutation.mutate()}
        >
          Cancelar pedido
        </Button>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground space-y-1">
        {order.created_date && <p>Creado: {format(new Date(order.created_date), "d MMM yyyy, HH:mm", { locale: es })}</p>}
        {order.pickup_time && <p>Recogido: {format(new Date(order.pickup_time), "d MMM yyyy, HH:mm", { locale: es })}</p>}
        {order.delivery_time && <p>Entregado: {format(new Date(order.delivery_time), "d MMM yyyy, HH:mm", { locale: es })}</p>}
      </div>
    </div>
  );
}
