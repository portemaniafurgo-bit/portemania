"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { resolveProofUrl } from "@/lib/deliveryProof";

/**
 * Prueba de entrega tal y como la ve el CLIENTE: foto de lo entregado, firma de
 * quien recibió y cuándo. El conductor las sube al bucket privado
 * `delivery-proofs` y la RLS de Storage ya deja leerlas al dueño del pedido;
 * lo que faltaba era enseñárselas — antes solo veía una frase.
 */
export default function DeliveryProofCard({ order }) {
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);

  useEffect(() => {
    let active = true;
    resolveProofUrl(order?.proof_photo_url).then((url) => active && setPhoto(url));
    resolveProofUrl(order?.proof_signature_url).then((url) => active && setSignature(url));
    return () => {
      active = false;
    };
  }, [order?.proof_photo_url, order?.proof_signature_url]);

  if (!order?.proof_photo_url && !order?.proof_signature_url) return null;

  const signedAt = order.delivered_signature_at || order.delivery_time;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-foreground">Prueba de entrega</h3>
      </div>

      {photo ? (
        <a href={photo} target="_blank" rel="noreferrer" className="block space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt="Foto de la entrega"
            className="w-full max-h-72 object-cover rounded-xl border border-border"
          />
          <p className="text-xs text-muted-foreground">Foto de lo entregado · abrir en grande</p>
        </a>
      ) : null}

      {signature ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Firma de quien recibió
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signature}
            alt="Firma de la entrega"
            className="w-full h-28 object-contain bg-white rounded-xl border border-border"
          />
          <p className="text-xs text-muted-foreground">
            {order.recipient_name ? `Firmado por ${order.recipient_name}` : "Firma recogida"}
            {signedAt
              ? ` · ${new Date(signedAt).toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
