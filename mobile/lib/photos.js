import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

/**
 * Fotos de la carga: cámara o galería, comprimidas EN EL MÓVIL antes de subir.
 *
 * La web sube el fichero tal cual sale de la cámara — varios MB por foto, con
 * los datos del cliente pagándolo y el admin esperando a que carguen. Aquí se
 * reduce el lado mayor a 1600 px y se recomprime a JPEG 0.7, que para ver una
 * lavadora en un descansillo sobra.
 *
 * La subida va por base64 → ArrayBuffer: es el camino que documenta Supabase
 * para React Native, porque el Blob de RN no implementa `arrayBuffer()` y
 * supabase-js lo necesita.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.7;
const BUCKET = "cargo-photos";

async function compressToBase64(uri) {
  const context = ImageManipulator.manipulate(uri);
  // Solo se fija el ancho: la altura la calcula el módulo manteniendo la
  // proporción. Fijar ambos deformaría las fotos verticales.
  context.resize({ width: MAX_SIDE });
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
}

/** Sube una imagen local y devuelve su URL pública (bucket cargo-photos, el
 *  mismo que usa la web: el admin y el conductor las ven igual). */
export async function uploadPhoto(uri) {
  const image = await compressToBase64(uri);
  if (!image?.base64) throw new Error("No se pudo procesar la foto");

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(image.base64), { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Abre la cámara. Devuelve [] si el usuario cancela o deniega el permiso. */
export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchCameraAsync({ quality: 1, mediaTypes: ["images"] });
  return result.canceled ? [] : result.assets.map(a => a.uri);
}

/** Abre la galería con selección múltiple. */
export async function pickPhotos(limit = 6) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 1,
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: limit,
  });
  return result.canceled ? [] : result.assets.map(a => a.uri);
}
