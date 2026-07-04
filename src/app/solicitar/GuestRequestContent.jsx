"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import VehicleCard, { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, ArrowRight, Camera, MapPin, Package, Shield, AlertCircle, Loader2, CreditCard, Banknote, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTariffs, estimatePrice } from "@/lib/tariffs";

export default function GuestRequestContent() {
  const router = useRouter();
  const tariffs = useTariffs();
  const searchParams = useSearchParams();
  const preselectedVehicle = searchParams.get("vehicle") || "";
  const totalSteps = preselectedVehicle ? 3 : 4;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    origin_address: "",
    destination_address: "",
    cargo_description: "",
    vehicle_type: preselectedVehicle,
    insurance_selected: false,
    needs_help: false,
    help_description: "",
    notes: "",
    distance_km: 0,
    extra_hours: 0,
    payment_method: "cash",
  });
  const [photos, setPhotos] = useState([]);
  const [acceptPortal, setAcceptPortal] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [cpError, setCpError] = useState({ origin: "", destination: "" });

  const ALBACETE_CP = ["02001", "02002", "02003", "02004", "02005", "02006", "02007", "02008"];

  const extractCP = (address) => {
    const match = address.match(/\b(0[2-9]\d{3}|\d{5})\b/);
    return match ? match[0] : null;
  };

  const validateCP = (field, value) => {
    if (!value.trim()) {
      setCpError(prev => ({ ...prev, [field]: "" }));
      return;
    }
    const cp = extractCP(value);
    if (!cp) {
      setCpError(prev => ({ ...prev, [field]: "El código postal es obligatorio (02001–02008)." }));
    } else if (!ALBACETE_CP.includes(cp)) {
      setCpError(prev => ({ ...prev, [field]: `El código postal ${cp} no pertenece a Albacete capital (02001–02008).` }));
    } else {
      setCpError(prev => ({ ...prev, [field]: "" }));
    }
  };

  // CP presente y dentro de Albacete capital: requisito para continuar.
  const hasValidCP = (address) => {
    const cp = extractCP(address);
    return !!cp && ALBACETE_CP.includes(cp);
  };

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "origin_address") validateCP("origin", value);
    if (field === "destination_address") validateCP("destination", value);
  };

  const simulateDistance = () => {
    if (form.origin_address && form.destination_address) {
      const simulated = Math.floor(Math.random() * 30) + 5;
      update("distance_km", simulated);
      return simulated;
    }
    return form.distance_km;
  };

  const price = estimatePrice(tariffs, form.vehicle_type, form.extra_hours, form.insurance_selected, form.needs_help);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    }
  };

  const handleSubmit = async (force = false) => {
    setLoading(true);
    setDuplicateWarning(false);
    try {
      simulateDistance();
      const finalPrice = estimatePrice(tariffs, form.vehicle_type, form.extra_hours, form.insurance_selected, form.needs_help);

      // `force` lo interpreta la RPC de invitado para saltarse el aviso de duplicado
      const request = await base44.entities.TransportRequest.create({
        ...form,
        estimated_price: finalPrice,
        cargo_photos: photos,
        helpers_count: 0,
        status: "pending",
        payment_status: "pending",
        ...(force ? { force: true } : {}),
      });

      const vehicleName = vehicleData[form.vehicle_type]?.name || form.vehicle_type;
      const emailBody = `Hay un nuevo trabajo disponible en ClicyVoy.\n\nCliente: ${form.client_name}\nTeléfono: ${form.client_phone}\n\nRecogida: ${form.origin_address}\nEntrega: ${form.destination_address}\n\nVehículo: ${vehicleName}\nDuración: ${2 + form.extra_hours}h\nPrecio estimado: ${finalPrice.toFixed(2)}€ (efectivo)\n\nDescripción: ${form.cargo_description}\n\nID de reserva: ${request.id}\n\nAccede a la app para aceptar el trabajo.`;

      // Send all emails in parallel (fire and forget)
      base44.entities.DriverProfile.filter({ status: "verified" }).then(all => {
        // Pedido grande: solo a conductores con furgón grande; pequeño: a todos
        const drivers = form.vehicle_type === "large" ? all.filter(d => d.vehicle_type === "large") : all;
        const emailPromises = [
          base44.integrations.Core.SendEmail({ to: "renato.0550.calero@gmail.com", subject: `🚚 Nueva solicitud (invitado) — ${vehicleName}`, body: emailBody }),
          base44.integrations.Core.SendEmail({ to: "renatocaleromartinez407@gmail.com", subject: `🚚 Nueva solicitud (invitado) — ${vehicleName}`, body: emailBody }),
          ...drivers.filter(d => d.email).map(driver =>
            base44.integrations.Core.SendEmail({
              to: driver.email,
              subject: `🚐 Nuevo trabajo disponible — ${vehicleName}`,
              body: `Hola ${driver.full_name},\n\n${emailBody}`,
            })
          ),
        ];
        Promise.all(emailPromises).catch(console.error);
      }).catch(console.error);

      router.push("/solicitud-enviada");
    } catch (err) {
      if (String(err?.message || "").includes("duplicate_pending")) {
        setDuplicateWarning(true);
      } else {
        console.error("Error al enviar la solicitud:", err);
        alert("Hubo un error al enviar tu solicitud. Por favor inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1) return form.client_name.trim() && form.client_phone.trim() && hasValidCP(form.origin_address) && hasValidCP(form.destination_address);
    if (step === 2) return form.cargo_description && form.cargo_description.length >= 10 && photos.length >= 1 && (!form.needs_help || form.help_description.trim().length >= 5) && (form.needs_help || acceptPortal) && acceptTerms;
    if (step === 3 && !preselectedVehicle) return form.vehicle_type;
    return true;
  };

  const nextStep = () => {
    if (step === 1) simulateDistance();
    const next = step + 1;
    if (next === 3 && preselectedVehicle) {
      setStep(4);
    } else {
      setStep(next);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/")}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Solicitar transporte</h1>
          <p className="text-sm text-muted-foreground">Paso {preselectedVehicle ? (step === 4 ? 3 : step) : step} de {totalSteps} · Como invitado</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const visualStep = i + 1;
          const actualStep = preselectedVehicle && visualStep >= 3 ? visualStep + 1 : visualStep;
          return (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${actualStep <= step ? "bg-primary" : "bg-muted"}`} />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Datos personales + direcciones */}
        {step === 1 && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Servicio de portes en Albacete capital</p>
                <p>Operamos exclusivamente dentro de <strong>Albacete capital</strong>. Recogida y entrega <strong>a pie de calle</strong>.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre completo <span className="text-destructive">*</span></Label>
              <Input placeholder="Tu nombre y apellidos" value={form.client_name} onChange={e => update("client_name", e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono de contacto <span className="text-destructive">*</span></Label>
              <Input placeholder="Ej: 612 345 678" type="tel" value={form.client_phone} onChange={e => update("client_phone", e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Dirección de recogida <span className="text-destructive">*</span></Label>
              <Input placeholder="Calle, número, piso, puerta — Albacete" value={form.origin_address} onChange={e => update("origin_address", e.target.value)} className={`h-12 rounded-xl ${cpError.origin ? "border-destructive" : ""}`} />
              {cpError.origin ? <p className="text-xs text-destructive">{cpError.origin}</p> : <p className="text-xs text-muted-foreground">Incluye código postal (02001–02008)</p>}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-500" /> Dirección de entrega <span className="text-destructive">*</span></Label>
              <Input placeholder="Calle, número, piso, puerta — Albacete" value={form.destination_address} onChange={e => update("destination_address", e.target.value)} className={`h-12 rounded-xl ${cpError.destination ? "border-destructive" : ""}`} />
              {cpError.destination ? <p className="text-xs text-destructive">{cpError.destination}</p> : <p className="text-xs text-muted-foreground">Incluye código postal (02001–02008)</p>}
            </div>
          </motion.div>
        )}

        {/* Step 2: Carga */}
        {step === 2 && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Descripción de la carga <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Describe qué necesitas transportar: tipo de objetos, cantidad, peso aproximado..." value={form.cargo_description} onChange={e => update("cargo_description", e.target.value)} className="rounded-xl min-h-[100px]" />
              {form.cargo_description.length > 0 && form.cargo_description.length < 10 && (
                <p className="text-xs text-destructive">Mínimo 10 caracteres ({form.cargo_description.length}/10)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Fotos de la mercancía <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Al menos 1 foto requerida.</p>
              <div className="flex gap-3 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="w-20 h-20 rounded-xl overflow-hidden border border-border">
                    <img src={url} alt="cargo" className="w-full h-full object-cover" />
                  </div>
                ))}
                <label className={`w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${photos.length === 0 ? "border-destructive/60 hover:border-destructive" : "border-border hover:border-primary/40"}`}>
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              {photos.length === 0 && <p className="text-xs text-destructive">Debes subir al menos 1 foto</p>}
            </div>

            {/* ¿Necesita ayuda del conductor? El autónomo la ve antes de aceptar y decide. */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">¿Necesitas ayuda del conductor? <span className="text-primary font-semibold">+{tariffs.help_price}€</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Por ejemplo: bajar un sofá, cargar cajas…</p>
                </div>
                <Switch checked={form.needs_help} onCheckedChange={v => update("needs_help", v)} />
              </div>
              {form.needs_help && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Describe qué hay que hacer y cómo: qué objeto, en qué piso, ¿hay ascensor?…"
                    value={form.help_description}
                    onChange={e => update("help_description", e.target.value)}
                    className="rounded-xl min-h-[80px]"
                  />
                  {form.help_description.trim().length < 5 && (
                    <p className="text-xs text-destructive">Describe la ayuda que necesitas (obligatorio)</p>
                  )}
                  <p className="text-xs text-muted-foreground">El conductor verá tu petición antes de aceptar el trabajo y decidirá si puede ayudarte.</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {form.needs_help ? (
                <div className="flex gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="flex-shrink-0">🤝</span>
                  <p className="text-xs text-emerald-800">
                    Con la ayuda contratada, el conductor <strong>sube/baja la mercancía contigo</strong> — no hace falta tenerla a pie de calle.
                  </p>
                </div>
              ) : (
                <>
                  <button type="button" onClick={() => setAcceptPortal(v => !v)} className="flex items-start gap-3 w-full text-left">
                    {acceptPortal ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /> : <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                    <span className="text-sm text-foreground">Acepto que la mercancía sea recogida a pie de calle (en el portal) <span className="text-destructive">*</span></span>
                  </button>
                  <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 ml-8">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Sin ayuda contratada, <strong>la mercancía debe estar preparada a pie de calle</strong> cuando llegue el conductor.
                    </p>
                  </div>
                </>
              )}
              <button type="button" onClick={() => setAcceptTerms(v => !v)} className="flex items-start gap-3 w-full text-left">
                {acceptTerms ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" /> : <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                <span className="text-sm text-foreground">
                  Acepto los{" "}
                  <a href="/terminos" className="text-primary underline hover:no-underline" onClick={e => e.stopPropagation()}>términos y condiciones</a>{" "}
                  y la{" "}
                  <a href="/privacidad" className="text-primary underline hover:no-underline" onClick={e => e.stopPropagation()}>política de privacidad</a>{" "}
                  <span className="text-destructive">*</span>
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Vehículo */}
        {step === 3 && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el tipo de vehículo adecuado para tu carga</p>
            {form.needs_help ? (
              <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="flex-shrink-0">🤝</span>
                <div className="text-sm text-emerald-800">
                  <p className="font-semibold mb-0.5">Ayuda del conductor contratada</p>
                  <p>El conductor te ayudará a subir/bajar la mercancía (incluido en el precio).</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-0.5">Entrega y recogida a pie de calle</p>
                  <p>El conductor no sube a pisos ni realiza montaje.</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              {Object.keys(vehicleData).map(type => (
                <VehicleCard key={type} type={type} price={tariffs[type]} selected={form.vehicle_type === type} onClick={(t) => update("vehicle_type", t)} />
              ))}
            </div>
            {form.vehicle_type && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">¿Necesitas más de 2 horas?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Cada hora adicional cuesta {tariffs.extra_hour}€.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => update("extra_hours", Math.max(0, form.extra_hours - 1))} className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted" disabled={form.extra_hours === 0}>−</button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-display font-bold text-foreground">{2 + form.extra_hours}h</p>
                    <p className="text-xs text-muted-foreground">{form.extra_hours === 0 ? "Solo 2h incluidas" : `+${form.extra_hours}h extra (+${form.extra_hours * tariffs.extra_hour}€)`}</p>
                  </div>
                  <button onClick={() => update("extra_hours", form.extra_hours + 1)} className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted">+</button>
                </div>
                <div className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700">
                    <strong>Importante:</strong> El tiempo empieza a contar desde que el conductor llega a tu puerta. Si el servicio se extiende más de las horas contratadas, las horas adicionales se abonarán directamente al transportista a razón de <strong>{tariffs.extra_hour}€/hora</strong>.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 4: Resumen */}
        {step === 4 && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cliente</p>
              <p className="font-semibold text-foreground">{form.client_name}</p>
              <p className="text-sm text-muted-foreground">{form.client_phone}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-foreground">{form.origin_address}</span>
              </div>
              <div className="ml-1.5 border-l-2 border-dashed border-primary/30 h-4" />
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-foreground">{form.destination_address}</span>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <img src={vehicleData[form.vehicle_type]?.photo} alt={vehicleData[form.vehicle_type]?.name} className="w-full h-32 object-cover" />
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{vehicleData[form.vehicle_type]?.name}</p>
                  <p className="text-xs text-muted-foreground">{vehicleData[form.vehicle_type]?.capacity}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{2 + form.extra_hours}h totales</p>
              </div>
            </div>

            {form.needs_help ? (
              <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="flex-shrink-0">🤝</span>
                <p className="text-sm text-emerald-800">Con <strong>ayuda del conductor</strong>: te ayudará a subir/bajar la mercancía.</p>
              </div>
            ) : (
              <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">Recogida y entrega <strong>a pie de calle</strong>.</p>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Seguro de mercancía (+{tariffs.insurance}€)</span>
                </div>
                <Switch checked={form.insurance_selected} onCheckedChange={v => update("insurance_selected", v)} />
              </div>
            </div>

            <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Precio estimado</p>
                  <p className="text-3xl font-display font-bold text-foreground">{price.toFixed(2)}€</p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  <p>Base (2h): {tariffs[form.vehicle_type]}€</p>
                  {form.extra_hours > 0 && <p>Horas extra: +{form.extra_hours * tariffs.extra_hour}€</p>}
                  {form.insurance_selected && <p>Seguro: +{tariffs.insurance}€</p>}
                  {form.needs_help && <p>Ayuda del conductor: +{tariffs.help_price}€</p>}
                </div>
              </div>
            </div>

            {/* Pago solo efectivo para invitados */}
            <div className="flex gap-3 p-4 rounded-xl bg-muted border border-border items-center">
              <Banknote className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-foreground">Pago en <strong>efectivo al conductor</strong>. Para pagar con tarjeta, <a href="/login-clientes" className="text-primary underline">inicia sesión</a>.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso de pedido duplicado */}
      {duplicateWarning && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Ya hay una solicitud pendiente con este teléfono</strong> creada hace menos de 30 minutos.
              Si fuiste tú, no hace falta crear otra: un conductor la aceptará en breve.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setDuplicateWarning(false)}>
              Vale, no crear otra
            </Button>
            <Button size="sm" className="rounded-xl flex-1" disabled={loading} onClick={() => handleSubmit(true)}>
              Crear otra igualmente
            </Button>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button variant="outline" className="rounded-xl" onClick={() => setStep(s => s - 1)}>Atrás</Button>
        )}
        {step < 4 ? (
          <Button className="rounded-xl flex-1 h-12 gap-2" disabled={!canNext()} onClick={nextStep}>
            Continuar <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button className="rounded-xl flex-1 h-12 gap-2" disabled={loading || duplicateWarning} onClick={() => handleSubmit(false)}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            Confirmar solicitud
          </Button>
        )}
      </div>
    </div>
  );
}
