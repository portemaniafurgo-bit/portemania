"use client";

import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

// Mismos tipos que muestra el panel de admin (typeLabels en admin/incidents)
const TYPES = [
  { value: "damage", label: "Daño en la mercancía" },
  { value: "delay", label: "Retraso" },
  { value: "lost_item", label: "Objeto perdido" },
  { value: "payment", label: "Problema con el pago" },
  { value: "behavior", label: "Comportamiento" },
  { value: "other", label: "Otro" },
];

/**
 * Reporte de incidencias sobre un pedido, para cliente y conductor. El panel
 * /admin/incidents existía pero NINGUNA página creaba incidencias: la
 * funcionalidad estaba a medias.
 */
export default function ReportIncidentButton({ order, user }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("other");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (description.trim().length < 10) {
      setError("Describe el problema con un poco más de detalle (mínimo 10 caracteres).");
      return;
    }
    setError("");
    setSending(true);
    try {
      await base44.entities.Incident.create({
        request_id: order.id,
        reporter_id: user?.id,
        reporter_name: user?.full_name || user?.email || "Usuario",
        type,
        description: description.trim(),
      });
      setSent(true);
      setOpen(false);
    } catch (err) {
      setError("No se pudo enviar el reporte: " + (err.message || "error de conexión"));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        Incidencia enviada. El equipo de ClicyVoy la revisará y te contactará si es necesario.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors"
      >
        <AlertTriangle className="w-4 h-4" /> Reportar un problema con este servicio
      </button>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" /> Reportar un problema
      </h3>
      <div className="space-y-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        placeholder="Cuéntanos qué ha pasado..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        className="rounded-xl"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button className="rounded-xl gap-2" onClick={submit} disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          Enviar reporte
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={sending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
