"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  adminFetchProgramRow, adminSaveProgram, friendlyActionError, friendlyError, normalizeProgram,
  PROGRAM_RANGES,
} from "@/lib/partners";
import { ErrorBox, LoadingBox, Section } from "@/components/partners/ui";

/**
 * Campos de app_settings.partner_program. Rangos y valores por defecto = los
 * del servidor (PROGRAM_RANGES / PROGRAM_DEFAULTS, que replican
 * partner_program_settings). `int`: se lee como número entero (un decimal
 * rompería el cálculo de fechas).
 */
const field = (key, label, step, int, hint) => ({
  key, label, step, int, hint,
  min: PROGRAM_RANGES[key][0],
  max: PROGRAM_RANGES[key][1],
});

const NUMBER_FIELDS = [
  field("first_pct", "Primer servicio de cada cliente (%)", "0.5", false),
  field("repeat_pct", "Servicios siguientes (%)", "0.5", false),
  field("hold_days", "Días de espera antes de poder cobrar", "1", true),
  field("min_payout", "Cobro mínimo (€)", "1", false),
  field("payout_interval_days", "Días entre solicitudes de cobro", "1", true),
  field("claim_window_days", "Días para usar el enlace tras crear la cuenta", "1", true),
  field("max_price_quote_ratio", "Retener si el precio supera el presupuesto (veces)", "0.5", false),
  field("max_auto_base", "Importe máximo sin revisión (€)", "1", false,
    "Las comisiones de servicios por encima de este importe quedan retenidas para tu revisión."),
  field("max_auto_cash_base", "Importe máximo en efectivo o Bizum sin revisión (€)", "1", false,
    "Las comisiones de servicios en efectivo o Bizum por encima de este importe quedan retenidas para tu revisión."),
];

// hold_same_driver se llamaba hold_same_driver_cash: se lee cualquiera de los
// dos (normalizeProgram) y se guarda solo el nombre nuevo.
const BOOL_FIELDS = [
  { key: "enabled", label: "Programa activo", hint: "Apagado: no se captan clientes nuevos y las comisiones de nuevos servicios quedan retenidas para tu revisión. Lo ya disponible se puede cobrar." },
  { key: "public", label: "Abierto a todo el mundo", hint: "Desactivado: solo tu equipo ve el programa y puede hacerse comercial (para probarlo); los que ya son comerciales siguen con su panel." },
  { key: "hold_same_driver", legacy: "hold_same_driver_cash", label: "Retener si el conductor es el propio comercial", hint: "La comisión queda retenida hasta que la liberes tú." },
];

export default function AdminProgramSettings() {
  const q = useQuery({ queryKey: ["admin-partner-program"], queryFn: adminFetchProgramRow });

  if (q.isLoading) return <LoadingBox />;
  if (q.isError) return <ErrorBox text={friendlyError(q.error, "los ajustes")} onRetry={q.refetch} />;
  if (q.data === null) {
    return (
      <ErrorBox text="El programa de comerciales todavía no está instalado en la base de datos: no hay ajustes que editar." />
    );
  }
  // El formulario se siembra una vez; `current` (lo guardado) se usa al guardar
  // para conservar las claves que esta pantalla no conoce.
  return <SettingsForm current={q.data} />;
}

function SettingsForm({ current }) {
  const queryClient = useQueryClient();
  // Se siembra con lo que de verdad usa el servidor: sin "enabled" = activo,
  // sin "public" = solo el equipo, "true"/"false" en texto se leen como sí/no y
  // lo ilegible, su valor por defecto.
  const [form, setForm] = useState(() => {
    const eff = normalizeProgram(current) || {};
    const out = {};
    for (const f of NUMBER_FIELDS) out[f.key] = eff[f.key];
    for (const f of BOOL_FIELDS) out[f.key] = eff[f.key] === true;
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const savingRef = useRef(false); // guarda síncrona contra doble clic

  const save = async () => {
    if (savingRef.current) return;
    const clean = {};
    for (const f of NUMBER_FIELDS) {
      const raw = form[f.key];
      const n = Number(raw);
      if (raw === "" || raw === null || !Number.isFinite(n) || n < f.min || n > f.max || (f.int && !Number.isInteger(n))) {
        setMessage({
          ok: false,
          text: `«${f.label}»: debe ser ${f.int ? "un número entero" : "un número"} entre ${f.min} y ${f.max}.`,
        });
        return;
      }
      clean[f.key] = n;
    }
    for (const f of BOOL_FIELDS) clean[f.key] = form[f.key] === true;

    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await adminSaveProgram(current, clean, BOOL_FIELDS.map((f) => f.legacy).filter(Boolean));
      setMessage({ ok: true, text: "Ajustes guardados. Se aplican a las comisiones que se generen a partir de ahora." });
      queryClient.invalidateQueries({ queryKey: ["admin-partner-program"] });
      queryClient.invalidateQueries({ queryKey: ["partner-program"] });
    } catch (err) {
      setMessage({ ok: false, text: friendlyActionError(err) });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <Section title="Programa">
        {BOOL_FIELDS.map((f) => (
          <div key={f.key} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={`pp-${f.key}`}>{f.label}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
            </div>
            <Switch
              id={`pp-${f.key}`}
              checked={form[f.key]}
              onCheckedChange={(v) => {
                setForm((prev) => ({ ...prev, [f.key]: v === true }));
                setMessage(null);
              }}
            />
          </div>
        ))}
      </Section>

      <Section title="Comisiones y cobros">
        <div className="grid sm:grid-cols-2 gap-4">
          {NUMBER_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`pp-${f.key}`} className="text-xs">{f.label}</Label>
              <Input
                id={`pp-${f.key}`}
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={form[f.key]}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                  setMessage(null);
                }}
                className="rounded-xl"
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Los cambios no tocan las comisiones ya generadas: cada una guarda su porcentaje y su fecha.
        </p>
      </Section>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button className="w-full h-12 rounded-xl gap-2" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar ajustes del programa
      </Button>
    </div>
  );
}
