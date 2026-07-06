"use client";

import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminGuard } from "@/lib/useAdminGuard";

export default function AdminOrders() {
  const canRender = useAdminGuard({ allowStaff: true });
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders-list"],
    queryFn: () => base44.entities.TransportRequest.list("-created_date", 200),
  });

  if (!canRender) return null;

  const filtered = orders
    .filter(o => tab === "all" || o.status === tab)
    .filter(o =>
      (o.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.client_phone || "").includes(search) ||
      (o.driver_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.origin_address || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.destination_address || "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Pedidos</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted rounded-xl flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="rounded-lg text-xs">Todos</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg text-xs">Pendientes</TabsTrigger>
          <TabsTrigger value="accepted" className="rounded-lg text-xs">Aceptados</TabsTrigger>
          <TabsTrigger value="in_transit" className="rounded-lg text-xs">En tránsito</TabsTrigger>
          <TabsTrigger value="delivered" className="rounded-lg text-xs">Entregados</TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg text-xs">Cancelados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por cliente, teléfono, conductor o dirección..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Conductor</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(order => (
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                <TableCell className="font-medium">
                  <span className="mr-1">{vehicleData[order.vehicle_type]?.icon}</span>
                  {order.client_name || "—"}
                </TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">{order.origin_address}</TableCell>
                <TableCell className="text-sm max-w-[150px] truncate">{order.destination_address}</TableCell>
                <TableCell className="text-sm">{order.driver_name || <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                <TableCell className="font-medium">{(order.final_price || order.estimated_price)?.toFixed(2)}€</TableCell>
                <TableCell className="text-sm">
                  <span className={order.payment_status === "paid" ? "text-emerald-600 font-medium" : "text-amber-600"}>
                    {order.payment_status === "paid" ? "Pagado" : "Pendiente"}
                  </span>
                  <span className="text-muted-foreground"> · {order.payment_method === "card" ? "tarjeta" : "efectivo"}</span>
                </TableCell>
                <TableCell><StatusBadge status={order.status} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {order.created_date && format(new Date(order.created_date), "dd/MM/yy", { locale: es })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
