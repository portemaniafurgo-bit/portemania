"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/entities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/common/StatusBadge";
import RatingVans from "@/components/common/RatingVans";
import ReportIncidentButton from "@/components/common/ReportIncidentButton";
import { vehicleData } from "@/components/common/VehicleCard";
import { packageWeightLabel } from "@/lib/tariffs";
import ServiceExtras from "@/components/common/ServiceExtras";
import { ArrowLeft, Send, MessageCircle, Loader2, CreditCard, Banknote } from "lucide-react";
import { format, addMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useRef } from "react";
import DriverTrackingMap from "@/components/common/DriverTrackingMap";
import AppBanner from "@/components/common/AppBanner";
import DeliveryProofCard from "@/components/order/DeliveryProofCard";
import OrderExtras, { InvoiceNote } from "@/components/order/OrderExtras";
import { fetchRouteEta, geocodeAlbacete, distanceKm } from "@/lib/eta";
import { serviceOf } from "@/lib/services";

// Una posición se considera "en vivo" si se escribió hace menos de un minuto.
// El conductor la publica cada 15 s desde la web (y cada ~10 s desde la app),
// así que un hueco mayor significa que dejó de emitir: móvil bloqueado,
// pestaña cerrada o sin cobertura. Presentarla como actual engaña al cliente.
const FRESH_LOCATION_MS = 60_000;

