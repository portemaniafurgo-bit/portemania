"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { vehicleData } from "@/components/common/VehicleCard";
import { packageWeightLabel } from "@/lib/tariffs";
import { Check, MapPin, Package, Loader2 } from "lucide-react";
import PhotoLightbox from "@/components/common/PhotoLightbox";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/entities";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "@/lib/driverProfile";
import { toast } from "@/components/ui/use-toast";

export default function DriverRequests() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["pending-requests"],
    queryFn: () => base44.entities.TransportRequest.filter({ status: "pending" }, "-created_date", 20),
    refetchInterval: 10000,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["driver-profile", user?.id],
    queryFn: () => fetchMyDriverProfile(user),
    enabled: !!user?.id,
  });

  // Reparto por tamaño: un furgón grande puede con todo; los pedidos de
  // furgoneta grande solo los ven conductores con furgón grande. Los envíos de
  // paquete (máx. 30 kg) los ve cualquier conductor: caben en cualquier vehículo.
  const myVehicle = profile?.vehicle_type;
  const requests = allRequests.filter(r => r.service_type === "package" || r.vehicle_type !== "large" || myVehicle === "large");
  const isUnavailable = profile?.is_available === false;

  const acceptMutation = useMutation({
    mutationFn: async (requestId) => {
      // Update condicionado: solo acepta si el pedido sigue pendiente.
      // Si otro conductor lo aceptó antes, el array devuelto viene vacío.
      const { data: updated, error } = await supabase
        .from("transport_requests")
        .update({
          status: "accepted",
          driver_id: user?.id,
          // Nombre del PERFIL de conductor primero: en cuentas invitadas por
          // email profiles.full_name está vacío y user.full_name cae al email
          // — el cliente veía el correo del conductor como nombre.
          driver_name: profile?.full_name || user?.full_name || "Conductor",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "pending")
        .select();
      if (error) throw error;
      if (!updated || updated.length === 0) {
        return { requestId, alreadyTaken: true };
      }

      // Obtener datos del pedido para el email
      const req = requests.find(r => r.id === requestId);
      if (req && user?.email) {
        const vehicle = vehicleData[req.vehicle_type];
        // El email es informativo: si falla, el servicio ya está aceptado
        await base44.integrations.Core.SendEmail({
          to: user.email,
          from_name: "ClicyVoy",
          subject: req.service_type === "package" ? "📦 Nuevo envío asignado" : "🚐 Nuevo trabajo asignado",
          body: `Hola ${user?.full_name?.split(" ")[0] || "conductor"},\n\nSe te ha asignado un nuevo servicio.\n\n📍 Recogida: ${req.origin_address}\n🏁 Entrega: ${req.destination_address}\n${req.service_type === "package" ? `📦 Envío de paquete (${packageWeightLabel(req.package_weight)})` : `🚐 Vehículo: ${vehicle?.name || req.vehicle_type}`}\n💶 Precio estimado: ${req.estimated_price?.toFixed(2)}€${req.cargo_description ? `\n📦 Contenido: ${req.cargo_description}` : ""}${req.distance_km ? `\n📏 Distancia: ${req.distance_km} km` : ""}\n\nAccede a la app para ver todos los detalles y gestionar el servicio.\n\n¡Mucho éxito!\nEl equipo de ClicyVoy`,
        }).catch(() => {});
      }

      return { requestId, alreadyTaken: false };
    },
    onSuccess: ({ requestId, alreadyTaken }) => {
      if (alreadyTaken) {
        toast({
          title: "Otro conductor ya ha aceptado este servicio",
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
      router.push(`/driver/job/${requestId}`);
    },
    onError: () => {
      toast({
        title: "No se pudo aceptar el servicio",
        description: "Inténtalo de nuevo en unos segundos.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || profileLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Gate: sin perfil o con perfil incompleto no se ven ni aceptan trabajos
  if (!profile || isDriverProfileIncomplete(profile)) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="text-6xl">📋</div>
        <h2 className="text-xl font-display font-bold text-foreground">
          Completa tu perfil para ver y aceptar trabajos
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Necesitas subir toda la documentación requerida antes de poder recibir servicios.
        </p>
        <Link href="/driver/profile">
          <Button className="rounded-xl gap-2">Completar mi perfil →</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Solicitudes disponibles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {requests.length} solicitudes pendientes cerca de ti
        </p>
      </div>

      {isUnavailable && (
        <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <span className="flex-shrink-0">⚠️</span>
          <p className="text-amber-800 font-medium">
            Estás en modo No disponible: actívate en el panel para aceptar trabajos
          </p>
        </div>
      )}

      {/* Perfil aún sin verificar: la RLS no le enseña pedidos pendientes y sin
          este aviso solo veía una lista vacía sin explicación. */}
      {profile.status === "pending_verification" && (
        <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <span className="flex-shrink-0">🕐</span>
          <p className="text-amber-800 font-medium">
            Tu perfil está en revisión por el equipo de ClicyVoy. Verás las solicitudes disponibles en cuanto quede aprobado.
          </p>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-muted-foreground">No hay solicitudes disponibles ahora</p>
          <p className="text-sm text-muted-foreground">Se actualizan automáticamente cada 10 segundos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{req.service_type === "package" ? "📦" : vehicleData[req.vehicle_type]?.icon}</span>
                  <span className="font-semibold text-foreground">{req.service_type === "package" ? `Paquete · ${packageWeightLabel(req.package_weight)}` : vehicleData[req.vehicle_type]?.name}</span>
                </div>
                <span className="text-xl font-bold text-primary">{req.estimated_price?.toFixed(2)}€</span>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-foreground">{req.origin_address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-muted-foreground">{req.destination_address}</span>
                </div>
              </div>

              {req.cargo_description && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3 bg-muted/50 rounded-xl p-3">
                  <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{req.cargo_description}</span>
                </div>
              )}

              {/* El cliente pide ayuda: el conductor lo ve ANTES de aceptar y decide */}
              {req.needs_help && (
                <div className="flex items-start gap-2 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <span className="flex-shrink-0">🤝</span>
                  <div>
                    <p className="font-semibold text-amber-800">Pide ayuda del conductor</p>
                    <p className="text-amber-700">{req.help_description}</p>
                  </div>
                </div>
              )}

              {req.distance_km && (
                <p className="text-xs text-muted-foreground mb-3">
                  📏 {req.distance_km} km · {req.helpers_count > 0 ? `${req.helpers_count} ayudantes · ` : ""}
                  {req.insurance_selected ? "🛡️ Asegurado" : ""}
                </p>
              )}

              {req.cargo_photos?.length > 0 && (
                <div className="mb-3">
                  <PhotoLightbox photos={req.cargo_photos} />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-xl gap-2"
                  onClick={() => acceptMutation.mutate(req.id)}
                  disabled={acceptMutation.isPending || isUnavailable}
                >
                  <Check className="w-4 h-4" /> Aceptar servicio
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
