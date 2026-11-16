"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminPayouts from "@/components/partners/admin/AdminPayouts";
import AdminPartners from "@/components/partners/admin/AdminPartners";
import AdminProgramSettings from "@/components/partners/admin/AdminProgramSettings";

/** Comerciales (ClicyVoy Partners): cobros, comerciales y ajustes. Solo admin. */
export default function AdminPartnersPage() {
  const canRender = useAdminGuard();
  const [tab, setTab] = useState("payouts");

  if (!canRender) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Handshake className="w-6 h-6 text-primary" /> Comerciales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitudes de cobro, comerciales y reglas del programa.
          </p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted rounded-xl">
            <TabsTrigger value="payouts" className="rounded-lg text-xs">Solicitudes de cobro</TabsTrigger>
            <TabsTrigger value="partners" className="rounded-lg text-xs">Comerciales</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg text-xs">Ajustes del programa</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "payouts" && <AdminPayouts />}
      {tab === "partners" && <AdminPartners />}
      {tab === "settings" && <AdminProgramSettings />}
    </div>
  );
}
