import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { uploadPhoto } from "./photos";

/**
 * Datos vivos de un pedido: estado, conductor, posición y chat.
 *
 * A diferencia de la web, que sondea cada 5-10 segundos en todas las pantallas,
 * aquí todo llega por Realtime. Se carga una vez y a partir de ahí manda el
 * servidor. El sondeo gastaba batería y datos, y era lo que hacía que un móvil
 * con la pantalla apagada se quedara sin enterarse de nada.
 */

/**
 * Una posición del conductor se considera actual si es de hace <1 min.
 * `location_updated_at` es la hora en que el GPS tomó el fix (no la de
 * escritura en la BD), así que la etiqueta dice de cuándo es la posición.
 * Con el conductor parado el GPS apenas emite (10 m de distancia mínima) y
 * la etiqueta acabará en «hace N min» aunque siga allí.
 */
export const FRESH_LOCATION_MS = 60_000;

export function locationFreshness(updatedAt) {
  if (!updatedAt) return { fresh: false, label: "antigüedad desconocida" };
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age < FRESH_LOCATION_MS) return { fresh: true, label: "en vivo" };
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60) return { fresh: false, label: `hace ${minutes} min` };
  return { fresh: false, label: `hace ${Math.floor(minutes / 60)} h` };
}

/**
 * Nombre ÚNICO de canal por suscripción.
 *
 * Supabase reutiliza el canal por su nombre: si dos pantallas vivas se
 * suscriben al mismo (el detalle del pedido y el chat abierto encima, que usan
 * los dos `useOrder`), la segunda llama a `.on()` sobre un canal ya suscrito y
 * revienta con «cannot add postgres_changes callbacks after subscribe()».
 * Bug real, 24/08/2026.
 */
