"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight, Clock, CheckCircle2, Truck } from "lucide-react";
import StatsCard from "@/components/common/StatsCard";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // El dashboard es el aterrizaje por defecto (login con Google incluido):
  // conductor y admin van a su panel — el nav de cliente no tiene enlaces
  // de vuelta a /driver ni /admin.
  const roleHome =
    user?.role === "driver" ? "/driver"
    : user?.role === "admin" || user?.role === "staff" ? "/admin"
    : null;
  useEffect(() => {
    if (roleHome) router.replace(roleHome);
  }, [roleHome, router]);

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => base44.entities.TransportRequest.filter({ created_by_id: user?.id }, "-created_date", 10),
    enabled: !roleHome,
  });

  const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "delivered");
  const totalSpent = completedOrders.reduce((acc, o) => acc + (o.final_price || o.estimated_price || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl font-display font-bold text-foreground"
        >
          ¡Hola, {user?.full_name?.split(" ")[0] || "Usuario"}! 👋
        </motion.h1>
        <p className="text-muted-foreground mt-1">¿Qué necesitas transportar hoy?</p>
      </div>

      {/* Quick action */}
      <Link href="/new-request">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white relative overflow-hidden group hover:shadow-xl transition-shadow cursor-pointer"
        >
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
          <div className="absolute right-8 bottom-0 w-20 h-20 bg-white/5 rounded-full -mb-6" />
          <div className="relative z-10">
            <h2 className="text-xl font-heading font-bold">Solicitar transporte</h2>
            <p className="text-white/80 mt-1 text-sm">Furgonetas disponibles cerca de ti</p>
            <div className="flex items-center gap-2 mt-4 text-sm font-semibold">
              <span>Empezar ahora</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatsCard title="Activos" value={activeOrders.length} icon={Truck} />
        <StatsCard title="Completados" value={completedOrders.length} icon={CheckCircle2} />
        <StatsCard title="Total gastado" value={`${totalSpent.toFixed(0)}€`} icon={Package} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Servicios activos</h2>
          <div className="space-y-3">
            {activeOrders.map(order => (
              <Link key={order.id} href={`/order/${order.id}`}>
                <div className="bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{vehicleData[order.vehicle_type]?.icon || "🚐"}</div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{order.origin_address}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">→ {order.destination_address}</p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {order.created_date && format(new Date(order.created_date), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <span className="font-semibold text-foreground">{order.estimated_price?.toFixed(2)}€</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      {completedOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg text-foreground">Historial reciente</h2>
            <Link href="/my-orders" className="text-primary text-sm font-medium hover:underline">
              Ver todo
            </Link>
          </div>
          <div className="space-y-3">
            {completedOrders.slice(0, 3).map(order => (
              <div key={order.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{vehicleData[order.vehicle_type]?.icon || "🚐"}</div>
                    <div>
                      <p className="font-medium text-foreground text-sm truncate max-w-[200px]">{order.destination_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.created_date && format(new Date(order.created_date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-foreground">{(order.final_price || order.estimated_price)?.toFixed(2)}€</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="font-heading font-semibold text-foreground">Sin pedidos aún</h3>
          <p className="text-muted-foreground text-sm mt-1">¡Solicita tu primer transporte!</p>
        </div>
      )}
    </div>
  );
}
