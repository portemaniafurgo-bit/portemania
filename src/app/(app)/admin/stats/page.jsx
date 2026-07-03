"use client";

import { useAdminGuard } from "@/lib/useAdminGuard";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { vehicleData } from "@/components/common/VehicleCard";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const CPS = ["02001", "02002", "02003", "02004", "02005", "02006", "02007", "02008"];
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function extractCP(address) {
  const m = (address || "").match(/\b0200[1-8]\b/);
  return m ? m[0] : null;
}

function Panel({ title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h2 className="font-semibold text-sm text-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminStats() {
  const canRender = useAdminGuard();
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders-stats"],
    queryFn: () => base44.entities.TransportRequest.list("-created_date", 1000),
  });

  // Por zona (CP de recogida)
  const byCP = CPS.map(cp => ({
    name: cp,
    pedidos: orders.filter(o => extractCP(o.origin_address) === cp).length,
  }));
  const noCP = orders.filter(o => !extractCP(o.origin_address)).length;

  // Por hora del día
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    name: `${h}h`,
    pedidos: orders.filter(o => o.created_date && new Date(o.created_date).getHours() === h).length,
  }));

  // Por día de la semana (getDay: 0=domingo)
  const byDay = DAYS.map((d, i) => ({
    name: d,
    pedidos: orders.filter(o => o.created_date && (new Date(o.created_date).getDay() + 6) % 7 === i).length,
  }));

  // Por furgoneta
  const byVehicle = Object.keys(vehicleData).map(v => ({
    name: vehicleData[v].name.replace("Furgoneta ", ""),
    pedidos: orders.filter(o => o.vehicle_type === v).length,
  }));

  if (!canRender) return null;

  const chart = (data) => (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
        <Tooltip />
        <Bar dataKey="pedidos" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Estadísticas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orders.length} pedidos analizados — dónde y cuándo hay demanda
        </p>
      </div>

      <Panel title="Pedidos por zona (código postal de recogida)">
        {chart(byCP)}
        {noCP > 0 && <p className="text-xs text-muted-foreground mt-2">{noCP} pedido(s) sin CP detectable en la dirección.</p>}
      </Panel>

      <Panel title="Horas punta (hora de creación del pedido)">
        {chart(byHour)}
      </Panel>

      <div className="grid sm:grid-cols-2 gap-6">
        <Panel title="Por día de la semana">{chart(byDay)}</Panel>
        <Panel title="Por tipo de furgoneta">{chart(byVehicle)}</Panel>
      </div>
    </div>
  );
}