export function uniqueChannel(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const STATUS_FLOW = ["pending", "accepted", "in_transit", "picked_up", "delivered"];

export const STATUS_LABELS = {
  scheduled: "Programado — se publicará a su hora",
  pending: "Buscando conductor",
  accepted: "Conductor asignado",
  in_transit: "En camino a la recogida",
  picked_up: "Carga recogida",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function useOrder(orderId) {
  const [order, setOrder] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDriver = useCallback(async driverId => {
    if (!driverId) return;
    // Fila más antigua: la original del conductor. Con el orden por defecto
    // (-created_date) saldría un duplicado vacío si lo hubiera.
    const { data } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("created_by_id", driverId)
      .order("created_date", { ascending: true })
      .limit(1);
    setDriver(data?.[0] || null);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    supabase
      .from("transport_requests")
      .select("*")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setOrder(data);
        setLoading(false);
        if (data?.driver_id) loadDriver(data.driver_id);
      });

    const channel = supabase
      .channel(uniqueChannel(`order-${orderId}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transport_requests", filter: `id=eq.${orderId}` },
        payload => {
          if (!active) return;
          setOrder(prev => ({ ...prev, ...payload.new }));
          if (payload.new?.driver_id) loadDriver(payload.new.driver_id);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId, loadDriver]);

  // Aplicar en local el resultado de un update PROPIO sin esperar al evento
  // Realtime: si el canal se cayó (MIUI congela sockets), la pantalla se
  // quedaba vieja tras "Trabajo finalizado" — bug real reportado el 2026-08-18.
  const patchOrder = useCallback(patch => {
    if (patch) setOrder(prev => (prev ? { ...prev, ...patch } : patch));
  }, []);

  return { order, driver, loading, patchOrder };
}

/** Milisegundos de una marca ISO, o null. */
function timeOf(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

// Sin eventos Realtime durante 20 s se sospecha que el socket se cayó (MIUI y
// compañía los congelan) y se pregunta la fila directamente cada 15 s.
const LIVE_SILENCE_MS = 20_000;
const SAFETY_POLL_MS = 15_000;

/**
 * Posición del conductor en vivo. Se suscribe a SU fila de driver_profiles, así
 * que cada movimiento llega solo, sin sondear cada 10 segundos como la web.
 *
 * UN canal por conductor durante todo el viaje: antes el canal dependía de la
 * posición del objeto `driver` del padre y se tiraba y rehacía cada vez que
 * este cambiaba, perdiendo eventos en el hueco. Las tres fuentes (fila
 * inicial, eventos y sondeo de rescate) pasan por `accept`, que descarta una
 * posición algo más vieja que la que ya se enseña: un evento atrasado no
 * puede hacer retroceder a la furgoneta.
 *
 * `active`: solo con el pedido en curso se sondea de rescate; en el historial
 * (entregado, cancelado) no hay nada que vigilar.
 */
export function useDriverLocation(driver, { active = true } = {}) {
  const [location, setLocation] = useState(null);
  const shownRef = useRef(null);
  // En ref: cambiar de fase no debe rehacer la suscripción.
  const pollEnabledRef = useRef(active);
  pollEnabledRef.current = active;

  const accept = useCallback(row => {
    const lat = Number(row?.current_lat);
    const lng = Number(row?.current_lng);
    if (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const updatedAt = row.location_updated_at || null;
    const prev = shownRef.current;
    if (prev) {
      const prevMs = timeOf(prev.updatedAt);
      const nextMs = timeOf(updatedAt);
      // Solo si es más vieja por menos de 60 s. Una diferencia mayor huele a
      // relojes distintos (marcas de la versión anterior o de la web del
      // conductor, con la hora de escritura) y se acepta.
      if (prevMs != null && nextMs != null && nextMs < prevMs && prevMs - nextMs < 60_000) return;
      // La misma posición otra vez (fila inicial repetida, sondeo): nada que pintar.
      if (prev.lat === lat && prev.lng === lng && prev.updatedAt === updatedAt) return;
    }
    const next = { lat, lng, updatedAt };
    shownRef.current = next;
    setLocation(next);
  }, []);

  // Canal + sondeo de rescate: dependen SOLO del id del conductor.
  useEffect(() => {
    shownRef.current = null;
    setLocation(null);
    const driverId = driver?.id;
    if (!driverId) return;

    let active = true;
    let lastEventAt = Date.now();

    const channel = supabase
      .channel(uniqueChannel(`driver-${driverId}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `id=eq.${driverId}` },
        payload => {
          if (!active) return;
          // Solo los eventos cuentan como "el socket vive": así el sondeo
          // sigue mientras el canal esté mudo.
          lastEventAt = Date.now();
          accept(payload.new);
        },
      )
      .subscribe();

    const poll = setInterval(async () => {
      if (!active || !pollEnabledRef.current || Date.now() - lastEventAt < LIVE_SILENCE_MS) return;
      try {
        const { data } = await supabase
          .from("driver_profiles")
          .select("current_lat, current_lng, location_updated_at")
          .eq("id", driverId)
          .maybeSingle();
        if (active && data) accept(data);
      } catch {
        /* sin red: se reintenta en el siguiente turno */
      }
    }, SAFETY_POLL_MS);

    return () => {
      active = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [driver?.id, accept]);

  // Fila inicial (y las que el padre recargue después): se aceptan si son más
  // nuevas que lo pintado, sin tocar la suscripción. Va DESPUÉS del efecto del
  // canal para que, al cambiar de conductor, el reinicio no borre la semilla.
  useEffect(() => {
    if (driver?.id) accept(driver);
  }, [driver?.id, driver?.current_lat, driver?.current_lng, driver?.location_updated_at, accept]);

  return location;
}

/** Chat del pedido, por Realtime en ambos lados (la web sondea cada 3 s en el
 *  del conductor y por eso los mensajes le llegaban tarde). */
export function useChat(orderId, { user, role }) {
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("request_id", orderId)
      .order("created_date", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (active) setMessages(data || []);
      });

    const channel = supabase
      .channel(uniqueChannel(`chat-${orderId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `request_id=eq.${orderId}` },
        payload => {
          setMessages(prev =>
            prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new],
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  const send = useCallback(
    async (text, { imageUri = null } = {}) => {
      const message = (text || "").trim();
      if (!message && !imageUri) return;
      setSending(true);
      try {
        // La foto se comprime y sube ANTES de crear el mensaje: un mensaje que
        // referencia una imagen que no llegó a subir es un bocadillo roto para
        // siempre en los dos lados del chat.
        const image_url = imageUri ? await uploadPhoto(imageUri) : null;

        const { data, error } = await supabase
          .from("chat_messages")
          .insert({
            request_id: orderId,
            sender_id: user?.id,
            sender_name: user?.user_metadata?.full_name || user?.email || "Usuario",
            sender_role: role === "driver" ? "driver" : "client",
            message: message || "📷 Foto",
            ...(image_url ? { image_url } : {}),
          })
          .select()
          .single();
        if (error) throw error;

        // Añadido optimista: si Realtime está caído, el mensaje ya guardado
        // desaparecía de la vista hasta recargar. El dedupe por id evita que
        // salga dos veces cuando sí llega el evento.
        if (data?.id) {
          setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]));
        }

        supabase.functions
          .invoke("send-push", { body: { mode: "chat_message", order_id: orderId, message_id: data.id } })
          .catch(() => {});
      } finally {
        setSending(false);
      }
    },
    [orderId, user, role],
  );

  return { messages, send, sending };
}
