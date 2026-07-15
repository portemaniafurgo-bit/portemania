"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatusBadge from "@/components/common/StatusBadge";
import RatingStars from "@/components/common/RatingStars";
import { vehicleData } from "@/components/common/VehicleCard";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTariffs } from "@/lib/tariffs";

export default function DriverHistory() {
  const { user } = useAuth();
  const tariffs = useTariffs();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["driver-history", user?.id],
    queryFn: () => base44.entities.TransportRequest.filter({ driver_id: user?.id }, "-created_date", 50),
  });

  // Parte del conductor = 100% - comisión de la plataforma (misma fórmula que Ganancias)
  const driverShare = (100 - (tariffs.commission_pct ?? 15)) / 100;

  const completed = jobs.filter(j => j.status === "delivered");

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Historial de servicios</h1>

      {completed.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-3">Sin servicios completados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completed.map(job => (
            <Link key={job.id} href={`/driver/job/${job.id}`}>
              <div className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-all mb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{job.service_type === "package" ? "📦" : vehicleData[job.vehicle_type]?.icon}</span>
                    <div>
                      <p className="font-medium text-sm text-foreground truncate max-w-[200px]">{job.destination_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.created_date && format(new Date(job.created_date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-foreground">
                    {((job.final_price || job.estimated_price || 0) * driverShare).toFixed(2)}€
                  </span>
                </div>
                {job.client_rating && (
                  <div className="mt-2 flex items-center gap-2">
                    <RatingStars rating={job.client_rating} size="small" />
                    {job.client_review && <span className="text-xs text-muted-foreground truncate">{job.client_review}</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
