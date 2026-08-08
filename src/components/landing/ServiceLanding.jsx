import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import Footer from "@/components/landing/Footer";
import { getServicePage } from "@/lib/serviceContent";
import { getTariffs } from "@/lib/tariffs.server";
import { SITE_URL } from "@/lib/blog";

/**
 * Plantilla de las páginas de servicio (`/portes-albacete`, `/mini-mudanzas-albacete`…).
 *
 * Componente de servidor con las tarifas vivas: el precio que indexa Google es
 * el mismo que verá el cliente al reservar, y cambiarlo en Ajustes se refleja
 * sin desplegar.
 */
export default async function ServiceLanding({ serviceKey }) {
  const page = getServicePage(serviceKey);
  if (!page) return null;

  const { service, content } = page;
  const tariffs = await getTariffs();
  const priceRows = content.prices(tariffs);
  const startHref = `/solicitar?service=${service.key}`;

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />

      {/* Cabecera */}
      <header className="bg-[#7145d6] text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          <nav aria-label="Migas de pan" className="text-sm text-white/70 mb-6">
            <Link href="/" className="hover:text-white">
              Inicio
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white">{service.label}</span>
          </nav>

          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight max-w-3xl">
            {service.landingTitle}
          </h1>
          <p className="text-lg md:text-xl text-white/85 mt-4 max-w-2xl font-light">
            {service.landingSubtitle}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-8">
            <Link
              href={startHref}
              className="bg-white text-[#7145d6] font-semibold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-lg"
            >
              Reservar ahora
            </Link>
            <span className="text-white/80 text-sm">
              Desde <strong className="text-white text-lg">{priceRows[0].value}</strong> ·{" "}
              {priceRows[0].hint}
            </span>
          </div>
        </div>
      </header>

      {/* Texto informativo */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-5 text-gray-600 leading-relaxed text-lg">
          {content.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
          {content.features.map((feature) => (
            <div key={feature.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <span className="material-symbols-outlined text-[#7145d6] text-3xl">
                {feature.icon}
              </span>
              <h2 className="text-lg font-bold text-gray-900 mt-3 mb-1">{feature.title}</h2>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
            Precios de {service.label.toLowerCase()}
          </h2>
          <p className="text-gray-500 mb-8">
            Precios finales con IVA incluido. Ves el desglose completo antes de confirmar la
            reserva.
          </p>

          <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
            {priceRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{row.label}</p>
                  <p className="text-sm text-gray-500">{row.hint}</p>
                </div>
                <span className="text-xl font-black text-[#7145d6] whitespace-nowrap">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <Link
            href={startHref}
            className="inline-flex items-center gap-2 mt-8 bg-[#7145d6] text-white font-semibold px-7 py-3.5 rounded-full hover:bg-[#5a35b0] transition-colors"
          >
            Reservar {service.label.toLowerCase()}
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-8">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {content.faq.map((item) => (
            <details
              key={item.q}
              className="group bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4"
            >
              <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between gap-4">
                {item.q}
                <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
                  expand_more
                </span>
              </summary>
              <p className="text-gray-600 leading-relaxed mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Service",
              name: service.landingTitle,
              description: service.landingSubtitle,
              serviceType: service.label,
              areaServed: { "@type": "City", name: "Albacete" },
              provider: { "@type": "LocalBusiness", name: "ClicyVoy", url: SITE_URL },
              offers: {
                "@type": "Offer",
                price: String(parseFloat(priceRows[0].value)),
                priceCurrency: "EUR",
                url: `${SITE_URL}/${service.slug}`,
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: content.faq.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ]),
        }}
      />
    </div>
  );
}

/** Metadatos de la página de servicio, para el `generateMetadata` de cada ruta. */
export function serviceMetadata(serviceKey) {
  const page = getServicePage(serviceKey);
  if (!page) return {};
  const { service, content } = page;
  const url = `${SITE_URL}/${service.slug}`;

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      url,
      type: "website",
      locale: "es_ES",
      siteName: "ClicyVoy",
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
    },
  };
}
