"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Percent, CreditCard, Globe } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Configuración</h1>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Comisiones
        </h3>
        <div className="space-y-2">
          <Label>Comisión por servicio (%)</Label>
          <Input type="number" defaultValue="15" className="rounded-xl" disabled />
          <p className="text-xs text-muted-foreground">Porcentaje que retiene la plataforma por cada servicio</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Precios base
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Furgoneta pequeña</Label>
            <Input type="number" defaultValue="25" className="rounded-xl" disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Furgoneta mediana</Label>
            <Input type="number" defaultValue="45" className="rounded-xl" disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Furgoneta grande</Label>
            <Input type="number" defaultValue="70" className="rounded-xl" disabled />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Camión ligero</Label>
            <Input type="number" defaultValue="100" className="rounded-xl" disabled />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Zonas de operación
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>🇪🇸 España — Activo</p>
          <p>🇵🇹 Portugal — Próximamente</p>
          <p>🇫🇷 Francia — Próximamente</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Los cambios de configuración se aplican globalmente. Contacta con soporte para modificaciones avanzadas.
      </p>
    </div>
  );
}
