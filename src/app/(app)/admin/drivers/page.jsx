"use client";

import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/common/StatusBadge";
import RatingStars from "@/components/common/RatingStars";
import { vehicleData } from "@/components/common/VehicleCard";
import { Search, Check, X, Shield } from "lucide-react";
import { useState } from "react";

export default function AdminDrivers() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => base44.entities.DriverProfile.list("-created_date", 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DriverProfile.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] }),
  });

  const filtered = drivers.filter(d =>
    (d.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.city || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Conductores</h1>
        <span className="text-sm text-muted-foreground">{drivers.length} registrados</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conductor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(driver => (
          <div key={driver.id} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {driver.full_name?.[0]?.toUpperCase() || "D"}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{driver.full_name}</p>
                  <p className="text-sm text-muted-foreground">{driver.city} · {driver.phone}</p>
                </div>
              </div>
              <StatusBadge status={driver.status} />
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Vehículo</p>
                <p className="font-medium text-foreground">
                  {vehicleData[driver.vehicle_type]?.icon} {driver.vehicle_brand} {driver.vehicle_model}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Matrícula</p>
                <p className="font-medium text-foreground">{driver.vehicle_plate || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Viajes</p>
                <p className="font-medium text-foreground">{driver.total_trips || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Valoración</p>
                <RatingStars rating={driver.average_rating || 5} size="small" showValue />
              </div>
            </div>

            {/* Documents status */}
            <div className="mt-3 flex flex-wrap gap-2">
              {["license_photo_url", "id_document_url", "vehicle_photo_url", "insurance_url"].map(doc => (
                <span key={doc} className={`text-xs px-2 py-1 rounded-lg ${driver[doc] ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {doc === "license_photo_url" ? "Licencia" : doc === "id_document_url" ? "DNI" : doc === "vehicle_photo_url" ? "Vehículo" : "Seguro"}
                  {driver[doc] ? " ✓" : " ✗"}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              {driver.status === "pending_verification" && (
                <>
                  <Button
                    size="sm"
                    className="rounded-xl gap-1"
                    onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "verified" } })}
                  >
                    <Check className="w-3 h-3" /> Verificar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1 border-destructive/30 text-destructive"
                    onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "rejected" } })}
                  >
                    <X className="w-3 h-3" /> Rechazar
                  </Button>
                </>
              )}
              {driver.status === "verified" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1"
                  onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "suspended" } })}
                >
                  Suspender
                </Button>
              )}
              {driver.status === "suspended" && (
                <Button
                  size="sm"
                  className="rounded-xl gap-1"
                  onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "verified" } })}
                >
                  <Shield className="w-3 h-3" /> Reactivar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
