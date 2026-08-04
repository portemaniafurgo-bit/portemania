"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

// Wizard logic & UI imports (same as GuestRequestContent)
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import VehicleCard, { vehicleData } from "@/components/common/VehicleCard";
import WeightCard from "@/components/common/WeightCard";
import {
  useTariffs,
  estimatePrice,
  estimatePackagePrice,
  PACKAGE_WEIGHTS,
  packageWeightLabel,
} from "@/lib/tariffs";
import { geocodeAlbacete, fetchRouteEta } from "@/lib/eta";
import {
  buildRequestHref,
  hasRequestDraft,
  readRequestDraft,
  resolveRequestIntent,
} from "@/lib/requestIntent";

import AccessModal from "@/components/landing/AccessModal";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Images,
  MapPin,
  Package,
  Truck,
  Shield,
  AlertCircle,
  Loader2,
  Banknote,
  CheckSquare,
  Square,
} from "lucide-react";

const DriversMapInner = dynamic(
  () => import("@/components/landing/DriversMapSectionInner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-neutral-200 animate-pulse" />
    ),
  }
);

const services = [
  { key: "porte", icon: "local_shipping", label: "Porte", desc: "Directo A a B" },
  { key: "mini_mudanza", icon: "home", label: "Mini mudanza", desc: "Habitaciones" },
  { key: "compra_tienda", icon: "store", label: "Compra en tienda", desc: "Voluminosos" },
  { key: "envio_paquete", icon: "inventory_2", label: "Envío de paquete", desc: "Hasta 30 kg" },
];

const ALBACETE_CP = [
  "02001", "02002", "02003", "02004", "02005", "02006", "02007", "02008",
];

