"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, Send, MapPin, Truck, CheckCircle, Package, MessageCircle, Loader2, XCircle } from "lucide-react";
import PhotoLightbox from "@/components/common/PhotoLightbox";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useRef, useCallback } from "react";

const STEPS = [
  { from: "accepted",   to: "in_transit",  label: "Iniciar viaje →",   icon: Truck,        color: "bg-blue-600 hover:bg-blue-700" },
  { from: "in_transit", to: "picked_up",   label: "He llegado",         icon: MapPin,       color: "bg-amber-500 hover:bg-amber-600" },
  { from: "picked_up",  to: "delivered",   label: "Trabajo finalizado ✓", icon: CheckCircle, color: "bg-emerald-600 hover:bg-emerald-700" },
];

// Motivos de cancelación del conductor (solo antes de recoger la mercancía)
const CANCEL_REASONS = [
  "Mercancía muy pesada o voluminosa",
  "El cliente no ha especificado correctamente la carga",
  "Mercancía ilegal (sospecha de robo)",
  "Cliente problemático",
  "Otro",
];

const FEEDBACK_TAGS = ["Precio justo", "Precio injusto", "Mucho tiempo de espera"];
const ADMIN_EMAILS = ["renato.0550.calero@gmail.com", "portemaniafurgo@gmail.com"];

export default function ActiveJob() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const chatEndRef = useRef(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [fbTags, setFbTags] = useState([]);
  const [fbText, setFbText] = useState("");
  const [fbSent, setFbSent] = useState(false);

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

  // Cancelación del conductor antes de recoger: el pedido vuelve a pendientes
  // con el motivo registrado, y se avisa a la empresa por email.
  const releaseMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.TransportRequest.update(id, {
        status: "pending",
        driver_id: null,
        driver_name: null,
        accepted_at: null,
        driver_cancel_reason: cancelReason,
        driver_cancel_note: cancelNote.trim() || null,
        driver_cancel_name: user?.full_name || "Conductor",
        driver_cancel_at: new Date().toISOString(),
      });
      ADMIN_EMAILS.forEach(to =>
        base44.integrations.Core.SendEmail({
          to,
          subject: `⚠️ Conductor canceló un servicio — ${cancelReason}`,
          body: `${user?.full_name || "Un conductor"} ha cancelado un servicio antes de recoger la mercancía.\n\nMotivo: ${cancelReason}${cancelNote.trim() ? `\nDetalle: ${cancelNote.trim()}` : ""}\n\nPedido: ${job?.client_name || ""} · ${job?.origin_address || ""} → ${job?.destination_address || ""}\nID: ${id}\n\nEl pedido ha vuelto a la lista de pendientes para otros conductores.`,
        }).catch(() => {})
      );
    },
    onSuccess: () => router.push("/driver/requests"),
  });

  // Opinión del conductor al finalizar (chips + texto): se guarda en el pedido
  // (visible en el panel admin) y se envía por email a la empresa.
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.TransportRequest.update(id, {
        driver_feedback_tags: fbTags,
        driver_feedback_text: fbText.trim() || null,
      });
      ADMIN_EMAILS.forEach(to =>
        base44.integrations.Core.SendEmail({
          to,
          subject: `💬 Opinión del conductor — ${user?.full_name || "Conductor"}`,
          body: `${user?.full_name || "Un conductor"} ha dejado su opinión al finalizar un servicio.\n\n${fbTags.length ? `Valoración rápida: ${fbTags.join(", ")}\n` : ""}${fbText.trim() ? `Comentario: ${fbText.trim()}\n` : ""}\nPedido: ${job?.client_name || ""} · ${job?.origin_address || ""} → ${job?.destination_address || ""}\nID: ${id}`,
        }).catch(() => {})
      );
    },
    onSuccess: () => {
      setFbSent(true);
      queryClient.invalidateQueries({ queryKey: ["job", id] });
    },
  });

  const toggleFbTag = (tag) =>
    setFbTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));

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

      {/* Ayuda solicitada por el cliente (aceptada al tomar el trabajo) */}
      {job.needs_help && (
        <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <span className="flex-shrink-0">🤝</span>
          <div>
            <p className="font-semibold text-amber-800">El cliente pide ayuda</p>
            <p className="text-amber-700">{job.help_description}</p>
          </div>
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

      {/* Cancelar antes de recoger: el pedido se libera con motivo */}
      {["accepted", "in_transit"].includes(job.status) && (
        <div className="space-y-3">
          {!showCancel ? (
            <button
              className="w-full text-center text-sm text-muted-foreground underline hover:text-destructive"
              onClick={() => setShowCancel(true)}
            >
              No puedo hacer este servicio
            </button>
          ) : (
            <div className="bg-card rounded-2xl border border-destructive/30 p-5 space-y-3">
              <p className="font-semibold text-sm text-foreground">¿Por qué no puedes hacer este servicio?</p>
              <div className="space-y-2">
                {CANCEL_REASONS.map(reason => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReason(reason)}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${cancelReason === reason ? "border-destructive bg-destructive/5 font-medium text-foreground" : "border-border text-muted-foreground hover:border-destructive/40"}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              {cancelReason === "Otro" && (
                <Textarea
                  placeholder="Especifica el motivo…"
                  value={cancelNote}
                  onChange={e => setCancelNote(e.target.value)}
                  className="rounded-xl min-h-[70px]"
                />
              )}
              <p className="text-xs text-muted-foreground">
                El pedido volverá a la lista para otros conductores y la empresa recibirá tu motivo.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl flex-1" onClick={() => { setShowCancel(false); setCancelReason(""); }}>
                  Volver
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl flex-1 border-destructive/40 text-destructive"
                  disabled={!cancelReason || (cancelReason === "Otro" && cancelNote.trim().length < 5) || releaseMutation.isPending}
                  onClick={() => releaseMutation.mutate()}
                >
                  {releaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                  Cancelar servicio
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isFinished && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <p className="font-semibold text-emerald-800">¡Servicio completado!</p>
          <p className="text-sm text-emerald-600 mt-1">El cliente ha sido notificado.</p>
        </div>
      )}

      {/* Opinión del conductor al finalizar */}
      {job.status === "delivered" && !fbSent && !job.driver_feedback_tags && !job.driver_feedback_text && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="font-semibold text-sm text-foreground">¿Cómo fue el servicio? <span className="text-muted-foreground font-normal">(opcional)</span></p>
          <div className="flex gap-2 flex-wrap">
            {FEEDBACK_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleFbTag(tag)}
                className={`px-3 h-9 rounded-full border text-sm transition-colors ${fbTags.includes(tag) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Escribe lo que quieras contarle a la empresa sobre este servicio…"
            value={fbText}
            onChange={e => setFbText(e.target.value)}
            className="rounded-xl min-h-[80px]"
          />
          <Button
            className="w-full rounded-xl gap-2"
            disabled={(fbTags.length === 0 && !fbText.trim()) || feedbackMutation.isPending}
            onClick={() => feedbackMutation.mutate()}
          >
            {feedbackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar opinión
          </Button>
        </div>
      )}
      {job.status === "delivered" && (fbSent || job.driver_feedback_tags || job.driver_feedback_text) && (
        <div className="bg-card rounded-2xl border border-border p-4 text-center text-sm text-muted-foreground">
          💬 Gracias por tu opinión — la empresa la ha recibido.
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
