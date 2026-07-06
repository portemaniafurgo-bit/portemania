"use client";

import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/common/StatusBadge";
import { vehicleData } from "@/components/common/VehicleCard";
import {
  UserPlus, Search, Check, X, Shield, Truck, Phone, Mail,
  Loader2, Car, User, Trash2, ChevronDown, ChevronUp
} from "lucide-react";

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";

const emptyForm = {
  nombre: "", apellidos: "", telefono: "", email: "",
  matricula: "", vehiculo_marca: "", vehiculo_modelo: "", ciudad: "",
  vehiculo_tamano: "small",
};

export default function AdminDrivers() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["admin-drivers"],
    queryFn: () => base44.entities.DriverProfile.list("-created_date", 200),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["admin-driver-applications"],
    queryFn: () => base44.entities.DriverApplication.filter({ status: "new" }, "-created_date", 100),
  });

  const applicationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DriverApplication.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-driver-applications"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DriverProfile.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DriverProfile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-drivers"] }),
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(""); setFormSuccess("");
    if (!form.nombre || !form.apellidos || !form.email || !form.telefono) {
      setFormError("Nombre, apellidos, email y teléfono son obligatorios.");
      return;
    }
    const email = form.email.trim().toLowerCase();

    // Evitar duplicar: si ya existe un perfil de conductor con ese email
    if (drivers.some(d => (d.email || "").toLowerCase() === email)) {
      setFormError("Ya existe un conductor con ese email.");
      return;
    }

    setCreating(true);
    try {
      // Crea la cuenta (o la reutiliza si el email ya tenía una: cliente/admin).
      const invite = await base44.users.inviteUser(email, "driver");
      await base44.entities.DriverProfile.create({
        full_name: `${form.nombre} ${form.apellidos}`,
        phone: form.telefono,
        email,
        vehicle_plate: form.matricula,
        vehicle_brand: form.vehiculo_marca,
        vehicle_model: form.vehiculo_modelo,
        vehicle_type: form.vehiculo_tamano,
        city: form.ciudad || "Albacete",
        status: "verified",
        is_available: false,
      });
      if (invite?.already_existed) {
        setFormSuccess(`✅ Conductor creado. ${email} ya tenía cuenta: entrará con su contraseña de siempre (o puede usar "he olvidado mi contraseña").`);
      } else {
        setFormSuccess(`✅ Conductor creado. Se ha enviado un email de invitación a ${email} para que cree su contraseña y acceda.`);
      }
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    } catch (err) {
      setFormError(err.message || "Error al crear el conductor.");
    } finally {
      setCreating(false);
    }
  };

  const filtered = drivers.filter(d =>
    (d.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || "").includes(search)
  );

  // Protección: solo el admin puede acceder
  const isUnauthorized = user && user.email !== ADMIN_EMAIL && user.role !== "admin";

  useEffect(() => {
    if (isUnauthorized) {
      router.replace("/dashboard");
    }
  }, [isUnauthorized, router]);

  if (isUnauthorized) {
    return null;
  }

  const verified = drivers.filter(d => d.status === "verified").length;
  const pending = drivers.filter(d => d.status === "pending_verification").length;
  const suspended = drivers.filter(d => d.status === "suspended").length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" /> Conductores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Gestiona y registra los conductores de ClicyVoy</p>
      </div>

      {/* Candidaturas del formulario público "Quiero ser conductor" */}
      {applications.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Candidaturas nuevas</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{applications.length}</span>
          </div>
          {applications.map(app => (
            <div key={app.id} className="bg-card rounded-2xl border border-primary/20 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{app.full_name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone}</span>
                    {app.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {app.email}</span>}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {app.created_date ? new Date(app.created_date).toLocaleDateString("es-ES") : ""}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Furgoneta</p>
                  <p className="font-medium text-foreground">{vehicleData[app.vehicle_type]?.name || app.vehicle_type || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Autónomo</p>
                  <p className="font-medium text-foreground">{app.is_autonomo === true ? "Sí" : app.is_autonomo === false ? "No" : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Disponibilidad</p>
                  <p className="font-medium text-foreground">{app.availability || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dirección</p>
                  <p className="font-medium text-foreground">{app.address || "—"}</p>
                </div>
              </div>
              {app.notes && <p className="mt-2 text-sm text-muted-foreground italic">“{app.notes}”</p>}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="rounded-xl gap-1"
                  onClick={() => applicationMutation.mutate({ id: app.id, data: { status: "contacted" } })}
                >
                  <Check className="w-3 h-3" /> Marcar contactado
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1 border-destructive/30 text-destructive"
                  onClick={() => applicationMutation.mutate({ id: app.id, data: { status: "discarded" } })}
                >
                  <X className="w-3 h-3" /> Descartar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{verified}</p>
          <p className="text-xs text-muted-foreground mt-1">Verificados</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-amber-500">{pending}</p>
          <p className="text-xs text-muted-foreground mt-1">Pendientes</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-3xl font-bold text-red-500">{suspended}</p>
          <p className="text-xs text-muted-foreground mt-1">Suspendidos</p>
        </div>
      </div>

      {/* Botón añadir conductor */}
      <div>
        <Button
          className="rounded-xl gap-2"
          onClick={() => { setShowForm(!showForm); setFormError(""); setFormSuccess(""); }}
        >
          <UserPlus className="w-4 h-4" />
          {showForm ? "Cancelar" : "Añadir nuevo conductor"}
        </Button>
      </div>

      {/* Formulario nuevo conductor */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Nuevo conductor
          </h2>

          {formError && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{formError}</div>}
          {formSuccess && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">{formSuccess}</div>}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Nombre *</Label>
                <Input placeholder="Juan" value={form.nombre} onChange={e => update("nombre", e.target.value)} className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Apellidos *</Label>
                <Input placeholder="García López" value={form.apellidos} onChange={e => update("apellidos", e.target.value)} className="rounded-xl" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm"><Phone className="w-3.5 h-3.5" /> Teléfono *</Label>
                <Input placeholder="612 345 678" type="tel" value={form.telefono} onChange={e => update("telefono", e.target.value)} className="rounded-xl" required />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm"><Mail className="w-3.5 h-3.5" /> Email *</Label>
                <Input placeholder="conductor@email.com" type="email" value={form.email} onChange={e => update("email", e.target.value)} className="rounded-xl" required />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm"><Car className="w-3.5 h-3.5" /> Marca</Label>
                <Input placeholder="Ford" value={form.vehiculo_marca} onChange={e => update("vehiculo_marca", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Modelo</Label>
                <Input placeholder="Transit" value={form.vehiculo_modelo} onChange={e => update("vehiculo_modelo", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Matrícula</Label>
                <Input placeholder="1234 ABC" value={form.matricula} onChange={e => update("matricula", e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Tamaño de furgoneta * <span className="text-xs text-muted-foreground font-normal">(determina qué pedidos ve)</span></Label>
              <div className="grid grid-cols-2 gap-3">
                {[{ v: "small", l: `🚐 ${vehicleData.small.name}` }, { v: "large", l: `🚚 ${vehicleData.large.name}` }].map(o => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => update("vehiculo_tamano", o.v)}
                    className={`h-11 rounded-xl border text-sm font-medium transition-colors ${form.vehiculo_tamano === o.v ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Al crear el conductor recibirá un email de invitación para crear su contraseña y acceder.
            </p>

            <Button type="submit" className="w-full h-11 rounded-xl gap-2" disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Crear conductor
            </Button>
          </form>
        </div>
      )}

      {/* Listado conductores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conductores registrados ({drivers.length})</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No hay conductores registrados</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(driver => (
            <div key={driver.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              {/* Fila principal */}
              <div className="p-4 flex items-center gap-4">
                {driver.photo_url ? (
                  <img src={driver.photo_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                    {driver.full_name?.[0]?.toUpperCase() || "C"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{driver.full_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {driver.phone && <span>📞 {driver.phone}</span>}
                    {driver.email && <span>✉️ {driver.email}</span>}
                  </div>
                  {(driver.vehicle_brand || driver.vehicle_plate) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      🚐 {[driver.vehicle_brand, driver.vehicle_model, driver.vehicle_plate].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={driver.status} />
                  <button onClick={() => setExpandedId(expandedId === driver.id ? null : driver.id)}>
                    {expandedId === driver.id
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>

              {/* Perfil expandido */}
              {expandedId === driver.id && (
                <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">

                  {/* Fotos del vehículo */}
                  {(driver.vehicle_photo_front_url || driver.vehicle_photo_rear_url || driver.vehicle_photo_left_url || driver.vehicle_photo_right_url) && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fotos del vehículo</p>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { url: driver.vehicle_photo_front_url, label: "Delantera" },
                          { url: driver.vehicle_photo_rear_url, label: "Trasera" },
                          { url: driver.vehicle_photo_left_url, label: "Izquierda" },
                          { url: driver.vehicle_photo_right_url, label: "Derecha" },
                        ].filter(p => p.url).map((p, i) => (
                          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" title={p.label}>
                            <img src={p.url} alt={p.label} className="w-20 h-20 rounded-xl object-cover border border-border hover:border-primary transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Documentos */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentación</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { url: driver.photo_url, title: "Foto cara" },
                        { url: driver.license_photo_url, title: "Carnet de conducir" },
                        { url: driver.id_document_url, title: "Documento de identidad" },
                        { url: driver.insurance_url, title: "Seguro del vehículo" },
                        { url: driver.autonomo_receipt_url, title: "Recibo de autónomo" },
                        { url: driver.censal_document_url, title: "Situación censal" },
                      ].filter(d => d.url).map(d => (
                        <a key={d.title} href={d.url} target="_blank" rel="noopener noreferrer" title={d.title}>
                          {/\.pdf($|\?)/i.test(d.url) ? (
                            <span className="w-20 h-20 rounded-xl border border-border hover:border-primary transition-colors flex flex-col items-center justify-center gap-1 text-2xl bg-muted">
                              📄<span className="text-[9px] text-muted-foreground px-1 text-center leading-tight">{d.title}</span>
                            </span>
                          ) : (
                            <img src={d.url} alt={d.title} className="w-20 h-20 rounded-xl object-cover border border-border hover:border-primary transition-colors" />
                          )}
                        </a>
                      ))}
                    </div>
                    {!driver.photo_url && !driver.license_photo_url && !driver.id_document_url && !driver.insurance_url && !driver.autonomo_receipt_url && !driver.censal_document_url && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">⚠️ Este conductor no ha subido documentación todavía</p>
                    )}
                  </div>

                  {/* Tamaño de furgoneta (determina el reparto de pedidos) */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Tamaño de furgoneta {!driver.vehicle_type && <span className="text-amber-600 normal-case">⚠ sin definir — no verá pedidos de furgoneta grande</span>}
                    </p>
                    <div className="flex gap-2">
                      {[{ v: "small", l: `🚐 ${vehicleData.small.name}` }, { v: "large", l: `🚚 ${vehicleData.large.name}` }].map(o => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => updateMutation.mutate({ id: driver.id, data: { vehicle_type: o.v } })}
                          className={`px-3 h-9 rounded-xl border text-sm font-medium transition-colors ${driver.vehicle_type === o.v ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2">
                  {driver.status === "pending_verification" && (
                    <>
                      <Button size="sm" className="rounded-xl gap-1" onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "verified" } })}>
                        <Check className="w-3 h-3" /> Verificar
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1 border-destructive/30 text-destructive"
                        onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "rejected" } })}>
                        <X className="w-3 h-3" /> Rechazar
                      </Button>
                    </>
                  )}
                  {driver.status === "verified" && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1"
                        onClick={() => updateMutation.mutate({ id: driver.id, data: { is_available: !driver.is_available } })}>
                        {driver.is_available ? "Poner no disponible" : "Poner disponible"}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1 border-amber-300 text-amber-600"
                        onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "suspended" } })}>
                        Suspender
                      </Button>
                    </>
                  )}
                  {driver.status === "suspended" && (
                    <Button size="sm" className="rounded-xl gap-1"
                      onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "verified" } })}>
                      <Shield className="w-3 h-3" /> Reactivar
                    </Button>
                  )}
                  {driver.status === "rejected" && (
                    <Button size="sm" className="rounded-xl gap-1"
                      onClick={() => updateMutation.mutate({ id: driver.id, data: { status: "verified" } })}>
                      <Shield className="w-3 h-3" /> Verificar igualmente
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={`rounded-xl gap-1 ml-auto ${confirmDeleteId === driver.id ? "border-destructive bg-destructive/10 text-destructive font-semibold" : "border-destructive/30 text-destructive"}`}
                    onClick={() => {
                      // Confirmación en dos clics (el confirm() nativo congela el navegador)
                      if (confirmDeleteId !== driver.id) {
                        setConfirmDeleteId(driver.id);
                        setTimeout(() => setConfirmDeleteId(null), 4000);
                      } else {
                        deleteMutation.mutate(driver.id);
                        setConfirmDeleteId(null);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmDeleteId === driver.id ? "¿Seguro? Pulsa otra vez" : "Eliminar"}
                  </Button>
                </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
