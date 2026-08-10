import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { SERVICES } from "./services";
import { DEFAULT_TARIFFS, fetchTariffs, quoteRequest, weightsForZone, MAX_STOPS } from "./tariffs";
import { geocodeAlbacete, fetchRouteEta } from "./eta";
import { isInZone, postalCodeError } from "./zones";
import { uploadPhoto } from "./photos";

/**
 * Estado, validación, precio y envío del asistente de pedido en la app.
 *
 * Puerto de `src/components/request/useRequestForm.js`. Las REGLAS son las
 * mismas a propósito (zona, mínimos de descripción, fotos obligatorias, límite
 * de objetos, ascensor cuando hay ayuda): si divergen, un pedido válido en la
 * app sería inválido en la web y viceversa. Si tocas una aquí, tócala allí.
 *
 * Diferencias propias del móvil:
 *  - Las fotos se comprimen antes de subir (ver lib/photos.js).
 *  - El formulario se guarda como BORRADOR local a cada cambio, para que salir
 *    de la app a mirar una dirección no borre lo escrito.
 *  - No hay flujo de invitado: en la app siempre hay sesión, así que el pedido
 *    entra por insert normal y no por la RPC `create_guest_request`.
 */
const DRAFT_KEY = "request_draft_v1";

const emptyForm = (draft = {}) => ({
  service: draft.service || "porte",
  destination_zone: draft.destination_zone || "albacete",
  client_name: draft.client_name || "",
  client_phone: draft.client_phone || "",
  origin_address: draft.origin_address || "",
  destination_address: draft.destination_address || "",
  stops: draft.stops || [],
  cargo_description: draft.cargo_description || "",
  items_count: draft.items_count ?? 1,
  needs_help: draft.needs_help || false,
  help_description: draft.help_description || "",
  origin_has_lift: draft.origin_has_lift ?? null,
  origin_floors: draft.origin_floors ?? 1,
  destination_has_lift: draft.destination_has_lift ?? null,
  destination_floors: draft.destination_floors ?? 1,
  package_weight: draft.package_weight || "",
  extra_hours: draft.extra_hours || 0,
  insurance_selected: draft.insurance_selected || false,
  recipient_name: draft.recipient_name || "",
  recipient_phone: draft.recipient_phone || "",
  payment_method: draft.payment_method || "cash",
  notes: draft.notes || "",
  distance_km: 0,
});

