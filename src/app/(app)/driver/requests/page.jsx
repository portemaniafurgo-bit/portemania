"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { vehicleData } from "@/components/common/VehicleCard";
import { Check, MapPin, Package, Loader2 } from "lucide-react";
import PhotoLightbox from "@/components/common/PhotoLightbox";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function DriverRequests() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pending-requests"],
    queryFn: () => base44.entities.TransportRequest.filter({ status: "pending" }, "-created_date", 20),
    refetchInterval: 10000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (requestId) => {
      await base44.entities.TransportRequest.update(requestId, {
        status: "accepted",
        driver_id: user?.id,
        driver_name: user?.full_name || "Conductor",
      });

      // Obtener datos del pedido para el email
      const req = requests.find(r => r.id === requestId);
      if (req && user?.email) {
        const vehicle = vehicleData[req.vehicle_type];
        await base44.integrations.Core.SendEmail({
          to: user.email,
          from_name: "PorteManía",
          subject: "🚐 Nuevo trabajo asignado",
          body: `Hola ${user?.full_name?.split(" ")[0] || "conductor"},\n\nSe te ha asignado un nuevo servicio de transporte.\n\n📍 Recogida: ${req.origin_address}\n🏁 Entrega: ${req.destination_address}\n🚐 Vehículo: ${vehicle?.name || req.vehicle_type}\n💶 Precio estimado: ${req.estimated_price?.toFixed(2)}€${req.cargo_description ? `\n📦 Carga: ${req.cargo_description}` : ""}${req.distance_km ? `\n📏 Distancia: ${req.distance_km} km` : ""}\n\nAccede a la app para ver todos los detalles y gestionar el servicio.\n\n¡Mucho éxito!\nEl equipo de PorteManía`,
        });
      }

      return requestId;
    },
    onSuccess: (requestId) => {
      queryClient.invalidateQueries({ queryKey: ["pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["driver-jobs"] });
      router.push(`/driver/job/${requestId}`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
                  <span className="text-2xl">{vehicleData[req.vehicle_type]?.icon}</span>
                  <span className="font-semibold text-foreground">{vehicleData[req.vehicle_type]?.name}</span>
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
                  disabled={acceptMutation.isPending}
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
