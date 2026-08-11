import { useCallback, useEffect, useState } from "react";
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

/** Una posición del conductor se considera actual si se escribió hace <1 min. */
export const FRESH_LOCATION_MS = 60_000;

export function locationFreshness(updatedAt) {
  if (!updatedAt) return { fresh: false, label: "antigüedad desconocida" };
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age < FRESH_LOCATION_MS) return { fresh: true, label: "en vivo" };
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60) return { fresh: false, label: `hace ${minutes} min` };
  return { fresh: false, label: `hace ${Math.floor(minutes / 60)} h` };
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
      .channel(`order-${orderId}`)
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

  return { order, driver, loading };
}

/**
 * Posición del conductor en vivo. Se suscribe a SU fila de driver_profiles, así
 * que cada movimiento llega solo, sin sondear cada 10 segundos como la web.
 */
export function useDriverLocation(driver) {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!driver?.id) {
      setLocation(null);
      return;
    }

    if (driver.current_lat && driver.current_lng) {
      setLocation({
        lat: driver.current_lat,
        lng: driver.current_lng,
        updatedAt: driver.location_updated_at,
      });
    }

    const channel = supabase
      .channel(`driver-${driver.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `id=eq.${driver.id}` },
        payload => {
          const next = payload.new;
          if (next?.current_lat && next?.current_lng) {
            setLocation({
              lat: next.current_lat,
              lng: next.current_lng,
              updatedAt: next.location_updated_at,
            });
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [driver?.id, driver?.current_lat, driver?.current_lng, driver?.location_updated_at]);

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
      .channel(`chat-${orderId}`)
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
