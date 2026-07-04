"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/entities";
import { DEFAULT_TARIFFS, fetchTariffs } from "@/lib/tariffs";
import { vehicleData } from "@/components/common/VehicleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, CreditCard, Globe, Loader2, Save } from "lucide-react";
import { useAdminGuard } from "@/lib/useAdminGuard";

const FIELDS = [
  { key: "small", label: `${vehicleData.small.name} (base 2h, €)` },
  { key: "large", label: `${vehicleData.large.name} (base 2h, €)` },
  { key: "extra_hour", label: "Hora extra (€)" },
  { key: "insurance", label: "Seguro de mercancía (€)" },
  { key: "help_price", label: "Ayuda del conductor (€)" },
];

export default function AdminSettings() {
  const canRender = useAdminGuard();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const { data: tariffs } = useQuery({ queryKey: ["tariffs"], queryFn: fetchTariffs });

  // Cargar tarifas al formulario cuando llegan (patrón intencionado servidor->form)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (tariffs && !form) setForm({ ...tariffs });
  }, [tariffs, form]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value === "" ? "" : Number(value) }));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const clean = { ...DEFAULT_TARIFFS };
      for (const k of Object.keys(clean)) {
        const v = Number(form[k]);
        if (!Number.isFinite(v) || v < 0) throw new Error(`Valor no válido en "${k}"`);
        clean[k] = v;
      }
      const { error } = await supabase
        .from("app_settings")
        .update({ value: clean })
        .eq("key", "tariffs");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setMessage({ ok: true, text: "Tarifas guardadas. Se aplican al momento en toda la app." });
    } catch (err) {
      setMessage({ ok: false, text: err.message || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  if (!canRender) return null;

  if (!form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Configuración</h1>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Tarifas
        </h3>
        <p className="text-xs text-muted-foreground">
          Estos precios se usan en la landing, en los formularios de solicitud y en el cálculo de cada pedido nuevo.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form[f.key]}
                onChange={e => update(f.key, e.target.value)}
                className="rounded-xl"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Comisión
        </h3>
        <div className="space-y-2">
          <Label>Comisión por servicio (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={form.commission_pct}
            onChange={e => update("commission_pct", e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Porcentaje que retiene la plataforma; el conductor recibe el {100 - (Number(form.commission_pct) || 0)}%.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm ${message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}

      <Button className="w-full h-12 rounded-xl gap-2" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar tarifas
      </Button>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Zona de operación
        </h3>
        <p className="text-sm text-muted-foreground">🇪🇸 Albacete capital (CP 02001–02008) — Activo</p>
      </div>
    </div>
  );
}
