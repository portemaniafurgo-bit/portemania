/**
 * Reseñas reales del perfil de Google del negocio.
 *
 * Configuración (variables de entorno en Vercel):
 *   GOOGLE_PLACES_API_KEY  — clave con la Places API (New) habilitada
 *   GOOGLE_PLACE_ID        — identificador de la ficha de ClicyVoy
 *
 * Sin esas variables se muestra el volcado estático de abajo (reseñas REALES
 * copiadas de la ficha, actualizadas a mano). Nunca se muestran reseñas
 * inventadas.
 *
 * Para obtener el place id: buscar "Clicyvoy Albacete" con Places Text Search
 * o el Place ID Finder de Google (la ficha es /g/11zgsd09_c).
 */

// Ficha real del negocio en Google Maps ("Clicyvoy", servicio de mudanzas).
// OJO: el enlace corto antiguo (maps.app.goo.gl/CEs2fNnTqzqcBkb4A) apuntaba a la
// DIRECCIÓN C. Gerona 15, no a la ficha de empresa — ahí no hay reseñas.
export const GOOGLE_PROFILE_URL =
  "https://www.google.com/maps/place/Clicyvoy/@38.9921992,-1.8605894,14z/data=!4m8!3m7!1s0x473651a1e554277d:0xc861875645ecdcbb!8m2!3d38.9921992!4d-1.8605894!9m1!1b1!16s%2Fg%2F11zgsd09_c?hl=es";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/**
 * Volcado estático de las reseñas REALES de la ficha (copiadas a mano el
 * 2026-08-08; la ficha marcaba 5,0 con 4 valoraciones). Es el plan B de la
 * propuesta (§1.8) para que las reseñas se vean sin la Places API: cuando se
 * configuren GOOGLE_PLACES_API_KEY y GOOGLE_PLACE_ID, la API sustituye a esta
 * lista. Si llegan reseñas nuevas antes, actualizar aquí a mano.
 * Solo entran opiniones de clientes con texto (ni valoraciones sin texto ni
 * respuestas del propietario). NUNCA añadir reseñas inventadas.
 */
const STATIC_RATING = { rating: 5.0, total: 4 };
const STATIC_REVIEWS = [
  {
    id: "static-cinta",
    author: "Cinta Gara Cidoncha Romero",
    photo: null,
    rating: 5,
    text: "Increíbles. Puntuales, atentos y muy cuidadosos. Una profesionalidad y calidad humana difícil de encontrar hoy día. Además amables y pacientes con nosotros y con la carga transportada. Repetiré cada vez que los necesite son ya de mi completa confianza.",
    when: "agosto de 2026",
  },
  {
    id: "static-luis",
    author: "Luis Lendinez Martinez",
    photo: null,
    rating: 5,
    text: "Un gran servicio trajo todo en el tiempo concretado y nos ayudó lo recomiendo gran profesional!!",
    when: "julio de 2026",
  },
];

/**
 * @returns {Promise<{configured: boolean, rating: number|null, total: number,
 *   reviews: {id: string, author: string, photo: string|null, rating: number,
 *   text: string, when: string}[]}>}
 */
export async function getGoogleReviews() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  // Sin la API, el volcado estático de reseñas reales (la sección siempre se ve).
  const empty = { configured: false, ...STATIC_RATING, reviews: STATIC_REVIEWS };
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
