"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/entities";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import VehicleCard, { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, CheckCircle2, CheckSquare, Loader2, Send, Square, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { useTariffs } from "@/lib/tariffs";

const AVAILABILITY_OPTIONS = [
  "Disponibilidad inmediata",
  "Entre semana",
  "Fines de semana",
  "Solo tardes",
];

export default function SerConductorPage() {
  const router = useRouter();
  const tariffs = useTariffs();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    vehicle_type: "",
    is_autonomo: null,
    availability: "",
    notes: "",
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const canSubmit =
    form.first_name.trim() &&
    form.last_name.trim() &&
    form.phone.trim() &&
    form.vehicle_type &&
    form.is_autonomo !== null &&
    form.availability &&
    acceptPrivacy;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`;
      const { error: rpcError } = await supabase.rpc("create_driver_application", {
        payload: {
          full_name: fullName,
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          vehicle_type: form.vehicle_type,
          is_autonomo: form.is_autonomo,
          availability: form.availability,
          notes: form.notes.trim() || null,
        },
      });
      if (rpcError) throw rpcError;

      // Aviso al admin (best-effort; hoy no-op sin proveedor de email)
      const vehicleName = vehicleData[form.vehicle_type]?.name || form.vehicle_type;
      base44.integrations.Core.SendEmail({
        to: "renato.0550.calero@gmail.com",
        subject: `🚐 Nueva candidatura de conductor — ${fullName}`,
        body: `Nueva candidatura de conductor en ClicyVoy.\n\nNombre: ${fullName}\nTeléfono: ${form.phone}\nEmail: ${form.email || "—"}\nDirección: ${form.address || "—"}\n\nFurgoneta: ${vehicleName}\nAutónomo: ${form.is_autonomo ? "Sí" : "No"}\nDisponibilidad: ${form.availability}\n\nMensaje: ${form.notes || "—"}`,
      }).catch(() => {});

      setSent(true);
    } catch (err) {
      console.error("Error al enviar la candidatura:", err);
      setError("Hubo un error al enviar tu candidatura. Por favor inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
        </motion.div>
        <h1 className="text-2xl font-display font-bold text-foreground">¡Candidatura enviada!</h1>
        <p className="text-muted-foreground">
          Gracias por tu interés en conducir con Clic<span className="text-primary font-semibold">yVoy</span>.
          Revisaremos tus datos y te contactaremos por teléfono o email.
        </p>
        <Button className="rounded-full px-8 h-12 mt-4" onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/")}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Quiero ser conductor</h1>
          <p className="text-sm text-muted-foreground">Únete a la flota de ClicyVoy en Albacete</p>
        </div>
      </div>

      <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <Truck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Conductores autónomos verificados</p>
          <p>Cuéntanos sobre ti y tu furgoneta. Revisamos cada candidatura y te contactamos para completar la verificación.</p>
        </div>
      </div>

      {/* Datos personales */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre <span className="text-destructive">*</span></Label>
            <Input placeholder="Tu nombre" value={form.first_name} onChange={e => update("first_name", e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Apellidos <span className="text-destructive">*</span></Label>
            <Input placeholder="Tus apellidos" value={form.last_name} onChange={e => update("last_name", e.target.value)} className="h-12 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Teléfono <span className="text-destructive">*</span></Label>
          <Input placeholder="Ej: 612 345 678" type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input placeholder="tu@email.com" type="email" value={form.email} onChange={e => update("email", e.target.value)} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Dirección</Label>
          <Input placeholder="Calle, número — Albacete" value={form.address} onChange={e => update("address", e.target.value)} className="h-12 rounded-xl" />
        </div>

        {/* Tamaño de furgoneta */}
        <div className="space-y-2">
          <Label>Tamaño de tu furgoneta <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-1 gap-3">
            {Object.keys(vehicleData).map(type => (
              <VehicleCard key={type} type={type} price={tariffs[type]} selected={form.vehicle_type === type} onClick={(t) => update("vehicle_type", t)} />
            ))}
          </div>
        </div>

        {/* Autónomo */}
        <div className="space-y-2">
          <Label>¿Eres autónomo? <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Sí, soy autónomo", value: true }, { label: "Todavía no", value: false }].map(opt => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => update("is_autonomo", opt.value)}
                className={`h-12 rounded-xl border text-sm font-medium transition-colors ${form.is_autonomo === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Disponibilidad */}
        <div className="space-y-2">
          <Label>Disponibilidad para aceptar trabajos <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-2 gap-3">
            {AVAILABILITY_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => update("availability", opt)}
                className={`h-12 rounded-xl border text-sm font-medium transition-colors ${form.availability === opt ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cuéntanos algo más (opcional)</Label>
          <Textarea placeholder="Experiencia, zona preferida, tipo de trabajos..." value={form.notes} onChange={e => update("notes", e.target.value)} className="rounded-xl min-h-[80px]" />
        </div>

        {/* Privacidad */}
        <button type="button" onClick={() => setAcceptPrivacy(v => !v)} className="flex items-start gap-3 w-full text-left">
          {acceptPrivacy ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /> : <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
          <span className="text-sm text-foreground">
            Acepto la{" "}
            <a href="/privacidad" className="text-primary underline hover:no-underline" onClick={e => e.stopPropagation()}>política de privacidad</a>{" "}
            <span className="text-destructive">*</span>
          </span>
        </button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="rounded-xl w-full h-12 gap-2" disabled={!canSubmit || loading} onClick={handleSubmit}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar candidatura
        </Button>
      </div>
    </div>
  );
}
