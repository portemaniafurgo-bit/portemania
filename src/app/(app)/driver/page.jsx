"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import StatsCard from "@/components/common/StatsCard";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { Truck, DollarSign, Star, Clock, MapPin, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchMyDriverProfile } from "@/lib/driverProfile";

export default function DriverDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["driver-profile", user?.id],
    queryFn: () => fetchMyDriverProfile(user),
    enabled: !!user?.id,
  });

  const { data: myJobs = [] } = useQuery({
    queryKey: ["driver-jobs"],
    queryFn: () => base44.entities.TransportRequest.filter({ driver_id: user?.id }, "-created_date", 20),
  });

  const { data: allPending = [] } = useQuery({
    queryKey: ["pending-requests"],
    queryFn: () => base44.entities.TransportRequest.filter({ status: "pending" }, "-created_date", 10),
    refetchInterval: 10000,
  });

  // Mismo reparto que en Solicitudes: los pedidos de furgoneta grande solo
  // los ven conductores con furgón grande (así el contador siempre coincide).
  const pendingRequests = allPending.filter(
    r => r.vehicle_type !== "large" || profile?.vehicle_type === "large"
  );

  const toggleAvailability = useMutation({
    mutationFn: async () => {
      if (profile) {
        await base44.entities.DriverProfile.update(profile.id, { is_available: !profile.is_available });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["driver-profile"] }),
  });

  const activeJobs = myJobs.filter(j => !["delivered", "cancelled"].includes(j.status));
  const completedJobs = myJobs.filter(j => j.status === "delivered");
  const totalEarnings = completedJobs.reduce((acc, j) => acc + (j.final_price || j.estimated_price || 0) * 0.85, 0);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="text-6xl">🚫</div>
        <h2 className="text-xl font-display font-bold text-foreground">Cuenta desactivada</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu cuenta de conductor ha sido eliminada o desactivada por el administrador. Si crees que es un error, contacta con ClicyVoy.
        </p>
        <p className="text-xs text-muted-foreground bg-muted rounded-xl px-4 py-3">
          📞 Contacta con el administrador para recuperar el acceso.
        </p>
      </div>
    );
  }

  // Verificar si el perfil está incompleto (falta info obligatoria)
  const profileIncomplete =
    !profile.photo_url ||
    !profile.vehicle_photo_front_url ||
    !profile.vehicle_photo_rear_url ||
    !profile.vehicle_photo_left_url ||
    !profile.vehicle_photo_right_url ||
    !profile.license_photo_url ||
    !profile.vehicle_plate ||
    !profile.vehicle_brand ||
    !profile.autonomo_receipt_url ||
    !profile.censal_document_url;

  if (profileIncomplete) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-6">
        <div className="text-center space-y-3">
          <div className="text-6xl">📋</div>
          <h2 className="text-xl font-display font-bold text-foreground">Completa tu perfil</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Antes de poder recibir y aceptar trabajos, necesitas completar tu perfil con toda la documentación requerida.
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground mb-2">Documentación pendiente:</p>
          {[
            { label: "Foto de tu cara (selfie)", done: !!profile.photo_url },
            { label: "Foto del carnet de conducir", done: !!profile.license_photo_url },
            { label: "Foto vehículo delantera", done: !!profile.vehicle_photo_front_url },
            { label: "Foto vehículo trasera", done: !!profile.vehicle_photo_rear_url },
            { label: "Foto vehículo izquierda", done: !!profile.vehicle_photo_left_url },
            { label: "Foto vehículo derecha", done: !!profile.vehicle_photo_right_url },
            { label: "Marca y matrícula del vehículo", done: !!(profile.vehicle_brand && profile.vehicle_plate) },
            { label: "Recibo de autónomo", done: !!profile.autonomo_receipt_url },
            { label: "Situación censal (Hacienda)", done: !!profile.censal_document_url },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={item.done ? "text-emerald-500" : "text-amber-500"}>{item.done ? "✅" : "⚠️"}</span>
              <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>

        <Link href="/driver/profile">
          <Button className="w-full h-12 rounded-xl gap-2">
            Completar mi perfil →
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with availability toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Panel del conductor</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.is_available ? "🟢 Disponible" : "🔴 No disponible"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="rounded-xl gap-2">
              <ShieldCheck className="w-4 h-4" />
              Admin
            </Button>
          </Link>
          <Switch
            checked={profile?.is_available || false}
            onCheckedChange={() => toggleAvailability.mutate()}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard title="Viajes hoy" value={activeJobs.length} icon={Truck} />
        <StatsCard title="Completados" value={completedJobs.length} icon={Clock} />
        <StatsCard title="Ganancias" value={`${totalEarnings.toFixed(0)}€`} icon={DollarSign} />
        <StatsCard title="Valoración" value={profile?.average_rating?.toFixed(1) || "5.0"} icon={Star} />
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg mb-3">Servicios activos</h2>
          <div className="space-y-3">
            {activeJobs.map(job => (
              <Link key={job.id} href={`/driver/job/${job.id}`}>
                <div className="bg-card rounded-2xl border-2 border-primary/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{vehicleData[job.vehicle_type]?.icon}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <span className="font-bold text-foreground">{job.estimated_price?.toFixed(2)}€</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      {job.origin_address}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      {job.destination_address}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests nearby */}
      {profile?.is_available && pendingRequests.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg mb-3">
            Solicitudes disponibles ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map(req => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-2xl border border-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{vehicleData[req.vehicle_type]?.icon}</span>
                    <span className="text-sm font-medium text-foreground">{vehicleData[req.vehicle_type]?.name}</span>
                  </div>
                  <span className="font-bold text-lg text-primary">{req.estimated_price?.toFixed(2)}€</span>
                </div>
                <div className="space-y-1 text-sm mb-3">
                  <p className="text-foreground">{req.origin_address}</p>
                  <p className="text-muted-foreground">→ {req.destination_address}</p>
                </div>
                {req.cargo_description && (
                  <p className="text-xs text-muted-foreground mb-3">📦 {req.cargo_description}</p>
                )}
                <Link href={`/driver/requests`}>
                  <Button className="w-full rounded-xl" size="sm">
                    Ver detalles
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
