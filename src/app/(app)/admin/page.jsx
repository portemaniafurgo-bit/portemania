"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useTariffs } from "@/lib/tariffs";
import AdminLiveMap from "@/components/admin/AdminLiveMap";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import {
  LayoutDashboard, AlertTriangle, Truck, Euro, Star, PackageOpen, ArrowRight,
} from "lucide-react";
import { format, isAfter, startOfDay, startOfMonth, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";
const PENDING_ALERT_MIN = 10;

function Kpi({ icon: Icon, label, value, sub, alert }) {
  return (
    <div className={`bg-card rounded-2xl border p-4 ${alert ? "border-red-300 bg-red-50" : "border-border"}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`w-3.5 h-3.5 ${alert ? "text-red-500" : "text-primary"}`} />
        {label}
      </div>
      <p className={`text-2xl font-display font-bold mt-1 ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${alert ? "text-red-600" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const tariffs = useTariffs();

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => base44.entities.TransportRequest.list("-created_date", 500),
    refetchInterval: 15000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => base44.entities.DriverProfile.list("-created_date", 200),
    refetchInterval: 15000,
  });

  const isUnauthorized = user && user.email !== ADMIN_EMAIL && user.role !== "admin";
  useEffect(() => {
    if (isUnauthorized) router.replace("/dashboard");
  }, [isUnauthorized, router]);
  if (isUnauthorized) return null;

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);

  const ordersToday = orders.filter(o => o.created_date && isAfter(new Date(o.created_date), today));
  const pendingOrders = orders.filter(o => o.status === "pending");
  const oldestPendingMin = pendingOrders.length
    ? Math.max(...pendingOrders.map(o => differenceInMinutes(now, new Date(o.created_date))))
    : 0;
  const activeOrders = orders.filter(o => ["accepted", "in_transit", "picked_up"].includes(o.status));
  const deliveredMonth = orders.filter(
    o => o.status === "delivered" && o.delivery_time && isAfter(new Date(o.delivery_time), monthStart)
  );
  const revenueMonth = deliveredMonth.reduce((acc, o) => acc + (o.final_price || o.estimated_price || 0), 0);
  const commissionMonth = revenueMonth * ((tariffs.commission_pct ?? 15) / 100);
  const rated = orders.filter(o => o.client_rating);
  const avgRating = rated.length
    ? (rated.reduce((acc, o) => acc + Number(o.client_rating), 0) / rated.length).toFixed(1)
    : "—";
  const availableDrivers = drivers.filter(d => d.status === "verified" && d.is_available);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" /> Operación
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estado del negocio en tiempo real · se actualiza cada 15 s
        </p>
      </div>

      {/* Alerta: pedidos sin aceptar */}
      {pendingOrders.length > 0 && oldestPendingMin >= PENDING_ALERT_MIN && (
        <Link href="/admin/orders" className="block">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-300 hover:bg-red-100 transition-colors">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              <strong>{pendingOrders.length} pedido{pendingOrders.length === 1 ? "" : "s"} sin aceptar</strong> — el más antiguo lleva {oldestPendingMin} min esperando conductor.
            </p>
            <ArrowRight className="w-4 h-4 text-red-500 ml-auto flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Kpi icon={PackageOpen} label="Pedidos hoy" value={ordersToday.length} sub={`${activeOrders.length} en curso ahora`} />
        <Kpi
          icon={AlertTriangle}
          label="Sin aceptar"
          value={pendingOrders.length}
          sub={pendingOrders.length ? `el más antiguo: ${oldestPendingMin} min` : "todo asignado"}
          alert={oldestPendingMin >= PENDING_ALERT_MIN}
        />
        <Kpi icon={Truck} label="Conductores disponibles" value={availableDrivers.length} sub={`de ${drivers.filter(d => d.status === "verified").length} verificados`} />
        <Kpi icon={Euro} label="Facturado este mes" value={`${revenueMonth.toFixed(0)}€`} sub={`${deliveredMonth.length} entregas`} />
        <Kpi icon={Euro} label="Comisión plataforma" value={`${commissionMonth.toFixed(0)}€`} sub={`${tariffs.commission_pct ?? 15}% del facturado`} />
        <Kpi icon={Star} label="Valoración media" value={avgRating} sub={`${rated.length} valoraciones`} />
      </div>

      {/* Mapa en vivo */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-foreground">Flota en vivo</h2>
        <AdminLiveMap drivers={drivers} />
      </div>

      {/* Últimos pedidos */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Últimos pedidos</h2>
          <Link href="/admin/orders" className="text-sm text-primary flex items-center gap-1">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {orders.slice(0, 5).map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="block">
              <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
                <span className="text-xl flex-shrink-0">{vehicleData[o.vehicle_type]?.icon || "🚐"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {o.client_name || "—"} · {(o.final_price || o.estimated_price)?.toFixed(0)}€
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {o.origin_address} → {o.destination_address}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <StatusBadge status={o.status} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {o.created_date && format(new Date(o.created_date), "d MMM, HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Todavía no hay pedidos.</p>
          )}
        </div>
      </div>
    </div>
  );
}
