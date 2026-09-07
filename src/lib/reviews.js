/**
 * Reseñas reales del perfil de Google del negocio.
 *
 * Configuración (variables de entorno en Vercel):
 *   GOOGLE_PLACES_API_KEY  — clave con la Places API (New) habilitada. ES LO
 *                            ÚNICO IMPRESCINDIBLE: la ficha se localiza sola.
 *   GOOGLE_PLACE_ID        — opcional, si algún día hay que fijar otra ficha.
 *
 * Sin la clave se muestra el volcado estático de abajo (reseñas REALES
 * copiadas de la ficha, actualizadas a mano). Nunca se muestran reseñas
 * inventadas: si no hay dato real, no hay tarjeta.
 */

// Ficha real del negocio en Google Maps ("Clicyvoy", servicio de mudanzas).
// OJO: el enlace corto antiguo (maps.app.goo.gl/CEs2fNnTqzqcBkb4A) apuntaba a la
// DIRECCIÓN C. Gerona 15, no a la ficha de empresa — ahí no hay reseñas.
export const GOOGLE_PROFILE_URL =
  "https://www.google.com/maps/place/Clicyvoy/@38.9921992,-1.8605894,14z/data=!4m8!3m7!1s0x473651a1e554277d:0xc861875645ecdcbb!8m2!3d38.9921992!4d-1.8605894!9m1!1b1!16s%2Fg%2F11zgsd09_c?hl=es";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/**
 * En la home solo se enseñan las reseñas BUENAS (decisión de negocio,
 * 07/09/2026): la sección es la carta de presentación, no el buzón de quejas.
 * Una reseña regular o mala se sigue leyendo entera en el perfil de Google,
 * al que lleva el botón — no se oculta nada, se elige qué se destaca.
 *
 * La nota media y el total que se muestran arriba NO se tocan: salen de Google
 * con todas las reseñas dentro. Enseñar un 5,0 filtrado sería engañar.
 */
export const MIN_GOOD_RATING = 4;

const isGood = (review) => Number(review.rating) >= MIN_GOOD_RATING;

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
/**
 * Identificador de la ficha buscándola por nombre. Existe para que dar de alta
 * las reseñas reales solo requiera UNA cosa: la clave de la API. Averiguar el
 * place id a mano era el paso donde esto se quedaba parado.
 */
async function findPlaceId(key) {
  try {
    const res = await fetch(`${PLACES_ENDPOINT}:searchText`, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textQuery: "Clicyvoy Albacete", languageCode: "es", maxResultCount: 1 }),
      // La ficha no cambia de sitio: una búsqueda a la semana sobra.
      next: { revalidate: 604800 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.places?.[0]?.id || null;
  } catch {
    return null;
  }
}

export async function getGoogleReviews() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  // Sin la API, el volcado estático de reseñas reales (la sección siempre se ve).
  const empty = { configured: false, ...STATIC_RATING, reviews: STATIC_REVIEWS.filter(isGood) };
  if (!key) return empty;

  const placeId = process.env.GOOGLE_PLACE_ID || (await findPlaceId(key));
  if (!placeId) return empty;

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
      // Con texto y buenas: una valoración sin comentario no aporta nada en
      // una tarjeta, y la sección destaca solo lo bueno (ver MIN_GOOD_RATING).
      .filter((r) => r.text && isGood(r));

    return {
      configured: true,
      // La nota y el total son los REALES de Google, sin filtrar.
      rating: typeof data.rating === "number" ? data.rating : null,
      total: Number(data.userRatingCount) || reviews.length,
      reviews,
    };
  } catch {
    return empty;
  }
}
