"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { buildRequestHref } from "@/lib/requestIntent";
import { SERVICE_LIST, serviceHref } from "@/lib/services";
import { useTariffs } from "@/lib/tariffs";

/**
 * Los cuatro servicios con su precio real (leído de las tarifas vivas).
 *
 * Aquí solo se vende: qué es, qué incluye y cuánto cuesta. Las condiciones que
 * generan fricción — plantas sin ascensor, límite de objetos, que la ayuda es
 * un trabajo de dos, el coste por parada — se explican dentro del proceso de
 * compra, no antes de que el cliente sepa si le interesa.
 */
export default function ServicesSection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const tariffs = useTariffs();

  const go = (service) => {
    const path = isAuthenticated ? "/new-request" : "/solicitar";
    router.push(buildRequestHref(path, { service }));
  };

  const cards = {
    mini_mudanza: {
      price: `${tariffs.mudanza_base}€`,
      unit: "2 h incluidas",
      bullets: [
        "Furgoneta grande con conductor",
        "Añade paradas intermedias en la misma reserva",
        "Ayuda del conductor opcional para cargar y descargar",
      ],
    },
    porte: {
      price: `${tariffs.porte_base}€`,
      unit: "precio cerrado",
      bullets: [
        "Ideal para muebles y electrodomésticos sueltos",
        "Recogida y entrega a pie de calle",
        "Seguimiento del conductor en tiempo real",
      ],
    },
    porte_tienda: {
      price: `${tariffs.tienda_base}€`,
      unit: "por servicio",
      bullets: [
        "Entrega con subida a domicilio si hay ascensor",
        "Firma del receptor en la entrega",
        "Pensado para tiendas que quieren automatizar sus repartos",
      ],
    },
    paquete: {
      price: `${Number(tariffs.pkg_light).toFixed(2)}€`,
      unit: "desde · hasta 30 kg",
      bullets: [
        "Entrega el mismo día en Albacete capital",
        `Villarrobledo en 24 h desde ${Number(tariffs.pkg_villarrobledo).toFixed(2)}€`,
        "Firma del receptor en la entrega",
      ],
    },
  };

  return (
    <section id="servicios" className="py-20 md:py-24 bg-white relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-3">
            Nuestros servicios de transporte en Albacete
          </h2>
          <p className="text-lg text-gray-500">
            Elige el que encaja con lo que necesitas mover. Ves el precio antes de reservar y
            reservas online en un par de minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICE_LIST.map((service, i) => {
            const card = cards[service.key];
            const featured = service.key === "mini_mudanza";

            return (
              <motion.article
                key={service.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className={`rounded-3xl p-8 flex flex-col transition-shadow hover:shadow-xl ${
                  featured
                    ? "bg-[#7145d6] text-white shadow-2xl"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                    featured ? "bg-white/20" : "bg-white shadow-sm text-[#7145d6]"
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl">{service.icon}</span>
                </div>

                <h3
                  className={`text-2xl font-bold mb-2 ${featured ? "text-white" : "text-gray-900"}`}
                >
                  {service.landingTitle}
                </h3>
                <p className={`mb-6 ${featured ? "text-white/80" : "text-gray-500"}`}>
                  {service.landingSubtitle}
                </p>

                <div className="flex items-end gap-2 mb-6">
                  <span
                    className={`text-4xl font-black ${featured ? "text-white" : "text-[#7145d6]"}`}
                  >
                    {card.price}
                  </span>
                  <span className={`mb-1 ${featured ? "text-white/70" : "text-gray-500"}`}>
                    {card.unit}
                  </span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {card.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm">
                      <span
                        className={`material-symbols-outlined text-xl flex-shrink-0 ${
                          featured ? "text-white/80" : "text-[#7145d6]"
                        }`}
                      >
                        check_circle
                      </span>
                      <span className={featured ? "text-white/90" : "text-gray-600"}>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-3 mt-auto">
                  <button
                    onClick={() => go(service.key)}
                    className={`px-6 py-3 rounded-full font-semibold text-sm transition-all active:scale-95 ${
                      featured
                        ? "bg-white text-[#7145d6] hover:bg-white/90"
                        : "bg-[#7145d6] text-white hover:bg-[#5a35b0]"
                    }`}
                  >
                    Solicitar {service.label.toLowerCase()}
                  </button>
                  <Link
                    href={serviceHref(service.key)}
                    className={`text-sm font-medium underline-offset-4 hover:underline ${
                      featured ? "text-white/90" : "text-[#7145d6]"
                    }`}
                  >
                    Más información
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
