import { getGoogleReviews, GOOGLE_PROFILE_URL } from "@/lib/reviews";
import ReviewsSlider from "@/components/landing/ReviewsSlider";

/**
 * Reseñas de Google al final de la home.
 *
 * Componente de servidor: las reseñas llegan ya en el HTML (cuentan para SEO) y
 * la clave de la API no sale del servidor. Si la ficha no está configurada
 * todavía se muestra solo el enlace al perfil — preferimos una sección sobria
 * a una con testimonios inventados.
 */
export default async function GoogleReviews() {
  const { configured, rating, total, reviews } = await getGoogleReviews();

  return (
    <section className="py-20 md:py-24 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-lg text-gray-500 mt-2">
              Opiniones publicadas en nuestro perfil de Google.
            </p>
          </div>

          {rating !== null && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3">
              <span className="text-3xl font-black text-gray-900">{rating.toFixed(1)}</span>
              <div>
                <Stars value={Math.round(rating)} />
                <p className="text-xs text-gray-500 mt-0.5">
                  {total} reseña{total === 1 ? "" : "s"} en Google
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Carrusel: caben TODAS las reseñas buenas, en orden aleatorio. */}
        {reviews.length > 0 ? (
          <ReviewsSlider reviews={reviews} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 md:p-10 text-center">
            <p className="text-gray-600 max-w-xl mx-auto">
              Nuestros clientes valoran cada servicio al terminarlo. Puedes leer las opiniones
              publicadas y dejar la tuya directamente en nuestro perfil de Google.
            </p>
            {!configured && (
              <p className="sr-only">
                Reseñas pendientes de conectar con la Places API de Google.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href={GOOGLE_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#7145d6] text-white font-semibold text-sm px-6 py-3 rounded-full hover:bg-[#5a35b0] transition-colors"
          >
            <span className="material-symbols-outlined text-lg">reviews</span>
            Ver reseñas en Google
          </a>
        </div>
      </div>

      {/* Valoración agregada para los resultados de búsqueda: solo si es real. */}
      {rating !== null && total > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: "ClicyVoy",
              url: "https://clicyvoy.es",
              areaServed: "Albacete",
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: rating,
                reviewCount: total,
              },
            }),
          }}
        />
      )}
    </section>
  );
}

function Stars({ value = 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`material-symbols-outlined text-lg ${
            i < value ? "text-[#F5B400]" : "text-gray-300"
          }`}
          style={{ fontVariationSettings: i < value ? "'FILL' 1" : undefined }}
        >
          star
        </span>
      ))}
    </div>
  );
}
