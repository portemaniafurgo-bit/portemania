"use client";

import { supabase } from "@/lib/entities";

/**
 * Firma del receptor en la entrega.
 *
 * Va al bucket PRIVADO `delivery-proofs` (una firma manuscrita es un dato
 * personal, no puede vivir en una URL pública). En BD se guarda la referencia
 * `delivery-proofs://<pedido>/<fichero>`; para verla se pide una signed URL,
 * igual que con los documentos del conductor.
 */
const PREFIX = "delivery-proofs://";

export async function uploadSignature(requestId, blob) {
  const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const { error } = await supabase.storage
    .from("delivery-proofs")
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "image/png" });
  if (error) throw error;
  return PREFIX + path;
}

export async function resolveProofUrl(value) {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const { data, error } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(value.slice(PREFIX.length), 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
