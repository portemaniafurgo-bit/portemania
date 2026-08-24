"use client";

import { useState } from "react";
import { Share2, FileText, Check } from "lucide-react";
import { supabase } from "@/lib/entities";
import { Button } from "@/components/ui/button";

/**
 * Las dos acciones que la app ya tenía y en la web faltaban:
 *
 *  - Compartir el seguimiento con quien espera la carga (enlace público que
 *    funciona sin cuenta, como el «compartir viaje» de Uber).
 *  - Descargar la factura del servicio, la que emite el conductor autónomo.
 *
 * El PDF no se genera aquí: se abre la misma página de seguimiento/factura que
 * ya existe. En la web basta con imprimir a PDF desde el navegador, así que no
 * hace falta duplicar el generador del móvil.
 */
export default function OrderExtras({ order }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const activo = ["accepted", "in_transit", "picked_up"].includes(order.status);
  if (!activo) return null;

  const compartir = async () => {
    setLoading(true);
    try {
      const { data: token, error } = await supabase.rpc("get_share_token", {
        p_request_id: order.id,
      });
      if (error || !token) return;
      const url = `${window.location.origin}/seguimiento/${token}`;
      setLink(url);

      // En móvil, el menú de compartir del sistema; en escritorio, al portapapeles.
      if (navigator.share) {
        await navigator.share({ title: "Sigue mi envío", url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-foreground">Comparte el seguimiento</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manda este enlace a quien espera la carga: verá llegar la furgoneta en el mapa, sin
        necesidad de cuenta. Deja de funcionar cuando termina el servicio.
      </p>
      <Button onClick={compartir} disabled={loading} className="rounded-xl w-full">
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2" /> Enlace copiado
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4 mr-2" /> {loading ? "Preparando…" : "Compartir seguimiento"}
          </>
        )}
      </Button>
      {link ? (
        <p className="text-xs text-muted-foreground break-all">{link}</p>
      ) : null}
    </div>
  );
}

/** Aviso de que la factura la emite el conductor, con su enlace de descarga. */
export function InvoiceNote({ order }) {
  if (order.status !== "delivered") return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-foreground">Tu factura</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {order.invoice_number
          ? `Factura ${order.invoice_number}, emitida por el transportista autónomo que hizo el servicio.`
          : "La emite el transportista autónomo que hizo el servicio. Descárgala desde la app o pídenosla por email."}
      </p>
      <p className="text-xs text-muted-foreground">
        ¿Necesitas que vaya a nombre de tu empresa? Rellena tus datos fiscales en tu perfil y
        saldrán en todas las siguientes.
      </p>
    </div>
  );
}
