import { decode } from "base64-arraybuffer";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

/**
 * Prueba de entrega: firma del receptor + foto de lo entregado.
 *
 * La firma va al bucket PRIVADO `delivery-proofs` (una firma manuscrita es un
 * dato personal; no puede vivir en una URL pública). En BD se guarda la
 * referencia `delivery-proofs://<pedido>/<fichero>` y para verla se pide una
 * signed URL — exactamente el esquema que ya usa la web (src/lib/deliveryProof.js).
 * La foto de entrega va al mismo bucket: enseña el paquete en el domicilio y
 * puede contener el portal/DNI de alguien, así que privada también.
 */
const PREFIX = "delivery-proofs://";

/** Sube la firma (PNG en base64, del SignaturePad). */
export async function uploadSignature(requestId, base64Png) {
  const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const { error } = await supabase.storage
    .from("delivery-proofs")
    .upload(path, decode(base64Png), { contentType: "image/png", cacheControl: "3600" });
  if (error) throw error;
  return PREFIX + path;
}

/** Sube la foto de entrega comprimida (uri local de la cámara). */
export async function uploadProofPhoto(requestId, uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1600 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!image?.base64) throw new Error("No se pudo procesar la foto");

  const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from("delivery-proofs")
    .upload(path, decode(image.base64), { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw error;
  return PREFIX + path;
}

/** Resuelve una referencia privada a una URL temporal visible. */
export async function resolveProofUrl(value) {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const { data, error } = await supabase.storage
    .from("delivery-proofs")
    .createSignedUrl(value.slice(PREFIX.length), 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