export function useRequestForm({ user } = {}) {
  const [tariffs, setTariffs] = useState(DEFAULT_TARIFFS);
  const [form, setForm] = useState(() => emptyForm());
  const [photos, setPhotos] = useState([]);
  const [acceptPortal, setAcceptPortal] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const service = SERVICES[form.service] || SERVICES.porte;
  const quote = useMemo(() => quoteRequest(tariffs, form), [tariffs, form]);

  useEffect(() => {
    fetchTariffs().then(setTariffs);
  }, []);

  // --- Borrador local ------------------------------------------------------
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then(raw => {
        if (raw) {
          const saved = JSON.parse(raw);
          setForm(emptyForm(saved.form || {}));
          setPhotos(saved.photos || []);
        }
      })
      .catch(() => {})
      .finally(() => setDraftLoaded(true));
  }, []);

  useEffect(() => {
    // No guardar antes de haber leído: machacaría el borrador con el vacío
    // inicial en el primer render.
    if (!draftLoaded) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ form, photos })).catch(() => {});
  }, [form, photos, draftLoaded]);

  const clearDraft = useCallback(async () => {
    await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    setForm(emptyForm());
    setPhotos([]);
    setAcceptPortal(false);
    setAcceptTerms(false);
  }, []);

  const update = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Cambiar de servicio limpia lo que ya no aplica: si no, un pedido que empezó
   * como mini mudanza podía acabar cobrando paradas siendo un porte.
   */
  const setService = useCallback(key => {
    const next = SERVICES[key];
    if (!next) return;
    setForm(prev => ({
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
  const setZone = useCallback(zone => {
    setForm(prev => ({
      ...prev,
      destination_zone: zone,
      destination_address: "",
      package_weight: zone === "villarrobledo" ? "vr_light" : "",
    }));
  }, []);

  // --- Paradas intermedias -------------------------------------------------
  const addStop = useCallback(() => {
    setForm(prev =>
      prev.stops.length >= MAX_STOPS ? prev : { ...prev, stops: [...prev.stops, { address: "" }] },
    );
  }, []);

  const updateStop = useCallback((index, address) => {
    setForm(prev => ({
      ...prev,
      stops: prev.stops.map((s, i) => (i === index ? { ...s, address } : s)),
    }));
  }, []);

  const removeStop = useCallback(index => {
    setForm(prev => ({ ...prev, stops: prev.stops.filter((_, i) => i !== index) }));
  }, []);

  // --- Fotos ---------------------------------------------------------------
  const addPhotos = useCallback(async uris => {
    if (!uris?.length) return;
    setUploading(true);
    try {
      for (const uri of uris) {
        const url = await uploadPhoto(uri);
        setPhotos(prev => [...prev, url]);
      }
    } finally {
      setUploading(false);
    }
  }, []);

  const removePhoto = useCallback(index => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  // --- Direcciones y ruta --------------------------------------------------
  const destinationZoneKey = service.hasZones ? form.destination_zone : "albacete";

  const addressErrors = useMemo(
    () => ({
      origin: postalCodeError(form.origin_address, "albacete"),
      destination: postalCodeError(form.destination_address, destinationZoneKey),
      stops: form.stops.map(s => postalCodeError(s.address, "albacete")),
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
      // Si la dirección se eligió del autocompletado ya tenemos sus coordenadas
      // exactas; volver a geocodificar el texto solo añadiría una petición y la
      // posibilidad de acertar peor.
      const [from, to] = await Promise.all([
        form.origin_lat ? { lat: form.origin_lat, lng: form.origin_lng } : geocodeAlbacete(form.origin_address),
        form.destination_lat
          ? { lat: form.destination_lat, lng: form.destination_lng }
          : geocodeAlbacete(form.destination_address),
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
      setForm(prev => ({ ...prev, ...patch }));
      return patch;
    } catch {
      return null;
    }
  }, [
    form.origin_address,
    form.destination_address,
    form.origin_lat,
    form.origin_lng,
    form.destination_lat,
    form.destination_lng,
  ]);

  // --- Validación por paso -------------------------------------------------
  /** @returns {{ok: boolean, reason: string}} motivo visible para el cliente. */
  const validateStep = useCallback(
    step => {
      const fail = reason => ({ ok: false, reason });

      if (step === 1) {
        if (!form.client_phone.trim()) return fail("Indica un teléfono de contacto");
        if (!isInZone(form.origin_address, "albacete"))
          return fail("La recogida debe estar en Albacete capital (02001–02008)");
        if (!isInZone(form.destination_address, destinationZoneKey))
          return fail(
            destinationZoneKey === "villarrobledo"
              ? "La entrega debe estar en Villarrobledo (02600)"
              : "La entrega debe estar en Albacete capital (02001–02008)",
          );
        if (form.stops.some(s => !isInZone(s.address, "albacete")))
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
    [form, photos, service, acceptPortal, acceptTerms, destinationZoneKey],
  );

  // --- Aviso de duplicado --------------------------------------------------
  /**
   * Pedido propio sin terminar de hace menos de 30 minutos. Mismo propósito que
   * el aviso de la web (evitar el doble pedido de quien no ve confirmación y
   * vuelve a darle al botón), pero aquí la señal es la cuenta y no el teléfono:
   * la RLS ya limita la consulta a los pedidos de este usuario.
   */
  const findRecentDuplicate = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("transport_requests")
      .select("id, created_date, status")
      .in("status", ["pending", "accepted", "in_transit", "picked_up"])
      .gte("created_date", since)
      .limit(5);
    return (data || [])[0] || null;
  }, []);

  // --- Envío ---------------------------------------------------------------
  /**
   * Crea el pedido. El precio final lo fija el SERVIDOR (compute_quote vía
   * trigger); `quote` solo es lo que se le enseñó al cliente.
   */
  const submit = useCallback(async () => {
    // Hace falta la ruta si falta cualquiera de las dos puntas o la distancia:
    // con el autocompletado es normal tener una dirección con coordenadas y la
    // otra escrita a mano, y sin las dos el pedido llegaría sin destino al mapa.
    const needsRoute = !form.origin_lat || !form.destination_lat || !form.distance_km;
    const route = needsRoute ? await computeRoute() : null;
    const payload = {
      client_name: form.client_name || user?.user_metadata?.full_name || user?.email || "Cliente",
      client_phone: form.client_phone,
      service_type: form.service,
      destination_zone: destinationZoneKey,
      origin_address: form.origin_address,
      destination_address: form.destination_address,
      stops: form.stops.filter(s => s.address.trim()),
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
      helpers_count: 0,
      status: "pending",
      payment_status: "pending",
      distance_km: (route?.distance_km ?? form.distance_km) || null,
      ...(route || {}),
    };

    const { data, error } = await supabase
      .from("transport_requests")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Avisos a admins y conductores compatibles. No deben bloquear el flujo:
    // si fallan, el pedido ya está creado y se ve en el panel igualmente.
    supabase.functions
      .invoke("send-email", { body: { mode: "new_request", order_id: data.id } })
      .catch(() => {});
    supabase.functions
      .invoke("send-push", { body: { mode: "new_request", order_id: data.id } })
      .catch(() => {});

    await clearDraft();
    return data;
  }, [form, photos, service, destinationZoneKey, computeRoute, user, clearDraft]);

  return {
    form,
    update,
    service,
    setService,
    setZone,
    tariffs,
    quote,
    photos,
    addPhotos,
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
    findRecentDuplicate,
    submit,
    clearDraft,
    draftLoaded,
    weightOptions: weightsForZone(destinationZoneKey),
    destinationZoneKey,
  };
}