const extractCPs = (address) => address.match(/\b\d{5}\b/g) || [];
const hasValidCP = (address) =>
  extractCPs(address).some((cp) => ALBACETE_CP.includes(cp));

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tariffs = useTariffs();

  const draft = readRequestDraft(searchParams);
  const initialIntent = resolveRequestIntent(searchParams);

  const serviceKeyFromDraft = (() => {
    if (initialIntent.service === "package") return "envio_paquete";
    if (initialIntent.vehicle === "large") return "mini_mudanza";
    return "porte";
  })();

  const [step, setStep] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(serviceKeyFromDraft);

  const [form, setForm] = useState({
    client_name: draft.client_name || "",
    client_phone: draft.client_phone || "",
    origin_address: draft.origin_address || "",
    destination_address: draft.destination_address || "",
    cargo_description: "",
    vehicle_type: initialIntent.vehicle || "",
    service_type: initialIntent.service || "transport",
    package_weight: "",
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

  const isPackage = form.service_type === "package";
  const totalSteps = 4;

  const handleSelectService = (key) => {
    setSelectedService(key);
    const intent = resolveRequestIntent({ service: key });
    setForm((prev) => ({
      ...prev,
      service_type: intent.service,
      vehicle_type: intent.vehicle,
      ...(intent.service === "package"
        ? {
            vehicle_type: "",
            extra_hours: 0,
            insurance_selected: false,
            needs_help: false,
            help_description: "",
          }
        : { package_weight: "" }),
    }));
  };

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "origin_address") validateCP("origin", value);
    if (field === "destination_address") validateCP("destination", value);
  };

  const validateCP = (field, value) => {
    if (!value.trim()) {
      setCpError((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    const cps = extractCPs(value);
    if (cps.length === 0) {
      setCpError((prev) => ({
        ...prev,
        [field]: "El código postal es obligatorio (02001–02008).",
      }));
    } else if (!cps.some((cp) => ALBACETE_CP.includes(cp))) {
      setCpError((prev) => ({
        ...prev,
        [field]: `El código postal ${cps[0]} no pertenece a Albacete capital (02001–02008).`,
      }));
    } else {
      setCpError((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const computeDistance = async () => {
    if (!form.origin_address || !form.destination_address) return null;
    try {
      const [from, to] = await Promise.all([
        geocodeAlbacete(form.origin_address),
        geocodeAlbacete(form.destination_address),
      ]);
      if (!from || !to) return null;
      const route = await fetchRouteEta(from, to);
      const patch = {
        distance_km: route?.km ?? null,
        origin_lat: from.lat,
        origin_lng: from.lng,
        destination_lat: to.lat,
        destination_lng: to.lng,
      };
      setForm((prev) => ({ ...prev, ...patch }));
      return patch;
    } catch {
      return null;
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotos((prev) => [...prev, file_url]);
      }
    } catch (err) {
      console.error("Error al subir la foto:", err);
      toast({
        title: "Error al subir la foto",
        description:
          "No se pudo subir la foto. Comprueba tu conexión e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = async (force = false) => {
    setLoading(true);
    setDuplicateWarning(false);
    try {
      const dist = form.origin_lat ? null : await computeDistance();
      const finalPrice = isPackage
        ? estimatePackagePrice(tariffs, form.package_weight)
        : estimatePrice(
            tariffs,
            form.vehicle_type,
            form.extra_hours,
            form.insurance_selected,
            form.needs_help
          );

      const request = await base44.entities.TransportRequest.create({
        ...form,
        ...(dist || {}),
        distance_km: (dist?.distance_km ?? form.distance_km) || null,
        estimated_price: finalPrice,
        cargo_photos: photos,
        helpers_count: 0,
        status: "pending",
        payment_status: "pending",
        ...(force ? { force: true } : {}),
      });

      supabase.functions
        .invoke("send-email", {
          body: { mode: "new_request", order_id: request.id },
        })
        .catch(() => {});

      router.push("/solicitud-enviada");
    } catch (err) {
      if (String(err?.message || "").includes("duplicate_pending")) {
        setDuplicateWarning(true);
      } else {
        console.error("Error al enviar la solicitud:", err);
        alert(
          "Hubo un error al enviar tu solicitud. Por favor inténtalo de nuevo."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 1)
      return (
        form.client_name.trim() &&
        form.client_phone.trim() &&
        hasValidCP(form.origin_address) &&
        hasValidCP(form.destination_address)
      );
    if (step === 2) {
      if (isPackage)
        return (
          form.cargo_description &&
          form.cargo_description.length >= 5 &&
          acceptTerms
        );
      return (
        form.cargo_description &&
        form.cargo_description.length >= 10 &&
        photos.length >= 1 &&
        (!form.needs_help || form.help_description.trim().length >= 5) &&
        (form.needs_help || acceptPortal) &&
        acceptTerms
      );
    }
    if (step === 3) return isPackage ? form.package_weight : form.vehicle_type;
    return true;
  };

  const nextStep = () => {
    if (step === 1) computeDistance();
    setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const handleContinueStep1 = () => {
    if (!canNext()) return;
    if (!isAuthenticated) {
      setShowModal(true);
    } else {
      setStep(2);
    }
  };

  const handleGuestContinue = () => {
    setShowModal(false);
    setStep(2);
  };

  const requestParamsForUrl = {
    service: form.service_type,
    vehicle: form.vehicle_type,
    client_name: form.client_name,
    client_phone: form.client_phone,
    origin_address: form.origin_address,
    destination_address: form.destination_address,
  };
  const loginHref = buildRequestHref("/login-clientes", requestParamsForUrl);
  const registerHref = buildRequestHref("/register", requestParamsForUrl);

  const price = isPackage
    ? estimatePackagePrice(tariffs, form.package_weight)
    : estimatePrice(
        tariffs,
        form.vehicle_type,
        form.extra_hours,
        form.insurance_selected,
        form.needs_help
      );

  const stepVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <section className="relative h-[600px] flex overflow-hidden">
      {/* LEFT PANEL: Wizard */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-[#7145d6] flex-shrink-0 flex flex-col z-20 shadow-2xl h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="flex items-center gap-3 mb-3">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-bold text-xl text-white">
                {step === 1
                  ? "Solicitar transporte"
                  : isPackage
                  ? "Enviar un paquete"
                  : "Solicitar transporte"}
              </h2>
              <p className="text-sm text-white/70">
                Paso {step} de {totalSteps}
                {step > 1 ? " · Como invitado" : ""}
              </p>
            </div>
          </div>
          {/* Progress */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 overflow-y-auto ${
            step === 1 ? "px-6 pb-6 pt-0" : "bg-gray-50 px-4 py-4"
          }`}
        >
          <AnimatePresence mode="wait">
            {/* STEP 1: Original Hero Form (purple theme) */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-5"
              >
                <div className="grid grid-cols-2 gap-3">
                  {services.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => handleSelectService(s.key)}
                      className={`p-4 rounded-xl border-2 flex flex-col gap-2 cursor-pointer transition-colors text-left ${
                        selectedService === s.key
                          ? "border-white bg-white/20"
                          : "border-white/40 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          selectedService === s.key
                            ? "text-white"
                            : "text-white/70"
                        }`}
                      >
                        {s.icon}
                      </span>
                      <div>
                        <div
                          className={`font-semibold text-sm ${
                            selectedService === s.key
                              ? "text-white"
                              : "text-white/70"
                          }`}
                        >
                          {s.label}
                        </div>
                        <div className="text-xs text-white/60">{s.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="bg-white/10 border border-white/30 rounded-xl p-4 flex gap-3">
                  <span className="material-symbols-outlined text-white">
                    info
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold text-white">
                      {isPackage
                        ? "Envío de paquetes el mismo día"
                        : "Servicio de portes en Albacete capital"}
                    </p>
                    <p className="text-white/80">
                      {isPackage ? (
                        <>
                          Recogemos y entregamos tu paquete (hasta{" "}
                          <span className="text-white font-semibold">30 kg</span>
                          ) dentro de{" "}
                          <span className="text-white font-semibold">
                            Albacete capital
                          </span>{" "}
                          el mismo día.
                        </>
                      ) : (
                        <>
                          Operamos exclusivamente dentro de{" "}
                          <span className="text-white font-semibold">
                            Albacete capital
                          </span>
                          . Recogida y entrega{" "}
                          <span className="text-white font-semibold">
                            a pie de calle
                          </span>
                          .
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">
                    Nombre completo <span className="text-white/70">*</span>
                  </label>
                  <input
                    className="w-full bg-white/10 border border-white/40 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all"
                    placeholder="Tu nombre y apellidos"
                    type="text"
                    value={form.client_name}
                    onChange={(e) => update("client_name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">
                    Teléfono de contacto <span className="text-white/70">*</span>
                  </label>
                  <input
                    className="w-full bg-white/10 border border-white/40 rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all"
                    placeholder="Ej: 612 345 678"
                    type="tel"
                    value={form.client_phone}
                    onChange={(e) => update("client_phone", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      my_location
                    </span>{" "}
                    Dirección de recogida{" "}
                    <span className="text-white/70">*</span>
                  </label>
                  <input
                    className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all ${
                      cpError.origin ? "border-red-400" : "border-white/40"
                    }`}
                    placeholder="Calle, número, piso, puerta — Albacete"
                    type="text"
                    value={form.origin_address}
                    onChange={(e) => update("origin_address", e.target.value)}
                  />
                  {cpError.origin ? (
                    <p className="text-xs text-red-300">{cpError.origin}</p>
                  ) : (
                    <p className="text-xs text-white/80">
                      Incluye código postal (02001–02008)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      location_on
                    </span>{" "}
                    Dirección de entrega{" "}
                    <span className="text-white/70">*</span>
                  </label>
                  <input
                    className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all ${
                      cpError.destination
                        ? "border-red-400"
                        : "border-white/40"
                    }`}
                    placeholder="Calle, número, piso, puerta — Albacete"
                    type="text"
                    value={form.destination_address}
                    onChange={(e) =>
                      update("destination_address", e.target.value)
                    }
                  />
                  {cpError.destination ? (
                    <p className="text-xs text-red-300">
                      {cpError.destination}
                    </p>
                  ) : (
                    <p className="text-xs text-white/80">
                      Incluye código postal (02001–02008)
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleContinueStep1}
                    disabled={!canNext()}
                    className="w-full bg-white text-[#7145d6] py-4 rounded-full font-semibold text-sm hover:bg-opacity-90 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar{" "}
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Cargo details */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />{" "}
                    {isPackage ? "¿Qué envías?" : "Descripción de la carga"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder={
                      isPackage
                        ? "Describe el contenido del paquete: qué es, tamaño aproximado, si es frágil…"
                        : "Describe qué necesitas transportar: tipo de objetos, cantidad, peso aproximado..."
                    }
                    value={form.cargo_description}
                    onChange={(e) => update("cargo_description", e.target.value)}
                    className="rounded-xl min-h-[100px]"
                  />
                  {form.cargo_description.length > 0 &&
                    form.cargo_description.length < (isPackage ? 5 : 10) && (
                      <p className="text-xs text-destructive">
                        Mínimo {isPackage ? 5 : 10} caracteres (
                        {form.cargo_description.length}/
                        {isPackage ? 5 : 10})
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />{" "}
                    {isPackage
                      ? "Foto del paquete"
                      : "Fotos de la mercancía"}{" "}
                    {isPackage ? (
                      <span className="text-xs text-muted-foreground font-normal">
                        (opcional)
                      </span>
                    ) : (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isPackage
                      ? "Opcional, pero ayuda al repartidor a identificar el paquete."
                      : "Al menos 1 foto requerida."}
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {photos.map((url, i) => (
                      <div
                        key={i}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-border"
                      >
                        <img
                          src={url}
                          alt="cargo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    <label
                      className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                        !isPackage && photos.length === 0
                          ? "border-destructive/60 hover:border-destructive"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Camera className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground leading-none">
                        Hacer foto
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors">
                      <Images className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground leading-none">
                        Galería
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                  {!isPackage && photos.length === 0 && (
                    <p className="text-xs text-destructive">
                      Debes subir al menos 1 foto
                    </p>
                  )}
                </div>

                {/* Help toggle (transport only) */}
                {!isPackage && (
                  <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          ¿Necesitas ayuda del conductor?{" "}
                          <span className="text-primary font-semibold">
                            +{tariffs.help_price}€
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Por ejemplo: bajar un sofá, cargar cajas…
                        </p>
                      </div>
                      <Switch
                        checked={form.needs_help}
                        onCheckedChange={(v) => update("needs_help", v)}
                      />
                    </div>
                    {form.needs_help && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Describe qué hay que hacer y cómo: qué objeto, en qué piso, ¿hay ascensor?…"
                          value={form.help_description}
                          onChange={(e) =>
                            update("help_description", e.target.value)
                          }
                          className="rounded-xl min-h-[80px]"
                        />
                        {form.help_description.trim().length < 5 && (
                          <p className="text-xs text-destructive">
                            Describe la ayuda que necesitas (obligatorio)
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          El conductor verá tu petición antes de aceptar el
                          trabajo y decidirá si puede ayudarte.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {!isPackage &&
                    (form.needs_help ? (
                      <div className="flex gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="flex-shrink-0">🤝</span>
                        <p className="text-xs text-emerald-800">
                          Con la ayuda contratada, el conductor{" "}
                          <strong>sube/baja la mercancía contigo</strong> — no
                          hace falta tenerla a pie de calle.
                        </p>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setAcceptPortal((v) => !v)}
                          className="flex items-start gap-3 w-full text-left"
                        >
                          {acceptPortal ? (
                            <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <span className="text-sm text-foreground">
                            Acepto que la mercancía sea recogida a pie de calle
                            (en el portal){" "}
                            <span className="text-destructive">*</span>
                          </span>
                        </button>
                        <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 ml-8">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">
                            Sin ayuda contratada,{" "}
                            <strong>
                              la mercancía debe estar preparada a pie de calle
                            </strong>{" "}
                            cuando llegue el conductor.
                          </p>
                        </div>
                      </>
                    ))}

                  <button
                    type="button"
                    onClick={() => setAcceptTerms((v) => !v)}
                    className="flex items-start gap-3 w-full text-left"
                  >
                    {acceptTerms ? (
                      <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <span className="text-sm text-foreground">
                      Acepto los{" "}
                      <a
                        href="/terminos"
                        className="text-primary underline hover:no-underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        términos y condiciones
                      </a>{" "}
                      y la{" "}
                      <a
                        href="/privacidad"
                        className="text-primary underline hover:no-underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        política de privacidad
                      </a>{" "}
                      <span className="text-destructive">*</span>
                    </span>
                  </button>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={prevStep}
                  >
                    Atrás
                  </Button>
                  <Button
                    className="rounded-xl flex-1 h-12 gap-2"
                    disabled={!canNext()}
                    onClick={nextStep}
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Vehicle / Package weight */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                {isPackage ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Elige el peso aproximado de tu paquete (máximo 30 kg)
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {PACKAGE_WEIGHTS.map((b) => (
                        <WeightCard
                          key={b.key}
                          bracket={b}
                          price={tariffs[b.priceKey]}
                          selected={form.package_weight === b.key}
                          onClick={(k) => update("package_weight", k)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">
                        Envío el <strong>mismo día</strong> dentro de Albacete
                        capital. Un repartidor recoge tu paquete y lo entrega en
                        la dirección indicada.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Selecciona el tipo de vehículo adecuado para tu carga
                    </p>
                    {form.needs_help ? (
                      <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="flex-shrink-0">🤝</span>
                        <div className="text-sm text-emerald-800">
                          <p className="font-semibold mb-0.5">
                            Ayuda del conductor contratada
                          </p>
                          <p>
                            El conductor te ayudará a subir/bajar la mercancía
                            (incluido en el precio).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold mb-0.5">
                            Entrega y recogida a pie de calle
                          </p>
                          <p>
                            El conductor no sube a pisos ni realiza montaje.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      {Object.keys(vehicleData).map((type) => (
                        <VehicleCard
                          key={type}
                          type={type}
                          price={tariffs[type]}
                          selected={form.vehicle_type === type}
                          onClick={(t) => update("vehicle_type", t)}
                        />
                      ))}
                    </div>
                    {form.vehicle_type && (
                      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            ¿Necesitas más de 2 horas?
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Cada hora adicional cuesta {tariffs.extra_hour}€.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              update(
                                "extra_hours",
                                Math.max(0, form.extra_hours - 1)
                              )
                            }
                            className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted disabled:opacity-50"
                            disabled={form.extra_hours === 0}
                          >
                            −
                          </button>
                          <div className="flex-1 text-center">
                            <p className="text-2xl font-display font-bold text-foreground">
                              {2 + form.extra_hours}h
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {form.extra_hours === 0
                                ? "Solo 2h incluidas"
                                : `+${form.extra_hours}h extra (+${
                                    form.extra_hours * tariffs.extra_hour
                                  }€)`}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              update("extra_hours", form.extra_hours + 1)
                            }
                            className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
                          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-orange-700">
                            <strong>Importante:</strong> El tiempo empieza a
                            contar desde que el conductor llega a tu puerta. Si
                            el servicio se extiende más de las horas contratadas,
                            las horas adicionales se abonarán directamente al
                            transportista a razón de{" "}
                            <strong>{tariffs.extra_hour}€/hora</strong>.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={prevStep}
                  >
                    Atrás
                  </Button>
                  <Button
                    className="rounded-xl flex-1 h-12 gap-2"
                    disabled={!canNext()}
                    onClick={nextStep}
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Summary */}
            {step === 4 && (
              <motion.div
                key="step4"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-5"
              >
                <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Cliente
                  </p>
                  <p className="font-semibold text-foreground">
                    {form.client_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {form.client_phone}
                  </p>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">
                      {form.origin_address}
                    </span>
                  </div>
                  <div className="ml-1.5 border-l-2 border-dashed border-primary/30 h-4" />
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-foreground">
                      {form.destination_address}
                    </span>
                  </div>
                </div>

                {isPackage ? (
                  <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">
                        Envío de paquete
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {packageWeightLabel(form.package_weight)} · el mismo día
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    <img
                      src={vehicleData[form.vehicle_type]?.photo}
                      alt={vehicleData[form.vehicle_type]?.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {vehicleData[form.vehicle_type]?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {vehicleData[form.vehicle_type]?.capacity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {2 + form.extra_hours}h totales
                      </p>
                    </div>
                  </div>
                )}

                {!isPackage &&
                  (form.needs_help ? (
                    <div className="flex gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="flex-shrink-0">🤝</span>
                      <p className="text-sm text-emerald-800">
                        Con <strong>ayuda del conductor</strong>: te ayudará a
                        subir/bajar la mercancía.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        Recogida y entrega{" "}
                        <strong>a pie de calle</strong>.
                      </p>
                    </div>
                  ))}

                {!isPackage && (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          Seguro de mercancía (+{tariffs.insurance}€)
                        </span>
                      </div>
                      <Switch
                        checked={form.insurance_selected}
                        onCheckedChange={(v) =>
                          update("insurance_selected", v)
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="bg-primary/5 rounded-2xl border-2 border-primary/20 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isPackage ? "Precio del envío" : "Precio estimado"}
                      </p>
                      <p className="text-3xl font-display font-bold text-foreground">
                        {price.toFixed(2)}€
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      {isPackage ? (
                        <>
                          <p>Envío de paquete</p>
                          <p>
                            {packageWeightLabel(form.package_weight)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p>Base (2h): {tariffs[form.vehicle_type]}€</p>
                          {form.extra_hours > 0 && (
                            <p>
                              Horas extra: +
                              {form.extra_hours * tariffs.extra_hour}€
                            </p>
                          )}
                          {form.insurance_selected && (
                            <p>Seguro: +{tariffs.insurance}€</p>
                          )}
                          {form.needs_help && (
                            <p>
                              Ayuda del conductor: +{tariffs.help_price}€
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 p-4 rounded-xl bg-muted border border-border items-center">
                  <Banknote className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    Pago en <strong>efectivo al conductor</strong>. Para pagar
                    con tarjeta,{" "}
                    <a
                      href="/login-clientes"
                      className="text-primary underline"
                    >
                      inicia sesión
                    </a>
                    .
                  </p>
                </div>

                {duplicateWarning && (
                  <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300">
                    <div className="flex gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        <strong>
                          Ya hay una solicitud pendiente con este teléfono
                        </strong>{" "}
                        creada hace menos de 30 minutos. Si fuiste tú, no hace
                        falta crear otra: un conductor la aceptará en breve.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl flex-1"
                        onClick={() => setDuplicateWarning(false)}
                      >
                        Vale, no crear otra
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl flex-1"
                        disabled={loading}
                        onClick={() => handleSubmit(true)}
                      >
                        Crear otra igualmente
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={prevStep}
                  >
                    Atrás
                  </Button>
                  <Button
                    className="rounded-xl flex-1 h-12 gap-2"
                    disabled={loading || duplicateWarning}
                    onClick={() => handleSubmit(false)}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Banknote className="w-4 h-4" />
                    )}
                    Confirmar solicitud
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT PANEL: Map */}
      <div className="flex-1 relative bg-neutral-900 overflow-hidden hidden md:block h-full">
        <DriversMapInner onDriverClick={() => setShowModal(true)} />
        {!isAuthenticated && (
          <div className="absolute top-8 right-8 z-[1000] flex items-center gap-6 bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/30 shadow-xl">
            <div className="flex items-center gap-3">
              <Link
                href="/login-clientes"
                className="bg-white/90 backdrop-blur-sm text-black hover:bg-white font-bold text-sm transition-all px-6 py-3 rounded-xl shadow-sm border border-white/40"
              >
                Entrar
              </Link>
              <Link
                href="/register"
                className="bg-black text-white hover:opacity-90 font-bold text-sm transition-all px-6 py-3 rounded-xl shadow-sm"
              >
                Registrarse
              </Link>
            </div>
          </div>
        )}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-11/12 max-w-4xl bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 z-[1000] border border-white/40">
          <div className="w-full">
            <h3 className="font-semibold text-xl text-gray-900 mb-4">
              Conductores en Albacete
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    person_pin_circle
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    Conductores Activos
                  </div>
                  <div className="font-semibold text-sm text-gray-900">
                    12 disponibles ahora
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    schedule
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    Tiempo de espera
                  </div>
                  <div className="font-semibold text-sm text-gray-900">
                    ~ 8 minutos
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">
                    verified
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    Zona de cobertura
                  </div>
                  <div className="font-semibold text-sm text-gray-900">
                    Toda la ciudad
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access Modal */}
      <AccessModal
        open={showModal}
        onClose={() => setShowModal(false)}
        loginHref={loginHref}
        registerHref={registerHref}
        onGuestContinue={handleGuestContinue}
      />
    </section>
  );
}
