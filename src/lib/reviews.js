/**
 * Reseñas reales del perfil de Google del negocio.
 *
 * Configuración (variables de entorno en Vercel):
 *   GOOGLE_PLACES_API_KEY  — clave con la Places API (New) habilitada
 *   GOOGLE_PLACE_ID        — identificador de la ficha de ClicyVoy
 *
 * Sin esas variables la sección no inventa nada: enseña el enlace al perfil de
 * Google y ya está. Nunca se muestran reseñas de ejemplo como si fueran reales.
 *
 * Para obtener el place id a partir del enlace corto del negocio
 * (https://maps.app.goo.gl/CEs2fNnTqzqcBkb4A): abrirlo, copiar el nombre exacto
 * y buscarlo con Places Text Search, o usar el Place ID Finder de Google.
 */

export const GOOGLE_PROFILE_URL = "https://maps.app.goo.gl/CEs2fNnTqzqcBkb4A";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/**
 * @returns {Promise<{configured: boolean, rating: number|null, total: number,
 *   reviews: {id: string, author: string, photo: string|null, rating: number,
 *   text: string, when: string}[]}>}
 */
export async function getGoogleReviews() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const empty = { configured: false, rating: null, total: 0, reviews: [] };
  if (!key || !placeId) return empty;

  try {
    const res = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,reviews",
      },
      // Una llamada al día es suficiente: las reseñas cambian poco y la API se cobra.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return empty;

    const data = await res.json();
    const reviews = (data.reviews || [])
      .map((r, i) => ({
        id: r.name || `review-${i}`,
        author: r.authorAttribution?.displayName || "Cliente de ClicyVoy",
        photo: r.authorAttribution?.photoUri || null,
        rating: Number(r.rating) || 5,
        text: r.originalText?.text || r.text?.text || "",
        when: r.relativePublishTimeDescription || "",
      }))
      .filter((r) => r.text);

    return {
      configured: true,
      rating: typeof data.rating === "number" ? data.rating : null,
      total: Number(data.userRatingCount) || reviews.length,
      reviews,
    };
  } catch {
    return empty;
  }
}
