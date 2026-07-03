"use client";

import { useAdminGuard } from "@/lib/useAdminGuard";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useTariffs } from "@/lib/tariffs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Euro, Download, Banknote, CreditCard } from "lucide-react";
import { startOfWeek, startOfMonth, isAfter, format } from "date-fns";
import { es } from "date-fns/locale";

// Descarga un CSV apto para Excel en español (BOM + punto y coma).
function downloadCsv(filename, rows) {
  const csv = "﻿" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AdminFinance() {
  const canRender = useAdminGuard();
  const tariffs = useTariffs();
  const [period, setPeriod] = useState("month");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders-finance"],
    queryFn: () => base44.entities.TransportRequest.filter({ status: "delivered" }, "-delivery_time", 1000),
  });

  if (!canRender) return null;

  const now = new Date();
  const from = period === "week" ? startOfWeek(now, { weekStartsOn: 1 })
    : period === "month" ? startOfMonth(now)
    : null;
  const delivered = orders.filter(o => {
    const d = o.delivery_time || o.updated_date || o.created_date;
    return d && (!from || isAfter(new Date(d), from));
  });

  const commissionPct = (tariffs.commission_pct ?? 15) / 100;
  const price = (o) => Number(o.final_price || o.estimated_price || 0);

  // Liquidación por conductor:
  //  · efectivo: lo cobró el conductor → debe la comisión a la empresa
  //  · tarjeta: lo cobró la empresa → debe su parte al conductor
  //  · neto = tarjeta·(1−c) − efectivo·c  (positivo = pagar al conductor)
  const byDriver = {};
  for (const o of delivered) {
    const key = o.driver_name || "Sin conductor";
    byDriver[key] ??= { trips: 0, total: 0, cash: 0, card: 0 };
    const b = byDriver[key];
    b.trips += 1;
    b.total += price(o);
    if (o.payment_method === "card") b.card += price(o);
    else b.cash += price(o);
  }
  const rows = Object.entries(byDriver).map(([driver, b]) => ({
    driver,
    ...b,
    driverShare: b.total * (1 - commissionPct),
    commission: b.total * commissionPct,
    net: b.card * (1 - commissionPct) - b.cash * commissionPct,
  }));
  const totals = rows.reduce(
    (a, r) => ({ trips: a.trips + r.trips, total: a.total + r.total, cash: a.cash + r.cash, card: a.card + r.card, commission: a.commission + r.commission }),
    { trips: 0, total: 0, cash: 0, card: 0, commission: 0 }
  );

  const periodLabel = period === "week" ? "esta semana" : period === "month" ? "este mes" : "histórico completo";

  const exportSettlements = () => {
    downloadCsv(`liquidaciones-${period}-${format(now, "yyyy-MM-dd")}.csv`, [
      ["Conductor", "Entregas", "Facturado €", "Efectivo €", "Tarjeta €", `Parte conductor (${100 - commissionPct * 100}%) €`, `Comisión (${commissionPct * 100}%) €`, "Neto a liquidar €"],
      ...rows.map(r => [r.driver, r.trips, r.total.toFixed(2), r.cash.toFixed(2), r.card.toFixed(2), r.driverShare.toFixed(2), r.commission.toFixed(2), r.net.toFixed(2)]),
    ]);
  };

  const exportOrders = () => {
    downloadCsv(`pedidos-${period}-${format(now, "yyyy-MM-dd")}.csv`, [
      ["Fecha entrega", "Cliente", "Teléfono", "Conductor", "Origen", "Destino", "Vehículo", "Precio €", "Método", "Estado pago"],
      ...delivered.map(o => [
        o.delivery_time ? format(new Date(o.delivery_time), "dd/MM/yyyy HH:mm") : "",
        o.client_name, o.client_phone, o.driver_name,
        o.origin_address, o.destination_address, o.vehicle_type,
        price(o).toFixed(2),
        o.payment_method === "card" ? "tarjeta" : "efectivo",
        o.payment_status === "paid" ? "pagado" : "pendiente",
      ]),
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Euro className="w-6 h-6 text-primary" /> Finanzas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Liquidaciones por conductor · entregas de {periodLabel}</p>
        </div>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="bg-muted rounded-xl">
            <TabsTrigger value="week" className="rounded-lg text-xs">Semana</TabsTrigger>
            <TabsTrigger value="month" className="rounded-lg text-xs">Mes</TabsTrigger>
            <TabsTrigger value="all" className="rounded-lg text-xs">Todo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Facturado</p>
          <p className="text-2xl font-display font-bold text-foreground">{totals.total.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">{totals.trips} entregas</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> Efectivo</p>
          <p className="text-2xl font-display font-bold text-foreground">{totals.cash.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">lo tienen los conductores</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Tarjeta</p>
          <p className="text-2xl font-display font-bold text-foreground">{totals.card.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">lo tiene la empresa</p>
        </div>
        <div className="bg-card rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Comisión empresa</p>
          <p className="text-2xl font-display font-bold text-primary">{totals.commission.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">{(commissionPct * 100).toFixed(0)}% del facturado</p>
        </div>
      </div>

      {/* Liquidaciones */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-3">Conductor</th>
              <th className="p-3 text-right">Entregas</th>
              <th className="p-3 text-right">Facturado</th>
              <th className="p-3 text-right">Efectivo</th>
              <th className="p-3 text-right">Tarjeta</th>
              <th className="p-3 text-right">Parte conductor</th>
              <th className="p-3 text-right">Comisión</th>
              <th className="p-3 text-right">Neto a liquidar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.driver} className="border-b border-border last:border-0">
                <td className="p-3 font-medium text-foreground">{r.driver}</td>
                <td className="p-3 text-right">{r.trips}</td>
                <td className="p-3 text-right">{r.total.toFixed(2)}€</td>
                <td className="p-3 text-right">{r.cash.toFixed(2)}€</td>
                <td className="p-3 text-right">{r.card.toFixed(2)}€</td>
                <td className="p-3 text-right">{r.driverShare.toFixed(2)}€</td>
                <td className="p-3 text-right text-primary">{r.commission.toFixed(2)}€</td>
                <td className={`p-3 text-right font-semibold ${r.net >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {r.net >= 0 ? "Pagarle " : "Nos debe "}{Math.abs(r.net).toFixed(2)}€
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin entregas en {periodLabel}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Efectivo: lo cobra el conductor y debe la comisión a la empresa. Tarjeta: lo cobra la empresa y debe su parte al conductor.
        El neto compensa ambas cosas (verde = pagar al conductor, ámbar = el conductor debe a la empresa).
      </p>

      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" className="rounded-xl gap-2" onClick={exportSettlements} disabled={rows.length === 0}>
          <Download className="w-4 h-4" /> Exportar liquidaciones (CSV)
        </Button>
        <Button variant="outline" className="rounded-xl gap-2" onClick={exportOrders} disabled={delivered.length === 0}>
          <Download className="w-4 h-4" /> Exportar pedidos (CSV)
        </Button>
      </div>
    </div>
  );
}
