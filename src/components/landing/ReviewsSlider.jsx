"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Carrusel de reseñas de Google.
 *
 * Tres decisiones que vienen de la petición del negocio (07/09/2026):
 *  - SLIDER: la ficha tiene más reseñas de las que caben en una fila; aquí
 *    caben todas y se pasan con el dedo, las flechas o los puntos.
 *  - ORDEN ALEATORIO: se baraja DESPUÉS de hidratar, no en el servidor. Así el
 *    HTML que ve Google es siempre el mismo (la caché de ISR y el SEO siguen
 *    funcionando) y no hay desajuste de hidratación; el visitante ve un orden
 *    distinto en cada carga, que es lo que se pidió.
 *  - SOLO LAS BUENAS: el filtro vive en `lib/reviews.js`, para que valga tanto
 *    para el volcado estático como para la Places API.
 *
 * El desplazamiento es scroll nativo con `scroll-snap`: en el móvil se arrastra
 * como cualquier carrusel de app y sin JavaScript de por medio.
 */
export default function ReviewsSlider({ reviews }) {
  const [order, setOrder] = useState(reviews);
  const [index, setIndex] = useState(0);
  // Con pocas reseñas caben todas en pantalla: ahí las flechas y los puntos
  // sobran (serían controles que no hacen nada).
  const [canScroll, setCanScroll] = useState(false);
  const trackRef = useRef(null);

  // Barajar al montar (Fisher-Yates). En el servidor se queda el orden
  // original: nunca hay dos HTML distintos para la misma página.
  useEffect(() => {
    const shuffled = [...reviews];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
  }, [reviews]);

  // Se recalcula al girar el móvil o cambiar el tamaño de la ventana.
  useEffect(() => {
    const check = () => {
      const track = trackRef.current;
      if (track) setCanScroll(track.scrollWidth > track.clientWidth + 8);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [order]);

  /** Qué tarjeta está centrada, para pintar los puntos. */
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + 24; // ancho + gap
    setIndex(Math.round(track.scrollLeft / step));
  };

  const scrollTo = (i) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + 24;
    const target = Math.max(0, Math.min(i, order.length - 1));
    track.scrollTo({ left: target * step, behavior: "smooth" });
  };

  if (!order.length) return null;

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        onScroll={onScroll}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-6 px-6 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {order.map((review) => (
          <li
            key={review.id}
            className="snap-start shrink-0 w-[85%] sm:w-[60%] md:w-[calc((100%-3rem)/3)] bg-gray-50 border border-gray-200 rounded-3xl p-6 flex flex-col gap-4"
          >
            <Stars value={review.rating} />
            <p className="text-gray-600 leading-relaxed flex-1">“{review.text}”</p>
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              {review.photo ? (
                <img src={review.photo} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#7145d6]/10 flex items-center justify-center text-[#7145d6] font-bold text-sm">
                  {review.author.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{review.author}</p>
                {review.when && <p className="text-xs text-gray-500">{review.when}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {canScroll && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            type="button"
            onClick={() => scrollTo(index - 1)}
            disabled={index === 0}
            aria-label="Reseña anterior"
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:border-[#7145d6] hover:text-[#7145d6] transition-colors disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>

          <div className="flex gap-2">
            {order.map((review, i) => (
              <button
                key={review.id}
                type="button"
                onClick={() => scrollTo(i)}
                aria-label={`Ir a la reseña ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-[#7145d6]" : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollTo(index + 1)}
            disabled={index >= order.length - 1}
            aria-label="Reseña siguiente"
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-700 hover:border-[#7145d6] hover:text-[#7145d6] transition-colors disabled:opacity-30 disabled:hover:border-gray-200 disabled:hover:text-gray-700"
          >
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Stars({ value = 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`material-symbols-outlined text-lg ${i < value ? "text-[#F5B400]" : "text-gray-300"}`}
          style={{ fontVariationSettings: i < value ? "'FILL' 1" : undefined }}
        >
          star
        </span>
      ))}
    </div>
  );
}
