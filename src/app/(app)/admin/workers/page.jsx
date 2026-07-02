"use client";

import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Users, Mail, Phone, MapPin, Car, User } from "lucide-react";
import { useRouter } from "next/navigation";

const emptyForm = {
  nombre: "", apellidos: "", direccion: "", telefono: "", matricula: "", email: ""
};

export default function AdminWorkers() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    loadWorkers();
  }, [user]);

  const loadWorkers = async () => {
    const profiles = await base44.entities.DriverProfile.list();
    setWorkers(profiles);
  };

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.nombre || !form.apellidos || !form.email || !form.telefono || !form.matricula || !form.direccion) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      // Invite the worker as a user with role "user"
      await base44.users.inviteUser(form.email, "user");
      // Also create a DriverProfile with their data
      await base44.entities.DriverProfile.create({
        full_name: `${form.nombre} ${form.apellidos}`,
        phone: form.telefono,
        email: form.email,
        vehicle_plate: form.matricula,
        city: form.direccion,
        status: "verified",
      });
      setSuccess(`Trabajador ${form.nombre} creado. Recibirá un correo de invitación en ${form.email}.`);
      setForm(emptyForm);
      loadWorkers();
    } catch (err) {
      setError(err.message || "Error al crear el trabajador.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "admin") return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Gestión de trabajadores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Crea cuentas para conductores y trabajadores de la plataforma.</p>
      </div>

      {/* Form */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Nuevo trabajador
        </h2>

        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">{success}</div>}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm"><User className="w-3.5 h-3.5" /> Nombre</Label>
              <Input placeholder="Juan" value={form.nombre} onChange={e => update("nombre", e.target.value)} className="rounded-xl h-11" required />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Apellidos</Label>
              <Input placeholder="García López" value={form.apellidos} onChange={e => update("apellidos", e.target.value)} className="rounded-xl h-11" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm"><MapPin className="w-3.5 h-3.5" /> Dirección</Label>
            <Input placeholder="Calle Mayor 12, Albacete" value={form.direccion} onChange={e => update("direccion", e.target.value)} className="rounded-xl h-11" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm"><Phone className="w-3.5 h-3.5" /> Teléfono</Label>
              <Input placeholder="612 345 678" type="tel" value={form.telefono} onChange={e => update("telefono", e.target.value)} className="rounded-xl h-11" required />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm"><Car className="w-3.5 h-3.5" /> Matrícula</Label>
              <Input placeholder="1234 ABC" value={form.matricula} onChange={e => update("matricula", e.target.value)} className="rounded-xl h-11" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm"><Mail className="w-3.5 h-3.5" /> Correo electrónico</Label>
            <Input placeholder="trabajador@portemania.es" type="email" value={form.email} onChange={e => update("email", e.target.value)} className="rounded-xl h-11" required />
            <p className="text-xs text-muted-foreground">El trabajador recibirá un correo para establecer su contraseña e iniciar sesión.</p>
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl gap-2" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Crear trabajador
          </Button>
        </form>
      </div>

      {/* Workers list */}
      {workers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground">Trabajadores registrados</h2>
          {workers.map(w => (
            <div key={w.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{w.full_name?.[0]?.toUpperCase() || "?"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{w.full_name}</p>
                <p className="text-xs text-muted-foreground">{w.email} · {w.phone}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${w.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {w.status === "verified" ? "Verificado" : "Pendiente"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