function locationFreshness(updatedAt) {
  if (!updatedAt) return { fresh: false, label: "antigüedad desconocida" };
  const ageMinutes = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000);
  if (Date.now() - new Date(updatedAt).getTime() < FRESH_LOCATION_MS) {
    return { fresh: true, label: "en vivo" };
  }
  if (ageMinutes < 60) return { fresh: false, label: `hace ${ageMinutes} min` };
  return { fresh: false, label: `hace ${Math.floor(ageMinutes / 60)} h` };
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const chatEndRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [orderLoading, setOrderLoading] = useState(true);
  // Negociación (migración 0014): contraofertas de conductores en vivo.
  const [priceOffers, setPriceOffers] = useState([]);
  const [negotiating, setNegotiating] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;

    const loadOffers = async () => {
      const { data } = await supabase
        .from("price_offers")
        .select("id, driver_name, amount, message, status")
        .eq("request_id", id)
        .eq("status", "pending")
        .order("created_date", { ascending: true });
      if (active) setPriceOffers(data || []);
    };
    loadOffers();

    const channel = supabase
      .channel(`offers-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "price_offers", filter: `request_id=eq.${id}` },
        loadOffers,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const acceptOffer = async (offerId) => {
    setNegotiating(true);
    try {
      const { data, error } = await supabase.rpc("accept_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      setOrder(prev => ({ ...prev, ...data }));
      setPriceOffers([]);
      // Avisar al conductor ganador ("¡Trato hecho!"). No bloquea el flujo.
      supabase.functions
        .invoke("send-push", { body: { mode: "offer_accepted", order_id: data.id } })
        .catch(() => {});
    } catch (err) {
      toast({ title: "No se pudo aceptar", description: err.message, variant: "destructive" });
    } finally {
      setNegotiating(false);
    }
  };

  const rejectOffer = async (offerId) => {
    setNegotiating(true);
    try {
      const { error } = await supabase.rpc("reject_price_offer", { p_offer_id: offerId });
      if (error) throw error;
      setPriceOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (err) {
      toast({ title: "No se pudo rechazar", description: err.message, variant: "destructive" });
    } finally {
      setNegotiating(false);
    }
  };
  const [driverProfile, setDriverProfile] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [targetCoords, setTargetCoords] = useState(null);

  useEffect(() => {
    base44.entities.TransportRequest.get(id).then(async res => {
      setOrder(res);
      setOrderLoading(false);
      if (res?.driver_id) {
        // Fila más ANTIGUA = la original del conductor (el orden por defecto
        // -created_date devolvería la más nueva si hubiera filas duplicadas).
        const profiles = await base44.entities.DriverProfile.filter({ created_by_id: res.driver_id }, "created_date", 1);
        setDriverProfile(profiles?.[0] || null);
      }
    }).catch(err => {
      // Pedido inexistente u oculto por RLS: mostrar "Pedido no encontrado" en vez de spinner infinito
      console.error("Error al cargar el pedido:", err);
      setOrder(null);
      setOrderLoading(false);
    });
    base44.entities.ChatMessage.filter({ request_id: id }, "created_date", 100).then(setMessages);

    const unsubOrder = base44.entities.TransportRequest.subscribe((event) => {
      if (event.data?.id === id || event.id === id) {
        if (event.type === "update") {
          setOrder(prev => ({ ...prev, ...event.data }));
          if (event.data?.driver_id) {
            base44.entities.DriverProfile.filter({ created_by_id: event.data.driver_id }, "created_date", 1).then(p => {
              const prof = p?.[0] || null;
              setDriverProfile(prof);
              if (prof?.current_lat && prof?.current_lng) {
                setDriverLocation({
                  lat: prof.current_lat,
                  lng: prof.current_lng,
                  updatedAt: prof.location_updated_at,
                });
              }
            });
          }
        }
      }
    });
    const unsubChat = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.request_id === id) {
        if (event.type === "create") {
          setMessages(prev => (prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data]));
        }
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
      const profiles = await base44.entities.DriverProfile.filter({ created_by_id: order.driver_id }, "created_date", 1);
      const prof = profiles?.[0];
      if (prof?.current_lat && prof?.current_lng) {
        setDriverLocation({
          lat: prof.current_lat,
          lng: prof.current_lng,
          updatedAt: prof.location_updated_at,
        });
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [order?.driver_id, order?.status]);

  // Destino del ETA: hasta recoger la carga, la dirección de recogida;
  // después, la de entrega. Si el pedido no tiene coordenadas, se geocodifica
  // la dirección una vez (Nominatim) y se cachea en estado.
  useEffect(() => {
    if (!order) return;
    const goingToPickup = ["accepted", "in_transit"].includes(order.status);
    const lat = goingToPickup ? order.origin_lat : order.destination_lat;
    const lng = goingToPickup ? order.origin_lng : order.destination_lng;
    if (lat && lng) {
      // Coordenadas ya conocidas: fijarlas aquí evita la petición de geocodificación.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetCoords({ lat, lng, label: goingToPickup ? "la recogida" : "la entrega" });
      return;
    }
    const address = goingToPickup ? order.origin_address : order.destination_address;
    let active = true;
    geocodeAlbacete(address).then(coords => {
      if (active && coords) {
        setTargetCoords({ ...coords, label: goingToPickup ? "la recogida" : "la entrega" });
      }
    });
    return () => { active = false; };
  }, [order?.status, order?.origin_address, order?.destination_address]);

  // ETA en tiempo real: se recalcula con cada actualización de posición (máx. cada 15 s).
  const lastEtaCalc = useRef(0);
  useEffect(() => {
    if (!driverLocation || !targetCoords) return;
    if (!["accepted", "in_transit", "picked_up"].includes(order?.status)) {
      // El pedido dejó de estar activo: retirar el ETA mostrado es el propósito del efecto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEta(null);
      return;
    }
    const now = Date.now();
    if (now - lastEtaCalc.current < 15000) return;
    lastEtaCalc.current = now;
    let active = true;
    fetchRouteEta(driverLocation, targetCoords).then(result => {
      if (active && result) setEta({ ...result, label: targetCoords.label });
    });
    return () => { active = false; };
  }, [driverLocation, targetCoords, order?.status]);

  const sendMutation = useMutation({
    mutationFn: (msg) => base44.entities.ChatMessage.create({
      request_id: id,
      sender_id: user?.id,
      sender_name: user?.full_name || "Cliente",
      sender_role: "client",
      message: msg,
    }),
    onSuccess: (created) => {
      setMessage("");
      // Append optimista: si Realtime está caído el mensaje ya guardado
      // desaparecía de la vista hasta recargar. Dedupe por id frente al evento.
      if (created?.id) {
        setMessages(prev => (prev.some(m => m.id === created.id) ? prev : [...prev, created]));
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const rateMutation = useMutation({
    mutationFn: async () => {
      // La media y el nº de viajes del conductor los recalcula un trigger en la
      // BD (el cliente no tiene permiso para escribir en driver_profiles).
      await base44.entities.TransportRequest.update(id, {
        client_rating: rating,
        client_review: review,
      });
    },
    onSuccess: async () => {
      const res = await base44.entities.TransportRequest.get(id);
      setOrder(res);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar la valoración. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Cuánto costaría cancelar AHORA. Lo dice el servidor, y se enseña antes de
  // preguntar: nadie debe descubrir una penalización después de aceptarla.
  const [cancelFee, setCancelFee] = useState(0);
  useEffect(() => {
    if (!id || !isOwner) return;
    supabase.rpc("cancellation_fee_now", { p_request_id: id }).then(({ data }) => {
      setCancelFee(Number(data) || 0);
    });
  }, [id, isOwner, order?.status]);

  const cancelMutation = useMutation({
    // Misma regla que la app: la penalización la calcula y aplica el servidor.
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("cancel_order_as_client", {
        p_request_id: id,
        p_reason: null,
      });
      if (error) throw error;
      // Al conductor hay que decírselo: puede estar conduciendo hacia la recogida.
      if (data?.driver_id) {
        supabase.functions
          .invoke("send-push", { body: { mode: "client_cancelled", order_id: id } })
          .catch(() => {});
      }
      return data;
    },
    onSuccess: (data) => {
      setOrder(prev => ({ ...prev, ...(data || { status: "cancelled" }) }));
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      if (data?.cancellation_fee) {
        toast({
          title: "Pedido cancelado",
          description: `Queda anotada la penalización de ${Number(data.cancellation_fee).toFixed(2)} €: se aplicará en tu próximo servicio.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo cancelar el pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
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
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Pedido no encontrado</p>
        <Button className="rounded-xl" onClick={() => router.push("/my-orders")}>
          Ver mis pedidos
        </Button>
      </div>
    );
  }

  const vehicle = vehicleData[order.vehicle_type];
  const isActive = !["delivered", "cancelled"].includes(order.status);
  // Solo el DUEÑO del pedido valora: el conductor también puede abrir esta
  // vista (p.ej. desde su historial) y sin este check podía puntuarse a sí mismo.
  const isOwner = user?.id && order.created_by_id === user.id;
  const canRate = order.status === "delivered" && !order.client_rating && isOwner;
  const canPayNow = isOwner && order.payment_method === "card" && order.payment_status !== "paid" && order.status !== "cancelled";

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
      {/* Chat: activo durante el servicio; tras la entrega queda el historial en solo-lectura */}
      {order.driver_id && !["pending", "cancelled"].includes(order.status) && (isActive || messages.length > 0) && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Chat con el conductor</span>
            {!isActive && <span className="text-xs text-muted-foreground ml-auto">Historial</span>}
          </div>
          <div className="h-48 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_role === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender_role === "client"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  {/* Fotos enviadas desde la app (chat_messages.image_url) */}
                  {msg.image_url && (
                    <a href={msg.image_url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.image_url} alt="Foto del chat" className="rounded-xl max-h-40 mb-1" />
                    </a>
                  )}
                  {msg.message !== "📷 Foto" && msg.message}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {isActive && (
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
          )}
        </div>
      )}

      {/* La negociación vive en la app (decisión 27/08): si este pedido
          lleva precio propuesto, las respuestas se gestionan alli. */}
      {order.status === "pending" && order.proposed_price != null && (
        <AppBanner text={`Tu oferta de ${Number(order.proposed_price).toFixed(2)} € tiene ${priceOffers.length} respuesta${priceOffers.length === 1 ? "" : "s"}`} />
      )}

      {/* ETA en tiempo real / llegada inminente */}
      {["accepted", "in_transit", "picked_up"].includes(order.status) && (() => {
        const freshness = driverLocation ? locationFreshness(driverLocation.updatedAt) : null;
        // "Está llegando" solo si la posición es reciente: con una congelada a
        // 80 m el cliente saldría a la calle a esperar a un conductor que ya no
        // está ahí.
        const arriving =
          driverLocation && targetCoords && freshness?.fresh &&
          distanceKm(driverLocation, targetCoords) < 0.12;
        if (arriving) {
          return (
            <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-300 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-lg flex-shrink-0 animate-pulse">🚐</div>
              <div>
                <p className="font-display font-bold text-emerald-800 text-lg leading-tight">
                  ¡El conductor está llegando a {targetCoords.label}!
                </p>
                <p className="text-xs text-emerald-600">A menos de 100 metros</p>
              </div>
            </div>
          );
        }
        if (eta) {
          return (
            <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-lg flex-shrink-0">🚐</div>
              <div>
                <p className="font-display font-bold text-foreground text-lg leading-tight">
                  Llega a {eta.label} en ~{eta.minutes} min
                  <span className="text-primary"> · {format(addMinutes(new Date(), eta.minutes), "HH:mm")}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {eta.km} km por carretera ·{" "}
                  {freshness?.fresh
                    ? "posición en vivo"
                    : `posición de ${freshness?.label ?? "antigüedad desconocida"}`}
                </p>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Map con la ruta del conductor */}
      {order.status !== "cancelled" && (
        <div className="space-y-2">
          <DriverTrackingMap
            driverLocation={driverLocation}
            originLat={order.origin_lat ?? targetCoords?.lat}
            originLng={order.origin_lng ?? targetCoords?.lng}
            destLat={order.destination_lat}
            destLng={order.destination_lng}
            route={eta?.coords}
          />
          {driverLocation && (() => {
            const freshness = locationFreshness(driverLocation.updatedAt);
            return (
              <p className="text-xs flex items-center gap-1.5 px-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    freshness.fresh ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                <span className={freshness.fresh ? "text-emerald-700" : "text-amber-700"}>
                  {freshness.fresh
                    ? "Posición del conductor en vivo"
                    : `Última posición del conductor ${freshness.label}`}
                </span>
              </p>
            );
          })()}
        </div>
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
        {order.distance_km > 0 && (
          <p className="text-xs text-muted-foreground mt-3">Distancia: {order.distance_km} km</p>
        )}
      </div>

      {/* Paradas, accesos, receptor y desglose del precio */}
      <ServiceExtras order={order} />

      {/* Vehicle & Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="text-3xl mb-2">{serviceOf(order).emoji}</div>
          <p className="font-semibold text-sm text-foreground">{serviceOf(order).label}</p>
          <p className="text-xs text-muted-foreground">
            {order.service_type === "paquete" ? packageWeightLabel(order.package_weight) : vehicle?.capacity}
          </p>
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
          {/* Vuelta al pago: sin este botón, un pedido con tarjeta abandonado
              a medias no se podía pagar nunca (no había ruta a /payment). */}
          {canPayNow && (
            <Button
              size="sm"
              className="rounded-xl mt-3 w-full gap-1.5"
              onClick={() => router.push(`/payment/${order.id}`)}
            >
              <CreditCard className="w-3.5 h-3.5" /> Pagar ahora
            </Button>
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
              <p className="font-semibold text-foreground">{order.driver_name}</p>
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

      {/* Compartir el seguimiento con quien espera la carga */}
      {isOwner && <OrderExtras order={order} />}

      {/* Prueba de entrega: lo que el conductor dejó al cerrar el servicio */}
      {order.status === "delivered" && isOwner && <DeliveryProofCard order={order} />}

      {/* La factura la emite el conductor autónomo */}
      {isOwner && <InvoiceNote order={order} />}

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

      {/* Incidencias: el panel de admin las gestiona, y desde aquí se crean */}
      {isOwner && order.driver_id && (
        <ReportIncidentButton order={order} user={user} />
      )}

      {/* Cancel — hasta que la carga esté recogida, como en la app */}
      {isOwner && ["pending", "scheduled", "accepted", "in_transit"].includes(order.status) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              Cancelar pedido
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Seguro que quieres cancelar?</AlertDialogTitle>
              <AlertDialogDescription>
                {cancelFee > 0 ? (
                  <span className="block mb-2 font-medium text-foreground">
                    El conductor ya ha salido hacia la recogida, así que cancelar ahora tiene una
                    penalización de {cancelFee.toFixed(2)} €. Se aplicará en tu próximo servicio.
                  </span>
                ) : order.driver_id ? (
                  <span className="block mb-2 font-medium text-foreground">
                    Todavía estás a tiempo: cancelar ahora no tiene ningún coste.
                  </span>
                ) : null}
                Esta acción no se puede deshacer.
                {order.payment_status === "paid" && (
                  <span className="block mt-2 font-medium text-destructive">
                    Este pedido está pagado. La cancelación NO genera un reembolso automático; contacta con ClicyVoy para gestionar la devolución.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Volver</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => cancelMutation.mutate()}
              >
                {cancelFee > 0 ? `Cancelar y pagar ${cancelFee.toFixed(2)} €` : "Sí, cancelar pedido"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
