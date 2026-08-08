"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckSquare,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  PenLine,
  Shield,
  Square,
  Users,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import WeightCard from "@/components/common/WeightCard";
import AccessFields from "@/components/request/AccessFields";
import PhotosField from "@/components/request/PhotosField";
import PriceSummary from "@/components/request/PriceSummary";
import ServicePicker from "@/components/request/ServicePicker";
import StopsField from "@/components/request/StopsField";
import { useRequestForm } from "@/components/request/useRequestForm";
import { INCLUDED_HOURS } from "@/lib/pricing";
import { readRequestDraft } from "@/lib/requestIntent";
import { ZONES } from "@/lib/zones";

const TOTAL_STEPS = 4;

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/**
 * Asistente de solicitud, común a invitado y cliente autenticado.
 *
 * Toda la fricción del servicio (plantas sin ascensor, aviso de que la ayuda es
 * un trabajo de dos, límite de objetos del porte, coste por parada) vive aquí,
 * ya dentro del proceso de compra y con el precio recalculándose en vivo. La
 * home y las páginas de servicio solo enseñan el precio base.
 */
export default function RequestWizard({ authenticated = false, user = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draft = readRequestDraft(searchParams);

  const f = useRequestForm({
    draft: { ...draft, payment_method: authenticated ? "card" : "cash" },
    requireName: !authenticated,
    guest: !authenticated,
  });

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const { form, service, quote, tariffs, addressErrors } = f;
  const validation = f.validateStep(step);

  const goNext = () => {
    if (step === 1) f.computeRoute();
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
    else router.push(authenticated ? "/dashboard" : "/");
  };

  const handleSubmit = async (force = false) => {
    setLoading(true);
    setDuplicateWarning(false);
    try {
      // El invitado recibe el aviso de duplicado desde la RPC; el cliente
      // autenticado se comprueba aquí contra sus propios pedidos.
      if (authenticated && !force) {
        const mine = await base44.entities.TransportRequest.filter(
          { created_by_id: user?.id, status: "pending" },
          "-created_date",
          5,
        );
        const recent = mine.find(
          (o) => Date.now() - new Date(o.created_date).getTime() < 30 * 60 * 1000,
        );
        if (recent) {
          setDuplicateWarning(true);
          setLoading(false);
          return;
        }
      }

      const request = await f.submit({
        force,
        clientName: authenticated ? user?.full_name || "Cliente" : undefined,
      });

      if (!authenticated) {
        router.push("/solicitud-enviada");
      } else if (form.payment_method === "card") {
        router.push(`/payment/${request.id}`);
      } else {
        router.push("/my-orders");
      }
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

  const zone = ZONES[f.destinationZoneKey];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={goBack} aria-label="Atrás">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            {service.key === "paquete" ? "Enviar un paquete" : service.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            Paso {step} de {TOTAL_STEPS}
            {authenticated ? "" : " · Como invitado"}
          </p>
        </div>
      </div>

      <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemax={TOTAL_STEPS}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i + 1 <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ---------------------------------------------------------------- */}
        {/* Paso 1 — Servicio, contacto y recorrido                          */}
        {/* ---------------------------------------------------------------- */}
        {step === 1 && (
          <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <ServicePicker value={form.service} onChange={f.setService} />

            {service.hasZones && (
              <div className="space-y-2">
                <Label>¿Dónde se entrega?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(ZONES).map((z) => (
                    <button
                      key={z.key}
                      type="button"
                      onClick={() => f.setZone(z.key)}
                      className={`rounded-2xl border-2 p-4 text-left transition-all ${
                        f.destinationZoneKey === z.key
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <p className="font-heading font-semibold text-sm text-foreground">{z.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {z.key === "villarrobledo"
                          ? "Hasta 10 kg · entrega en 24 h"
                          : "Hasta 30 kg · el mismo día"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!authenticated && (
              <div className="space-y-2">
                <Label>
                  Nombre completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Tu nombre y apellidos"
                  value={form.client_name}
                  onChange={(e) => f.update("client_name", e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                Teléfono de contacto <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ej: 612 345 678"
                type="tel"
                value={form.client_phone}
                onChange={(e) => f.update("client_phone", e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Dirección de recogida{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Calle, número, piso, puerta — Albacete"
                value={form.origin_address}
                onChange={(e) => f.update("origin_address", e.target.value)}
                className={`h-12 rounded-xl ${addressErrors.origin ? "border-destructive" : ""}`}
              />
              <p className={`text-xs ${addressErrors.origin ? "text-destructive" : "text-muted-foreground"}`}>
                {addressErrors.origin || ZONES.albacete.hint}
              </p>
            </div>

            {service.hasStops && (
              <StopsField
                stops={form.stops}
                errors={addressErrors.stops}
                price={tariffs.mudanza_stop}
                onAdd={f.addStop}
                onUpdate={f.updateStop}
                onRemove={f.removeStop}
              />
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" /> Dirección de entrega{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder={`Calle, número, piso, puerta — ${zone.label}`}
                value={form.destination_address}
                onChange={(e) => f.update("destination_address", e.target.value)}
                className={`h-12 rounded-xl ${addressErrors.destination ? "border-destructive" : ""}`}
              />
              <p className={`text-xs ${addressErrors.destination ? "text-destructive" : "text-muted-foreground"}`}>
                {addressErrors.destination || zone.hint}
              </p>
            </div>
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Paso 2 — Qué se transporta y cómo se accede                       */}
        {/* ---------------------------------------------------------------- */}
        {step === 2 && (
          <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                {service.key === "paquete" ? "¿Qué envías?" : "Descripción de la carga"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder={
                  service.key === "paquete"
                    ? "Describe el contenido del paquete: qué es, tamaño aproximado, si es frágil…"
                    : "Describe qué necesitas transportar: tipo de objetos, cantidad, peso aproximado…"
                }
                value={form.cargo_description}
                onChange={(e) => f.update("cargo_description", e.target.value)}
                className="rounded-xl min-h-[100px]"
              />
            </div>

            <PhotosField
              photos={f.photos}
              required={service.needsPhotos}
              uploading={f.uploading}
              onUpload={f.uploadPhotos}
              onRemove={f.removePhoto}
              hint={
                service.needsPhotos
                  ? "Al menos 1 foto. Ayuda al conductor a saber con qué se encuentra."
                  : "Opcional, pero ayuda al repartidor a identificar el paquete."
              }
            />

            {service.hasHelp && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      ¿Necesitas ayuda del conductor?{" "}
                      <span className="text-primary font-semibold">+{tariffs.mudanza_help}€</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Para cargar y descargar contigo.
                    </p>
                  </div>
                  <Switch
                    checked={form.needs_help}
                    onCheckedChange={(v) => f.update("needs_help", v)}
                  />
                </div>

                {form.needs_help && (
                  <div className="space-y-4">
                    {/* El cliente tiene que saber ANTES de pagar que también carga él. */}
                    <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        La ayuda del conductor es un <strong>trabajo de dos</strong>: el conductor
                        carga y descarga <strong>contigo</strong>, no en tu lugar. Si necesitas dos
                        operarios, indícalo abajo y lo valoramos aparte.
                      </p>
                    </div>

                    <Textarea
                      placeholder="Describe qué hay que mover: qué objetos, cuántos, si alguno pesa mucho…"
                      value={form.help_description}
                      onChange={(e) => f.update("help_description", e.target.value)}
                      className="rounded-xl min-h-[80px]"
                    />

                    {service.hasAccess && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground">Accesos</p>
                        <AccessFields
                          label="En la recogida"
                          hasLift={form.origin_has_lift}
                          floors={form.origin_floors}
                          floorPrice={tariffs.mudanza_floor}
                          onChange={(patch) => {
                            if ("hasLift" in patch) f.update("origin_has_lift", patch.hasLift);
                            if ("floors" in patch) f.update("origin_floors", patch.floors);
                          }}
                        />
                        <AccessFields
                          label="En la entrega"
                          hasLift={form.destination_has_lift}
                          floors={form.destination_floors}
                          floorPrice={tariffs.mudanza_floor}
                          onChange={(patch) => {
                            if ("hasLift" in patch) f.update("destination_has_lift", patch.hasLift);
                            if ("floors" in patch) f.update("destination_floors", patch.floors);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sin ayuda contratada el servicio es a pie de calle: hay que aceptarlo. */}
            {!service.needsRecipient && !form.needs_help && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => f.setAcceptPortal((v) => !v)}
                  className="flex items-start gap-3 w-full text-left"
                >
                  {f.acceptPortal ? (
                    <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm text-foreground">
                    Acepto que la mercancía se recoja y entregue a pie de calle (en el portal){" "}
                    <span className="text-destructive">*</span>
                  </span>
                </button>
                <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 ml-8">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Sin ayuda contratada,{" "}
                    <strong>la mercancía debe estar preparada a pie de calle</strong> cuando llegue
                    el conductor.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => f.setAcceptTerms((v) => !v)}
              className="flex items-start gap-3 w-full text-left"
            >
              {f.acceptTerms ? (
                <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              ) : (
                <Square className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <span className="text-sm text-foreground">
                Acepto los{" "}
                <a href="/terminos" className="text-primary underline hover:no-underline" onClick={(e) => e.stopPropagation()}>
                  términos y condiciones
                </a>{" "}
                y la{" "}
                <a href="/privacidad" className="text-primary underline hover:no-underline" onClick={(e) => e.stopPropagation()}>
                  política de privacidad
                </a>{" "}
                <span className="text-destructive">*</span>
              </span>
            </button>
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Paso 3 — Detalles propios de cada servicio                        */}
        {/* ---------------------------------------------------------------- */}
        {step === 3 && (
          <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            {service.hasWeights && (
              <>
                <p className="text-sm text-muted-foreground">
                  {f.destinationZoneKey === "villarrobledo"
                    ? "Envío a Villarrobledo con recogida en Albacete y entrega en 24 horas."
                    : "Elige el peso aproximado de tu paquete (máximo 30 kg)."}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {f.weightOptions.map((bracket) => (
                    <WeightCard
                      key={bracket.key}
                      bracket={bracket}
                      price={tariffs[bracket.priceKey]}
                      selected={form.package_weight === bracket.key}
                      onClick={(k) => f.update("package_weight", k)}
                    />
                  ))}
                </div>
              </>
            )}

            {service.hasExtraHours && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    ¿Necesitas más de {INCLUDED_HOURS} horas?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El precio base incluye {INCLUDED_HOURS} h. Cada hora adicional cuesta{" "}
                    {tariffs.mudanza_extra_hour}€.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => f.update("extra_hours", Math.max(0, form.extra_hours - 1))}
                    disabled={form.extra_hours === 0}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted disabled:opacity-50"
                    aria-label="Quitar una hora"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-display font-bold text-foreground">
                      {INCLUDED_HOURS + form.extra_hours}h
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {form.extra_hours === 0
                        ? `Solo ${INCLUDED_HOURS}h incluidas`
                        : `+${form.extra_hours}h extra (+${form.extra_hours * tariffs.mudanza_extra_hour}€)`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => f.update("extra_hours", form.extra_hours + 1)}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted"
                    aria-label="Añadir una hora"
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-orange-700">
                    El tiempo empieza a contar cuando el conductor llega a tu puerta. Si el servicio
                    se alarga, cada hora extra se abona al conductor a{" "}
                    <strong>{tariffs.mudanza_extra_hour}€/hora</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* El porte tiene un límite real de carga: aquí se pacta, no en la home. */}
            {service.hasItemsLimit && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    ¿Cuántos objetos vas a transportar?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El porte cubre hasta {service.maxItems} objetos (lavadora, lavavajillas,
                    colchón…).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => f.update("items_count", Math.max(1, (form.items_count || 1) - 1))}
                    disabled={(form.items_count || 1) <= 1}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted disabled:opacity-50"
                    aria-label="Quitar un objeto"
                  >
                    −
                  </button>
                  <p className="flex-1 text-center text-2xl font-display font-bold text-foreground">
                    {form.items_count || 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => f.update("items_count", (form.items_count || 1) + 1)}
                    className="w-9 h-9 rounded-xl border border-border bg-background flex items-center justify-center text-lg font-bold hover:bg-muted"
                    aria-label="Añadir un objeto"
                  >
                    +
                  </button>
                </div>
                {(form.items_count || 1) > service.maxItems ? (
                  <div className="flex gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                    <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">
                      Con más de {service.maxItems} objetos el servicio es una{" "}
                      <strong>mini mudanza</strong>. Cámbialo en el paso 1 para ver su precio.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Declara la carga con exactitud. Si al llegar no se corresponde con lo
                      indicado, <strong>el servicio se cobrará como mini mudanza o se cancelará</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {service.needsRecipient && (
              <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground">¿Quién recibe la entrega?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    El conductor le pedirá la firma al entregar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>
                    Nombre del receptor <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nombre y apellidos"
                    value={form.recipient_name}
                    onChange={(e) => f.update("recipient_name", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono del receptor</Label>
                  <Input
                    placeholder="Ej: 612 345 678"
                    type="tel"
                    value={form.recipient_phone}
                    onChange={(e) => f.update("recipient_phone", e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="flex gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <PenLine className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800">
                    En este servicio la <strong>firma del receptor es obligatoria</strong>: queda
                    registrada junto a la hora y la ubicación de la entrega.
                  </p>
                </div>
              </div>
            )}

            {!service.hasWeights && !service.hasExtraHours && !service.hasItemsLimit && !service.needsRecipient && (
              <div className="flex gap-3 p-4 rounded-xl bg-muted border border-border">
                <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Este servicio tiene precio cerrado. Continúa para ver el resumen.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Paso 4 — Resumen y pago                                          */}
        {/* ---------------------------------------------------------------- */}
        {step === 4 && (
          <motion.div key="step4" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{form.origin_address}</span>
              </div>
              {form.stops
                .filter((s) => s.address.trim())
                .map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{s.address}</span>
                  </div>
                ))}
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{form.destination_address}</span>
              </div>
              {form.distance_km > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  Distancia estimada: {form.distance_km} km
                </p>
              )}
            </div>

            {service.hasInsurance && (
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Seguro de mercancía (+{tariffs.insurance}€)</span>
                  </div>
                  <Switch
                    checked={form.insurance_selected}
                    onCheckedChange={(v) => f.update("insurance_selected", v)}
                  />
                </div>
              </div>
            )}

            <PriceSummary quote={quote} />

            {authenticated ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Método de pago</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "card", icon: CreditCard, label: "Tarjeta", hint: "Pago seguro online" },
                    { key: "cash", icon: Banknote, label: "Efectivo", hint: "Al conductor" },
                  ].map(({ key, icon: Icon, label, hint }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => f.update("payment_method", key)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        form.payment_method === key
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${form.payment_method === key ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-3 p-4 rounded-xl bg-muted border border-border items-center">
                <Banknote className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-foreground">
                  Pago en <strong>efectivo al conductor</strong>. Para pagar con tarjeta,{" "}
                  <a href="/login-clientes" className="text-primary underline">
                    inicia sesión
                  </a>
                  .
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {duplicateWarning && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Ya hay una solicitud pendiente</strong> creada hace menos de 30 minutos. Si
              fuiste tú, no hace falta crear otra: un conductor la aceptará en breve.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl flex-1"
              onClick={() =>
                authenticated ? router.push("/my-orders") : setDuplicateWarning(false)
              }
            >
              {authenticated ? "Ver mis pedidos" : "Vale, no crear otra"}
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

      <div className="space-y-2 pt-2">
        {!validation.ok && step < TOTAL_STEPS && (
          <p className="text-xs text-muted-foreground text-center">{validation.reason}</p>
        )}
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" className="rounded-xl" onClick={goBack}>
              Atrás
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button className="rounded-xl flex-1 h-12 gap-2" disabled={!validation.ok} onClick={goNext}>
              Continuar <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="rounded-xl flex-1 h-12 gap-2"
              disabled={loading || duplicateWarning || quote.total <= 0}
              onClick={() => handleSubmit(false)}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : form.payment_method === "card" && authenticated ? (
                <CreditCard className="w-4 h-4" />
              ) : (
                <Banknote className="w-4 h-4" />
              )}
              {authenticated && form.payment_method === "card"
                ? "Confirmar y pagar"
                : "Confirmar solicitud"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
