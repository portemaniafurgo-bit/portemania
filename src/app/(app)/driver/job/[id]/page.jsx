"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, Send, MapPin, Truck, CheckCircle, Package, MessageCircle, Loader2 } from "lucide-react";
import PhotoLightbox from "@/components/common/PhotoLightbox";
import { useState, useEffect, useRef, useCallback } from "react";

const STEPS = [
  { from: "accepted",   to: "in_transit",  label: "Iniciar viaje →",   icon: Truck,        color: "bg-blue-600 hover:bg-blue-700" },
  { from: "in_transit", to: "picked_up",   label: "He llegado",         icon: MapPin,       color: "bg-amber-500 hover:bg-amber-600" },
  { from: "picked_up",  to: "delivered",   label: "Trabajo finalizado ✓", icon: CheckCircle, color: "bg-emerald-600 hover:bg-emerald-700" },
];

export default function ActiveJob() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const chatEndRef = useRef(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: () => base44.entities.TransportRequest.get(id),
    refetchInterval: 5000,
  });

  // GPS tracking: send location every 15s while job is active
  const sendLocation = useCallback(async () => {
    if (!user?.id || !job || ["delivered", "cancelled"].includes(job.status)) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const profiles = await base44.entities.DriverProfile.filter({ created_by_id: user.id });
      const profile = profiles?.[0];
      if (profile) {
        await base44.entities.DriverProfile.update(profile.id, {
          current_lat: pos.coords.latitude,
          current_lng: pos.coords.longitude,
        });
      }
    });
  }, [user?.id, job?.status]);

  useEffect(() => {
    sendLocation();
    const interval = setInterval(sendLocation, 15000);
    return () => clearInterval(interval);
  }, [sendLocation]);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat", id],
    queryFn: () => base44.entities.ChatMessage.filter({ request_id: id }, "created_date", 100),
    refetchInterval: 3000,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const advanceMutation = useMutation({
    mutationFn: async (toStatus) => {
      const extra = {};
      if (toStatus === "picked_up") extra.pickup_time = new Date().toISOString();
      if (toStatus === "delivered") extra.delivery_time = new Date().toISOString();
      await base44.entities.TransportRequest.update(id, { status: toStatus, ...extra });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", id] }),
  });

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.entities.ChatMessage.create({
      request_id: id,
      sender_id: user?.id,
      sender_name: user?.full_name || "Conductor",
      sender_role: "driver",
      message: msg,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", id] });
      setMessage("");
    },
  });

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (!job) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground">Servicio no encontrado</p>
    </div>
  );

  const nextStep = STEPS.find(s => s.from === job.status);
  const vehicle = vehicleData[job.vehicle_type];
  const isFinished = job.status === "delivered" || job.status === "cancelled";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="flex-1 text-xl font-display font-bold text-foreground">Servicio activo</h1>
        <StatusBadge status={job.status} />
      </div>

      {/* Progress timeline */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between gap-2">
          {[
            { status: "accepted",   label: "Aceptado" },
            { status: "in_transit", label: "En camino" },
            { status: "picked_up",  label: "Llegado" },
            { status: "delivered",  label: "Finalizado" },
          ].map((step, i, arr) => {
            const statuses = ["accepted", "in_transit", "picked_up", "delivered"];
            const currentIdx = statuses.indexOf(job.status);
            const stepIdx = statuses.indexOf(step.status);
            const done = stepIdx <= currentIdx;
            return (
              <div key={step.status} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {stepIdx < currentIdx ? "✓" : i + 1}
                </div>
                <span className={`text-xs text-center ${done ? "text-primary font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                {i < arr.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Route */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-primary mt-1 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Recogida</p>
            <p className="text-sm font-medium text-foreground">{job.origin_address}</p>
          </div>
        </div>
        <div className="ml-1.5 border-l-2 border-dashed border-primary/30 h-3" />
        <div className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Entrega</p>
            <p className="text-sm font-medium text-foreground">{job.destination_address}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Vehículo</p>
            <p className="text-sm font-medium">{vehicle?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Precio</p>
            <p className="text-lg font-bold text-primary">{job.estimated_price?.toFixed(2)}€</p>
          </div>
        </div>
      </div>

      {/* Cargo */}
      {job.cargo_description && (
        <div className="bg-muted/50 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-foreground">{job.cargo_description}</p>
          </div>
          {job.cargo_photos?.length > 0 && (
            <div className="mt-3">
              <PhotoLightbox photos={job.cargo_photos} />
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {nextStep && !isFinished && (
        <Button
          className={`w-full h-14 rounded-2xl text-base font-semibold gap-2 text-white ${nextStep.color}`}
          onClick={() => advanceMutation.mutate(nextStep.to)}
          disabled={advanceMutation.isPending}
        >
          {advanceMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <nextStep.icon className="w-5 h-5" />}
          {nextStep.label}
        </Button>
      )}

      {isFinished && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="font-semibold text-emerald-800">¡Servicio completado!</p>
          <p className="text-sm text-emerald-600 mt-1">El cliente ha sido notificado.</p>
        </div>
      )}

      {/* Chat */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Chat con el cliente</span>
        </div>
        <div className="h-52 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground pt-8">Aún no hay mensajes</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_role === "driver" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                msg.sender_role === "driver"
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
            disabled={!message.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate(message)}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
