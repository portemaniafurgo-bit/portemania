"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/common/StatsCard";
import { DollarSign, TrendingUp, Truck, Calendar } from "lucide-react";
import { format, startOfMonth, startOfWeek, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useTariffs } from "@/lib/tariffs";

export default function DriverEarnings() {
  const { user } = useAuth();
  const tariffs = useTariffs();

  const { data: jobs = [] } = useQuery({
    queryKey: ["driver-earnings", user?.id],
    queryFn: () => base44.entities.TransportRequest.filter({ driver_id: user?.id, status: "delivered" }, "-created_date", 100),
  });

  // Parte del conductor = 100% - comisión de la plataforma (editable en Ajustes del admin)
  const commission = (100 - (tariffs.commission_pct ?? 15)) / 100;
  const totalEarnings = jobs.reduce((acc, j) => acc + (j.final_price || j.estimated_price || 0) * commission, 0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());
  const weekEarnings = jobs
    .filter(j => j.created_date && isAfter(new Date(j.created_date), weekStart))
    .reduce((acc, j) => acc + (j.final_price || j.estimated_price || 0) * commission, 0);
  const monthEarnings = jobs
    .filter(j => j.created_date && isAfter(new Date(j.created_date), monthStart))
    .reduce((acc, j) => acc + (j.final_price || j.estimated_price || 0) * commission, 0);

  // Build chart data - last 7 days
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStr = format(date, "yyyy-MM-dd");
    const dayEarnings = jobs
      .filter(j => j.created_date && format(new Date(j.created_date), "yyyy-MM-dd") === dayStr)
      .reduce((acc, j) => acc + (j.final_price || j.estimated_price || 0) * commission, 0);
    chartData.push({
      day: format(date, "EEE", { locale: es }),
      earnings: Math.round(dayEarnings),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Ganancias</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard title="Total" value={`${totalEarnings.toFixed(0)}€`} icon={DollarSign} />
        <StatsCard title="Este mes" value={`${monthEarnings.toFixed(0)}€`} icon={Calendar} />
        <StatsCard title="Esta semana" value={`${weekEarnings.toFixed(0)}€`} icon={TrendingUp} />
        <StatsCard title="Servicios" value={jobs.length} icon={Truck} />
      </div>

      {/* Chart */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-heading font-semibold text-foreground mb-4">Últimos 7 días</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} className="text-xs" />
              <YAxis axisLine={false} tickLine={false} className="text-xs" />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                formatter={(value) => [`${value}€`, "Ganancias"]}
              />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Commission info */}
      <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 text-sm text-muted-foreground">
        <p>💡 Recibes el <span className="font-bold text-foreground">{100 - (tariffs.commission_pct ?? 15)}%</span> de cada servicio. La comisión de plataforma es del {tariffs.commission_pct ?? 15}%.</p>
      </div>
    </div>
  );
}
