import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * «Escribiendo…» en el chat del pedido.
 *
 * Va por BROADCAST de Realtime, no por base de datos: es información que vive
 * dos segundos y no merece una fila ni un histórico. Cada parte anuncia que
 * está escribiendo y la otra lo ve; si deja de llegar el aviso, desaparece
 * solo a los 4 segundos.
 */
export function useTyping(orderId, { user, enabled = true } = {}) {
  const [partnerTyping, setPartnerTyping] = useState(false);
  const channelRef = useRef(null);
  const lastSent = useRef(0);
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!orderId || !enabled) return;

    const channel = supabase.channel(`typing-${orderId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        // Lo propio no cuenta: solo interesa que escriba el otro.
        if (!payload?.from || payload.from === user?.id) return;
        setPartnerTyping(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setPartnerTyping(false), 4000);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      clearTimeout(hideTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [orderId, enabled, user?.id]);

  /** Llamar en cada tecla: se limita solo a un aviso cada 1,5 s. */
  const notifyTyping = () => {
    const now = Date.now();
    if (!channelRef.current || now - lastSent.current < 1500) return;
    lastSent.current = now;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { from: user?.id },
    });
  };

  return { partnerTyping, notifyTyping };
}
