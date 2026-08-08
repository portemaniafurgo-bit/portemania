"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/entities";
import { DEFAULT_TARIFFS, fetchTariffs } from "@/lib/tariffs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, Globe, Loader2, Save, Package, Home, Truck, Store } from "lucide-react";
import { useAdminGuard } from "@/lib/useAdminGuard";

/**
 * Tarifas por servicio. Lo que se guarda aquí es lo que cobran la web, el
 * asistente y el servidor: `app_settings.tariffs` es la única fuente de precios
 * y `compute_quote` (Supabase) lee de ella al crear cada pedido.
 */
const GROUPS = [
  {
    title: "Porte",
    icon: Truck,
    hint: "Servicio directo A→B a pie de calle, precio cerrado.",
    fields: [{ key: "porte_base", label: "Precio del porte (€)", step: "1" }],
  },
  {
    title: "Mini mudanza",
    icon: Home,
    hint: "Furgoneta grande con 2 horas incluidas. Las plantas solo se cobran si el cliente contrata la ayuda del conductor.",
    fields: [
      { key: "mudanza_base", label: "Precio base, 2 h incluidas (€)", step: "1" },
      { key: "mudanza_extra_hour", label: "Hora adicional (€)", step: "1" },
      { key: "mudanza_help", label: "Ayuda del conductor (€)", step: "1" },
      { key: "mudanza_floor", label: "Planta sin ascensor (€)", step: "1" },
      { key: "mudanza_stop", label: "Parada intermedia (€)", step: "1" },
    ],
  },
  {
    title: "Compra en tienda / portes para tiendas",
    icon: Store,
    hint: "Entrega con subida a domicilio si hay ascensor y firma del receptor.",
    fields: [{ key: "tienda_base", label: "Precio por servicio (€)", step: "1" }],
  },
  {
    title: "Envío de paquetes",
    icon: Package,
    hint: "Precio fijo por tramo de peso. Villarrobledo se entrega en 24 h con recogida en Albacete.",
    fields: [
      { key: "pkg_light", label: "Albacete · 0 – 9 kg (€)", step: "0.01" },
      { key: "pkg_medium", label: "Albacete · 10 – 19 kg (€)", step: "0.01" },
      { key: "pkg_heavy", label: "Albacete · 20 – 30 kg (€)", step: "0.01" },
      { key: "pkg_villarrobledo", label: "Villarrobledo · hasta 10 kg (€)", step: "0.01" },
    ],
  },
  {
    title: "Extras comunes",
    icon: Package,
    hint: "Se ofrecen en el resumen, antes de confirmar.",
    fields: [{ key: "insurance", label: "Seguro de mercancía (€)", step: "1" }],
  },
];

export default function AdminSettings() {
  const canRender = useAdminGuard();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const { data: tariffs } = useQuery({ queryKey: ["tariffs"], queryFn: fetchTariffs });

  // Cargar tarifas al formulario cuando llegan (patrón intencionado servidor->form)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tariffs && !form) setForm({ ...tariffs });
  }, [tariffs, form]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value === "" ? "" : Number(value) }));
    setMessage(null);
  };

  const handleSave = async () => {
    // Un campo vacío daría Number("") = 0 y guardaría 0€ en silencio: se rechaza antes.
    const invalid = Object.keys(DEFAULT_TARIFFS).find((k) => {
      const v = form[k];
      return v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0;
    });
    if (invalid) {
      setMessage({ ok: false, text: `Revisa el campo "${invalid}": debe ser un número válido.` });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const clean = {};
      for (const k of Object.keys(DEFAULT_TARIFFS)) clean[k] = Number(form[k]);

      const { error } = await supabase
        .from("app_settings")
        .update({ value: clean })
        .eq("key", "tariffs");
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setMessage({ ok: true, text: "Tarifas guardadas. Se aplican al momento en toda la web." });
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
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estos precios se usan en la home, en las páginas de servicio, en el asistente de reserva y
          en el cálculo de cada pedido nuevo.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div>
            <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <group.icon className="w-4 h-4 text-primary" /> {group.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{group.hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  min="0"
                  step={f.step}
                  value={form[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Percent className="w-4 h-4 text-primary" /> Comisión
        </h2>
        <div className="space-y-2">
          <Label>Comisión por servicio (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={form.commission_pct}
            onChange={(e) => update("commission_pct", e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Porcentaje que retiene la plataforma; el conductor recibe el{" "}
            {100 - (Number(form.commission_pct) || 0)}%.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button className="w-full h-12 rounded-xl gap-2" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar tarifas
      </Button>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Zona de operación
        </h2>
        <p className="text-sm text-muted-foreground">
          🇪🇸 Albacete capital (CP 02001–02008) — Activo
          <br />
          📦 Villarrobledo (02600) — solo envío de paquetes, entrega en 24 h
        </p>
      </div>
    </div>
  );
}
