import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Package } from "lucide-react";

export default function MyOrders() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => base44.entities.TransportRequest.filter({ created_by_id: user?.id }, "-created_date", 50),
  });

  const filtered = tab === "all" ? orders
    : tab === "active" ? orders.filter(o => !["delivered", "cancelled"].includes(o.status))
    : orders.filter(o => o.status === tab);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Mis pedidos</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted rounded-xl">
          <TabsTrigger value="all" className="rounded-lg text-xs">Todos</TabsTrigger>
          <TabsTrigger value="active" className="rounded-lg text-xs">Activos</TabsTrigger>
          <TabsTrigger value="delivered" className="rounded-lg text-xs">Entregados</TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg text-xs">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-3">No hay pedidos en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <Link key={order.id} to={`/order/${order.id}`}>
              <div className="bg-card rounded-2xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all mb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl flex-shrink-0">{vehicleData[order.vehicle_type]?.icon || "🚐"}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{order.origin_address}</p>
                      <p className="text-xs text-muted-foreground truncate">→ {order.destination_address}</p>
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {order.created_date && format(new Date(order.created_date), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                  <span className="font-semibold text-foreground">
                    {(order.final_price || order.estimated_price)?.toFixed(2)}€
                  </span>
                </div>
                {order.driver_name && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {order.driver_name[0]}
                    </div>
                    {order.driver_name}
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