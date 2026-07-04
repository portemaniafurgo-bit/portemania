"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Save, Loader2, Upload, CheckCircle2 } from "lucide-react";
import StatusBadge from "@/components/common/StatusBadge";
import RatingVans from "@/components/common/RatingVans";

const LICENSE_TYPES = ["B", "C", "C1", "CE", "C1E", "D", "D1"];

const VEHICLE_PHOTOS = [
  { field: "vehicle_photo_left_url", label: "Lado izquierdo" },
  { field: "vehicle_photo_right_url", label: "Lado derecho" },
  { field: "vehicle_photo_front_url", label: "Delantera" },
  { field: "vehicle_photo_rear_url", label: "Trasera" },
];

const DOC_UPLOADS = [
  { field: "photo_url", label: "Foto de la cara (selfie) *" },
  { field: "license_photo_url", label: "Foto de licencia" },
  { field: "id_document_url", label: "Documento de identidad" },
  { field: "insurance_url", label: "Seguro del vehículo" },
];

export default function DriverProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: existingProfile } = useQuery({
    queryKey: ["driver-profile"],
    queryFn: async () => {
      const profiles = await base44.entities.DriverProfile.filter({ created_by_id: user?.id });
      return profiles?.[0] || null;
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    license_types: [],
    vehicle_type: "small",
    vehicle_brand: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_plate: "",
    city: "",
  });

  // URLs pendientes de subir (antes de tener perfil creado)
  const [pendingFiles, setPendingFiles] = useState({});
  const [uploading, setUploading] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Rellenar el formulario al cargar el perfil existente: patrón intencionado
  // (sincronizar datos del servidor -> estado del form una sola vez por cambio).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (existingProfile) {
      setForm({
        full_name: existingProfile.full_name || user?.full_name || "",
        phone: existingProfile.phone || "",
        email: existingProfile.email || user?.email || "",
        license_types: existingProfile.license_types || [],
        vehicle_type: existingProfile.vehicle_type || "small",
        vehicle_brand: existingProfile.vehicle_brand || "",
        vehicle_model: existingProfile.vehicle_model || "",
        vehicle_year: existingProfile.vehicle_year || "",
        vehicle_plate: existingProfile.vehicle_plate || "",
        city: existingProfile.city || "",
      });
    } else {
      setForm(prev => ({
        ...prev,
        full_name: user?.full_name || "",
        email: user?.email || "",
      }));
    }
  }, [existingProfile, user]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleLicense = (type) => {
    setForm(prev => ({
      ...prev,
      license_types: prev.license_types.includes(type)
        ? prev.license_types.filter(t => t !== type)
        : [...prev.license_types, type],
    }));
  };

  // Obtener URL actual de un campo (perfil guardado o pendiente local)
  const getFileUrl = (field) => existingProfile?.[field] || pendingFiles[field] || null;

  const handleFileUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(prev => ({ ...prev, [field]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (existingProfile) {
      // Si ya existe perfil, guardar directamente
      await base44.entities.DriverProfile.update(existingProfile.id, { [field]: file_url });
      queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
    } else {
      // Acumular en estado local hasta que se guarde
      setPendingFiles(prev => ({ ...prev, [field]: file_url }));
    }
    setUploading(prev => ({ ...prev, [field]: false }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...form,
        ...pendingFiles,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : undefined,
      };
      if (existingProfile) {
        await base44.entities.DriverProfile.update(existingProfile.id, data);
      } else {
        await base44.entities.DriverProfile.create(data);
        await base44.auth.updateMe({ role: "driver" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-profile"] });
      setPendingFiles({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
  });

  const allVehiclePhotos = VEHICLE_PHOTOS.every(d => getFileUrl(d.field));
  const hasSelfie = !!getFileUrl("photo_url");
  const canSave = form.full_name && form.phone && form.license_types.length > 0;

  const UploadRow = ({ field, label }) => {
    const url = getFileUrl(field);
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        {url ? (
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Subido
          </span>
        ) : (
          <label className="text-xs text-primary font-medium cursor-pointer hover:underline flex items-center gap-1">
            {uploading[field] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Subir
            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(field, e)} />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Perfil de conductor</h1>
        {existingProfile && <StatusBadge status={existingProfile.status} />}
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5" />
          ¡Perfil completado con éxito! Tu solicitud está en revisión.
        </div>
      )}

      {existingProfile && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-heading font-semibold text-foreground mb-3">Mi puntuación</h3>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-display font-bold text-primary">
              {existingProfile.average_rating ? Number(existingProfile.average_rating).toFixed(1) : "—"}
            </div>
            <div className="flex flex-col gap-1.5">
              <RatingVans rating={Math.round(existingProfile.average_rating || 0)} size="default" showValue={false} />
              <p className="text-xs text-muted-foreground">
                Basado en {existingProfile.total_trips || 0} servicio{existingProfile.total_trips !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Datos personales */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground">Datos personales</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Nombre completo</Label>
            <Input value={form.full_name} onChange={e => update("full_name", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={e => update("phone", e.target.value)} className="rounded-xl" placeholder="+34 600..." />
          </div>
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Input value={form.city} onChange={e => update("city", e.target.value)} className="rounded-xl" placeholder="Albacete" />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Carnets de conducir <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-4 gap-2">
              {LICENSE_TYPES.map(type => (
                <label
                  key={type}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
                    form.license_types.includes(type)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Checkbox
                    className="hidden"
                    checked={form.license_types.includes(type)}
                    onCheckedChange={() => toggleLicense(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
            {form.license_types.length === 0 && (
              <p className="text-xs text-muted-foreground">Selecciona al menos un tipo de carnet</p>
            )}
          </div>
        </div>
      </div>

      {/* Vehículo */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground">Vehículo</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label>Tipo de vehículo</Label>
            <Select value={form.vehicle_type} onValueChange={v => update("vehicle_type", v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Furgoneta pequeña</SelectItem>
                <SelectItem value="large">Furgoneta grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Marca</Label>
            <Input value={form.vehicle_brand} onChange={e => update("vehicle_brand", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Input value={form.vehicle_model} onChange={e => update("vehicle_model", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Input type="number" value={form.vehicle_year} onChange={e => update("vehicle_year", e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input value={form.vehicle_plate} onChange={e => update("vehicle_plate", e.target.value)} className="rounded-xl" />
          </div>
        </div>
      </div>

      {/* Fotos del vehículo — siempre visible */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground">
          Fotos del vehículo <span className="text-destructive text-sm font-normal">(obligatorio · 4 fotos)</span>
        </h3>
        <div className="space-y-3">
          {VEHICLE_PHOTOS.map(doc => (
            <UploadRow key={doc.field} field={doc.field} label={doc.label} />
          ))}
        </div>
        {!allVehiclePhotos && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ Debes subir las 4 fotos del vehículo para completar tu perfil
          </p>
        )}
      </div>

      {/* Documentación — siempre visible */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground">Documentación</h3>
        <div className="space-y-3">
          {DOC_UPLOADS.map(doc => (
            <UploadRow key={doc.field} field={doc.field} label={doc.label} />
          ))}
        </div>
        {!hasSelfie && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ La foto de la cara es obligatoria para activar tu perfil
          </p>
        )}
      </div>

      <Button
        className="w-full rounded-xl h-12 gap-2"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !canSave}
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {existingProfile ? "Guardar cambios" : "Completar perfil"}
      </Button>
    </div>
  );
}
