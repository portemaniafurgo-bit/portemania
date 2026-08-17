"use client";

import { useCallback, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/entities";
import { toast } from "@/components/ui/use-toast";
import { SERVICES } from "@/lib/services";
import { useTariffs, quoteRequest, weightsForZone, MAX_STOPS } from "@/lib/tariffs";
import { geocodeAlbacete, fetchRouteEta } from "@/lib/eta";
import { isInZone, postalCodeError } from "@/lib/zones";

/**
 * Estado, validación, precio y envío del asistente de solicitud.
 *
 * Lo comparten el asistente del hero, el de invitado y el del cliente
 * autenticado: son tres presentaciones del mismo pedido y antes vivían
 * duplicados en tres archivos que se desincronizaban.
 */

const emptyForm = (draft = {}) => ({
  service: draft.service || "porte",
  destination_zone: draft.destination_zone || "albacete",
  client_name: draft.client_name || "",
  client_phone: draft.client_phone || "",
  origin_address: draft.origin_address || "",
  destination_address: draft.destination_address || "",
  stops: [],
  cargo_description: "",
  items_count: 1,
  needs_help: false,
  help_description: "",
  origin_has_lift: null,
  origin_floors: 1,
  destination_has_lift: null,
  destination_floors: 1,
  package_weight: "",
  extra_hours: 0,
  insurance_selected: false,
  recipient_name: "",
  recipient_phone: "",
  payment_method: draft.payment_method || "cash",
  notes: "",
  distance_km: 0,
  // Negociación (solo con cuenta): precio propuesto por el cliente, opcional.
  proposed_price: "",
});

export function useRequestForm({ draft = {}, requireName = true, guest = true } = {}) {
  const tariffs = useTariffs();
  const [form, setForm] = useState(() => emptyForm(draft));
  const [photos, setPhotos] = useState([]);
  const [acceptPortal, setAcceptPortal] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [uploading, setUploading] = useState(false);

  const service = SERVICES[form.service] || SERVICES.porte;
  const quote = useMemo(() => quoteRequest(tariffs, form), [tariffs, form]);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Cambiar de servicio limpia lo que ya no aplica: si no, un pedido que empezó
   * como mini mudanza podía acabar cobrando paradas siendo un porte.
   */
  const setService = useCallback((key) => {
    const next = SERVICES[key];
    if (!next) return;
    setForm((prev) => ({
      ...prev,
      service: key,
      destination_zone: next.hasZones ? prev.destination_zone : "albacete",
      stops: next.hasStops ? prev.stops : [],
      extra_hours: next.hasExtraHours ? prev.extra_hours : 0,
      needs_help: next.hasHelp ? prev.needs_help : false,
      help_description: next.hasHelp ? prev.help_description : "",
      origin_has_lift: next.hasAccess ? prev.origin_has_lift : null,
      destination_has_lift: next.hasAccess ? prev.destination_has_lift : null,
      insurance_selected: next.hasInsurance ? prev.insurance_selected : false,
      package_weight: next.hasWeights ? prev.package_weight : "",
      items_count: next.hasItemsLimit ? prev.items_count : null,
      recipient_name: next.needsRecipient ? prev.recipient_name : "",
      recipient_phone: next.needsRecipient ? prev.recipient_phone : "",
    }));
    setAcceptPortal(false);
  }, []);

  /** Villarrobledo solo tiene un tramo de peso: cambiar de zona lo reinicia. */
  const setZone = useCallback((zone) => {
    setForm((prev) => ({
      ...prev,
      destination_zone: zone,
      destination_address: "",
      package_weight: zone === "villarrobledo" ? "vr_light" : "",
    }));
  }, []);

  // --- Paradas intermedias -------------------------------------------------
  const addStop = useCallback(() => {
    setForm((prev) =>
      prev.stops.length >= MAX_STOPS ? prev : { ...prev, stops: [...prev.stops, { address: "" }] },
    );
  }, []);

  const updateStop = useCallback((index, address) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.map((s, i) => (i === index ? { ...s, address } : s)),
    }));
  }, []);

  const removeStop = useCallback((index) => {
    setForm((prev) => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) }));
  }, []);

  // --- Fotos ---------------------------------------------------------------
  const uploadPhotos = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setPhotos((prev) => [...prev, file_url]);
      }
    } catch (err) {
      console.error("Error al subir la foto:", err);
      toast({
        title: "Error al subir la foto",
        description: "No se pudo subir la foto. Comprueba tu conexión e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }, []);

  const removePhoto = useCallback((index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // --- Direcciones y ruta --------------------------------------------------
  const destinationZoneKey = service.hasZones ? form.destination_zone : "albacete";

  const addressErrors = useMemo(
    () => ({
      origin: postalCodeError(form.origin_address, "albacete"),
      destination: postalCodeError(form.destination_address, destinationZoneKey),
      stops: form.stops.map((s) => postalCodeError(s.address, "albacete")),
    }),
    [form.origin_address, form.destination_address, form.stops, destinationZoneKey],
  );

  /**
   * Distancia y coordenadas reales por carretera (OSRM). Si falla la
   * geocodificación se guarda null y el pedido sigue: la distancia es
   * informativa, nunca decide el precio.
   */
  const computeRoute = useCallback(async () => {
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
  }, [form.origin_address, form.destination_address]);

  // --- Validación por paso -------------------------------------------------
  /** @returns {{ok: boolean, reason: string}} motivo visible para el cliente. */
  const validateStep = useCallback(
    (step) => {
      const fail = (reason) => ({ ok: false, reason });

      if (step === 1) {
        if (requireName && !form.client_name.trim()) return fail("Indica tu nombre");
        if (!form.client_phone.trim()) return fail("Indica un teléfono de contacto");
        if (!isInZone(form.origin_address, "albacete"))
          return fail("La recogida debe estar en Albacete capital (02001–02008)");
        if (!isInZone(form.destination_address, destinationZoneKey))
          return fail(
            destinationZoneKey === "villarrobledo"
              ? "La entrega debe estar en Villarrobledo (02600)"
              : "La entrega debe estar en Albacete capital (02001–02008)",
          );
        if (form.stops.some((s) => !isInZone(s.address, "albacete")))
          return fail("Completa las paradas con una dirección de Albacete capital");
        return { ok: true, reason: "" };
      }

      if (step === 2) {
        const min = service.key === "paquete" ? 5 : 10;
        if ((form.cargo_description || "").trim().length < min)
          return fail(`Describe la carga (mínimo ${min} caracteres)`);
        if (service.needsPhotos && photos.length === 0) return fail("Sube al menos 1 foto");
        if (service.hasHelp && form.needs_help) {
          if (form.help_description.trim().length < 5) return fail("Describe la ayuda que necesitas");
          if (form.origin_has_lift === null) return fail("Indica si hay ascensor en la recogida");
          if (form.destination_has_lift === null) return fail("Indica si hay ascensor en la entrega");
        }
        if (!service.hasHelp || !form.needs_help) {
          if (service.key !== "paquete" && service.key !== "porte_tienda" && !acceptPortal)
            return fail("Confirma que la recogida es a pie de calle");
        }
        if (!acceptTerms) return fail("Acepta los términos y la política de privacidad");
        return { ok: true, reason: "" };
      }

      if (step === 3) {
        if (service.hasWeights && !form.package_weight) return fail("Elige el peso del paquete");
        if (service.hasItemsLimit) {
          const n = Number(form.items_count) || 0;
          if (n < 1) return fail("Indica cuántos objetos transportas");
          if (n > service.maxItems)
            return fail(`Un porte admite hasta ${service.maxItems} objetos — elige mini mudanza`);
        }
        if (service.needsRecipient && !form.recipient_name.trim())
          return fail("Indica quién recibe el envío");
        return { ok: true, reason: "" };
      }

      return { ok: true, reason: "" };
    },
    [form, photos, service, acceptPortal, acceptTerms, requireName, destinationZoneKey],
  );

  // --- Envío ---------------------------------------------------------------
  /**
   * Crea el pedido. El precio final lo fija el servidor (trigger
   * set_request_price); `quote` solo es lo que se enseñó al cliente.
   */
  const submit = useCallback(
    async ({ force = false, clientName } = {}) => {
      const route = form.origin_lat ? null : await computeRoute();
      const payload = {
        client_name: clientName || form.client_name,
        client_phone: form.client_phone,
        service_type: form.service,
        destination_zone: destinationZoneKey,
        origin_address: form.origin_address,
        destination_address: form.destination_address,
        stops: form.stops.filter((s) => s.address.trim()),
        cargo_description: form.cargo_description,
        cargo_photos: photos,
        items_count: service.hasItemsLimit ? Number(form.items_count) || null : null,
        needs_help: service.hasHelp ? form.needs_help : false,
        help_description: service.hasHelp && form.needs_help ? form.help_description : null,
        origin_has_lift: service.hasAccess ? form.origin_has_lift : null,
        origin_floors: service.hasAccess ? Number(form.origin_floors) || 0 : 0,
        destination_has_lift: service.hasAccess ? form.destination_has_lift : null,
        destination_floors: service.hasAccess ? Number(form.destination_floors) || 0 : 0,
        extra_hours: service.hasExtraHours ? Number(form.extra_hours) || 0 : 0,
        package_weight: service.hasWeights ? form.package_weight : null,
        insurance_selected: service.hasInsurance ? form.insurance_selected : false,
        recipient_name: service.needsRecipient ? form.recipient_name : null,
        recipient_phone: service.needsRecipient ? form.recipient_phone : null,
        payment_method: form.payment_method,
        notes: form.notes || null,
        // La RPC de invitado ignora las claves que no conoce; el insert
        // autenticado la guarda y el servidor valida el suelo del 60%.
        ...(form.proposed_price ? { proposed_price: Number(form.proposed_price) } : {}),
        helpers_count: 0,
        status: "pending",
        payment_status: "pending",
        distance_km: (route?.distance_km ?? form.distance_km) || null,
        ...(route || {}),
        // `force` solo lo entiende la RPC de invitado (salta el aviso de
        // duplicado). En un insert autenticado sería una columna inexistente.
        ...(guest && force ? { force: true } : {}),
      };

      const request = await base44.entities.TransportRequest.create(payload);

      // Aviso a admins y conductores compatibles: no debe bloquear el flujo.
      supabase.functions
        .invoke("send-email", { body: { mode: "new_request", order_id: request.id } })
        .catch(() => {});

      return request;
    },
    [form, photos, service, destinationZoneKey, computeRoute, guest],
  );

  return {
    form,
    setForm,
    update,
    service,
    setService,
    setZone,
    tariffs,
    quote,
    photos,
    uploadPhotos,
    removePhoto,
    uploading,
    addStop,
    updateStop,
    removeStop,
    addressErrors,
    acceptPortal,
    setAcceptPortal,
    acceptTerms,
    setAcceptTerms,
    computeRoute,
    validateStep,
    submit,
    weightOptions: weightsForZone(destinationZoneKey),
    destinationZoneKey,
  };
}
