"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import VehicleCard, { vehicleData } from "@/components/common/VehicleCard";
import { ArrowLeft, ArrowRight, Camera, MapPin, Package, Shield, AlertCircle, Loader2, CreditCard, Banknote, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


const INSURANCE_PRICE = 12;
const EXTRA_HOUR_PRICE = 15;

function estimatePrice(vehicleType, extraHours, insurance) {
  if (!vehicleType) return 0;
  const base = vehicleData[vehicleType]?.basePrice || 50;
  const extraCost = (extraHours || 0) * EXTRA_HOUR_PRICE;
  const insuranceCost = insurance ? INSURANCE_PRICE : 0;
  return base + extraCost + insuranceCost;
}

export default function NewRequestContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedVehicle = searchParams.get("vehicle") || "";
  const totalSteps = preselectedVehicle ? 3 : 4;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    origin_address: "",
    destination_address: "",
    client_phone: "",
    cargo_description: "",
    vehicle_type: preselectedVehicle,
    insurance_selected: false,
    notes: "",
    distance_km: 0,
    extra_hours: 0,
    payment_method: "card",
  });

  const [photos, setPhotos] = useState([]);
  const [acceptPortal, setAcceptPortal] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const ALBACETE_CP = ["02001", "02002", "02003", "02004", "02005", "02006", "02007", "02008"];
  const [cpError, setCpError] = useState({ origin: "", destination: "" });

  const extractCP = (address) => {
    const match = address.match(/\b(0[2-9]\d{3}|\d{5})\b/);
    return match ? match[0] : null;
  };

  const validateCP = (field, value) => {
    const cp = extractCP(value);
    if (cp && !ALBACETE_CP.includes(cp)) {
      setCpError(prev => ({ ...prev, [field]: `El código postal ${cp} no pertenece a Albacete capital (02001–02008).` }));
    } else {
      setCpError(prev => ({ ...prev, [field]: "" }));
    }
  };

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "origin_address") validateCP("origin", value);
    if (field === "destination_address") validateCP("destination", value);
  };

  // Simulate distance when both addresses are filled
  const simulateDistance = () => {
    if (form.origin_address && form.destination_address) {
      const simulated = Math.floor(Math.random() * 30) + 5;
      update("distance_km", simulated);
      return simulated;
    }
    return form.distance_km;
  };

  const price = estimatePrice(form.vehicle_type, form.extra_hours, form.insurance_selected);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      simulateDistance();
      const finalPrice = estimatePrice(form.vehicle_type, form.extra_hours, form.insurance_selected);

      const request = await base44.entities.TransportRequest.create({
        ...form,
        estimated_price: finalPrice,
        cargo_photos: photos,
        helpers_count: 0,
        client_name: user?.full_name || "Cliente",
        client_phone: form.client_phone || user?.phone || "",
        status: "pending",
        payment_method: form.payment_method,
        payment_status: "pending",
      });

      // Notify admin + drivers via email (fire and forget, no await to not block navigation)
      const vehicleName = vehicleData[form.vehicle_type]?.name || form.vehicle_type;
      const emailBody = `Hay un nuevo trabajo disponible en PorteManía.\n\nCliente: ${user?.full_name || "Cliente"}\nTeléfono: ${form.client_phone}\n\nRecogida: ${form.origin_address}\nEntrega: ${form.destination_address}\n\nVehículo: ${vehicleName}\nDuración: ${2 + form.extra_hours}h\nPrecio estimado: ${finalPrice.toFixed(2)}€\nPago: ${form.payment_method === "card" ? "Tarjeta" : "Efectivo"}\n\nDescripción: ${form.cargo_description}\n${form.notes ? `Notas: ${form.notes}` : ""}\n\nID de reserva: ${request.id}\n\nAccede a la app para aceptar el trabajo.`;

      // Send all emails in parallel (fire and forget)
      base44.entities.DriverProfile.filter({ status: "verified", vehicle_type: form.vehicle_type }).then(drivers => {
        const emailPromises = [
          base44.integrations.Core.SendEmail({ to: "renato.0550.calero@gmail.com", subject: `🚚 Nueva reserva — ${vehicleName}`, body: emailBody }),
          base44.integrations.Core.SendEmail({ to: "renatocaleromartinez407@gmail.com", subject: `🚚 Nueva reserva — ${vehicleName}`, body: emailBody }),
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

      if (form.payment_method === "card") {
        router.push(`/payment/${request.id}`);
      } else {
        router.push("/my-orders");
      }
    } catch (err) {
      console.error("Error al crear la solicitud:", err);
      alert("Hubo un error al enviar tu solicitud. Por favor inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1) return form.origin_address && form.destination_address && form.client_phone && !cpError.origin && !cpError.destination;
    if (step === 2) return form.cargo_description && form.cargo_description.length >= 10 && photos.length >= 1 && acceptPortal && acceptTerms;
    if (step === 3) return form.vehicle_type;
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
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/dashboard")}>
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Nuevo transporte</h1>
          <p className="text-sm text-muted-foreground">Paso {preselectedVehicle ? (step === 4 ? 3 : step) : step} de {totalSteps}</p>
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
        {/* Step 1: Addresses */}
        {step === 1 && (
          <motion.div key="step1" {...stepVariants} className="space-y-5">
            {/* Important notice */}
            <div className="flex gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Servicio de portes en Albacete capital</p>
                <p>Operamos exclusivamente dentro de <strong>Albacete capital</strong>. Recogida y entrega <strong>a pie de calle</strong>.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Dirección de recogida <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Calle, número, piso, puerta — Albacete"
                value={form.origin_address}
                onChange={e => update("origin_address", e.target.value)}
                className={`h-12 rounded-xl ${cpError.origin ? "border-destructive" : ""}`}
              />
              {cpError.origin
                ? <p className="text-xs text-destructive">{cpError.origin}</p>
                : <p className="text-xs text-muted-foreground">Incluye calle, número, piso/puerta y código postal (02001–02008)</p>
              }
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" /> Dirección de entrega <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Calle, número, piso, puerta — Albacete"
                value={form.destination_address}
                onChange={e => update("destination_address", e.target.value)}
                className={`h-12 rounded-xl ${cpError.destination ? "border-destructive" : ""}`}
              />
              {cpError.destination
                ? <p className="text-xs text-destructive">{cpError.destination}</p>
                : <p className="text-xs text-muted-foreground">Incluye calle, número, piso/puerta y código postal (02001–02008)</p>
              }
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                Teléfono de contacto <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ej: 612 345 678"
                type="tel"
                value={form.client_phone}
                onChange={e => update("client_phone", e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          </motion.div>
        )}

        {/* Step 2: Cargo */}
        {step === 2 && (
          <motion.div key="step2" {...stepVariants} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Descripción de la carga <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Describe qué necesitas transportar: tipo de objetos, cantidad, peso aproximado..."
                value={form.cargo_description}
                onChange={e => update("cargo_description", e.target.value)}
                className="rounded-xl min-h-[100px]"
              />
              {form.cargo_description.length > 0 && form.cargo_description.length < 10 && (
                <p className="text-xs text-destructive">Mínimo 10 caracteres ({form.cargo_description.length}/10)</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" /> Fotos de la mercancía <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">Envía varias fotos de la mercancía para que el conductor pueda prepararse. Se requiere al menos 1 foto.</p>
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
              {photos.length === 0 && (
                <p className="text-xs text-destructive">Debes subir al menos 1 foto de la mercancía</p>
              )}
            </div>

            {/* Checkboxes obligatorios */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setAcceptPortal(v => !v)}
                className="flex items-start gap-3 w-full text-left"
              >
                {acceptPortal
                  ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  : <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                }
                <span className="text-sm text-foreground">
                  Acepto que la mercancía sea recogida en el portal <span className="text-destructive">*</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAcceptTerms(v => !v)}
                className="flex items-start gap-3 w-full text-left"
              >
                {acceptTerms
                  ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  : <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                }
                <span className="text-sm text-foreground">
                  Acepto los{" "}
                  <a href="/terminos" className="text-primary underline hover:no-underline" onClick={e => e.stopPropagation()}>
                    términos y condiciones
                  </a>{" "}
                  de la página <span className="text-destructive">*</span>
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Vehicle */}
        {step === 3 && (
          <motion.div key="step3" {...stepVariants} className="space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el tipo de vehículo adecuado para tu carga</p>
            {/* Curbside reminder */}
            <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-0.5">Entrega y recogida a pie de calle</p>
                <p>El conductor no sube a pisos ni realiza montaje. La mercancía debe estar accesible en la puerta o planta baja.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.keys(vehicleData).map(type => (
                <VehicleCard
                  key={type}
                  type={type}
                  selected={form.vehicle_type === type}
                  onClick={(t) => update("vehicle_type", t)}
                />
              ))}
            </div>

            {/* Extra hours selector */}
            {form.vehicle_type && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">¿Necesitas más de 2 horas?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">El precio base incluye 2 horas. Cada hora adicional cuesta {EXTRA_HOUR_PRICE}€.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => update("extra_hours", Math.max(0, form.extra_hours - 1))}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted transition-colors"
                    disabled={form.extra_hours === 0}
                  >−</button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-display font-bold text-foreground">{2 + form.extra_hours}h</p>
                    <p className="text-xs text-muted-foreground">
                      {form.extra_hours === 0 ? "Solo 2h incluidas" : `+${form.extra_hours}h extra (+${form.extra_hours * EXTRA_HOUR_PRICE}€)`}
                    </p>
                  </div>
                  <button
                    onClick={() => update("extra_hours", form.extra_hours + 1)}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold text-foreground hover:bg-muted transition-colors"
                  >+</button>
                </div>
                <div className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700">
                    <strong>Importante:</strong> El tiempo empieza a contar desde que el conductor llega a tu puerta. Si el servicio se extiende más de las horas contratadas, las horas adicionales se abonarán directamente al transportista a razón de <strong>{EXTRA_HOUR_PRICE}€/hora</strong>.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <motion.div key="step4" {...stepVariants} className="space-y-5">
            {/* Route summary */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="space-y-3">
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
              {form.distance_km > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Distancia estimada: {form.distance_km} km
                </p>
              )}
            </div>

            {/* Vehicle */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <img
                src={vehicleData[form.vehicle_type]?.photo}
                alt={vehicleData[form.vehicle_type]?.name}
                className="w-full h-32 object-cover"
              />
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{vehicleData[form.vehicle_type]?.name}</p>
                  <p className="text-xs text-muted-foreground">{vehicleData[form.vehicle_type]?.capacity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{2 + form.extra_hours}h totales</p>
                  {form.extra_hours > 0 && (
                    <p className="text-xs text-primary">+{form.extra_hours}h extra</p>
                  )}
                </div>
              </div>
            </div>

            {/* Notice */}
            <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Recogida y entrega <strong>a pie de calle</strong>. El transportista no sube a pisos ni realiza montaje.</p>
            </div>

            {/* Options */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Seguro de mercancía (+{INSURANCE_PRICE}€)</span>
                </div>
                <Switch
                  checked={form.insurance_selected}
                  onCheckedChange={v => update("insurance_selected", v)}
                />
              </div>
            </div>

            {/* Price */}
            <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Precio estimado</p>
                  <p className="text-3xl font-display font-bold text-foreground">{price.toFixed(2)}€</p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  <p>Base (2h): {vehicleData[form.vehicle_type]?.basePrice}€</p>
                  {form.extra_hours > 0 && <p>Horas extra: +{form.extra_hours * EXTRA_HOUR_PRICE}€</p>}
                  {form.insurance_selected && <p>Seguro: +{INSURANCE_PRICE}€</p>}
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Método de pago</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => update("payment_method", "card")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    form.payment_method === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <CreditCard className={`w-6 h-6 ${form.payment_method === "card" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${form.payment_method === "card" ? "text-primary" : "text-foreground"}`}>
                    Tarjeta
                  </span>
                  <span className="text-xs text-muted-foreground">Pago seguro online</span>
                </button>
                <button
                  onClick={() => update("payment_method", "cash")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    form.payment_method === "cash"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <Banknote className={`w-6 h-6 ${form.payment_method === "cash" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${form.payment_method === "cash" ? "text-primary" : "text-foreground"}`}>
                    Efectivo
                  </span>
                  <span className="text-xs text-muted-foreground">Al conductor</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button variant="outline" className="rounded-xl" onClick={() => setStep(s => s - 1)}>
            Atrás
          </Button>
        )}
        {step < 4 ? (
          <Button className="rounded-xl flex-1 h-12 gap-2" disabled={!canNext()} onClick={nextStep}>
            Continuar
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            className="rounded-xl flex-1 h-12 gap-2"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : form.payment_method === "card" ? (
              <CreditCard className="w-4 h-4" />
            ) : null}
            {form.payment_method === "card" ? "Confirmar y pagar" : "Confirmar y solicitar"}
          </Button>
        )}
      </div>
    </div>
  );
}
