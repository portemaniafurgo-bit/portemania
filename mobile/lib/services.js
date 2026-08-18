/**
 * Catálogo de servicios de ClicyVoy — única fuente de verdad.
 *
 * `transport_requests.service_type` guarda estas claves. Los pedidos anteriores
 * a la migración 0010 usaban 'transport'/'package'; `resolveServiceKey()` los
 * traduce para que el histórico se siga leyendo igual.
 *
 * Cada servicio declara qué pasos y campos activa el flujo de compra. Ningún
 * componente debe decidir por su cuenta si un servicio lleva ayuda, paradas o
 * firma: se consulta aquí.
 */

export const SERVICE_KEYS = ["porte", "mini_mudanza", "porte_tienda", "paquete"];

export const SERVICES = {
  porte: {
    key: "porte",
    label: "Porte",
    emoji: "📦",
    icon: "local_shipping",
    tagline: "Directo de A a B",
    // Landing SEO
    slug: "portes-albacete",
    landingTitle: "Transportes rápidos en Albacete para particulares",
    landingSubtitle:
      "Muebles, electrodomésticos y objetos sueltos con furgoneta y conductor. Precio cerrado, sin sorpresas.",
    // Flujo
    vehicle: "small",
    priceKey: "porte_base",
    hasHelp: false,
    hasExtraHours: false,
    hasStops: false,
    hasAccess: false,
    hasItemsLimit: true,
    maxItems: 6,
    hasWeights: false,
    hasZones: false,
    signatureRequired: false,
    needsRecipient: false,
    needsPhotos: true,
  },
  mini_mudanza: {
    key: "mini_mudanza",
    label: "Mini mudanza",
    emoji: "🏠",
    icon: "home",
    tagline: "Habitaciones y pisos pequeños",
    slug: "mini-mudanzas-albacete",
    landingTitle: "Tu mudanza en Albacete en minutos",
    landingSubtitle:
      "Furgoneta grande con conductor, 2 horas incluidas. Reserva online en un par de minutos.",
    vehicle: "large",
    priceKey: "mudanza_base",
    hasHelp: true,
    hasExtraHours: true,
    hasStops: true,
    hasAccess: true,
    hasItemsLimit: false,
    hasWeights: false,
    hasZones: false,
    signatureRequired: false,
    needsRecipient: false,
    needsPhotos: true,
  },
  porte_tienda: {
    key: "porte_tienda",
    label: "Compra en tienda",
    // La misma prestación vendida a comercios se llama "Portes para tiendas".
    labelB2B: "Portes para tiendas",
    emoji: "🛍",
    icon: "store",
    tagline: "Tú compras, nosotros lo llevamos",
    slug: "portes-para-tiendas",
    landingTitle: "Contrata el servicio de entrega para tu negocio",
    landingSubtitle:
      "Entrega geolocalizada con subida a domicilio y firma del receptor. Sin contratar personal.",
    vehicle: "small",
    priceKey: "tienda_base",
    hasHelp: false,
    hasExtraHours: false,
    hasStops: false,
    hasAccess: false,
    hasItemsLimit: false,
    hasWeights: false,
    hasZones: false,
    signatureRequired: true,
    needsRecipient: true,
    needsPhotos: true,
  },
  paquete: {
    key: "paquete",
    label: "Envío de paquete",
    emoji: "🚚",
    icon: "inventory_2",
    tagline: "Hasta 30 kg",
    slug: "envio-paquetes-albacete-villarrobledo",
    landingTitle: "Envío de paquetes en Albacete y Villarrobledo",
    landingSubtitle:
      "Recogemos y entregamos tu paquete el mismo día en Albacete, o en 24 horas en Villarrobledo.",
    vehicle: null,
    priceKey: null,
    hasHelp: false,
    hasExtraHours: false,
    hasStops: false,
    hasAccess: false,
    hasItemsLimit: false,
    hasWeights: true,
    hasZones: true,
    signatureRequired: true,
    needsRecipient: true,
    needsPhotos: false,
  },
};

/** Servicios en el orden en el que se muestran al cliente. */
export const SERVICE_LIST = SERVICE_KEYS.map((k) => SERVICES[k]);

// Pedidos creados antes de la migración 0010: 'transport' + tamaño de furgoneta.
const LEGACY = { transport: "porte", transport_large: "mini_mudanza", package: "paquete" };

/**
 * Clave de servicio de un pedido, tolerando el formato antiguo.
 * @param {{service_type?: string, vehicle_type?: string}|string} row
 */
export function resolveServiceKey(row) {
  const raw = typeof row === "string" ? row : row?.service_type;
  if (SERVICES[raw]) return raw;
  if (raw === "transport") {
    const vehicle = typeof row === "string" ? null : row?.vehicle_type;
    return vehicle === "large" ? LEGACY.transport_large : LEGACY.transport;
  }
  return LEGACY[raw] || "porte";
}

/** Definición del servicio de un pedido (nunca devuelve undefined). */
export function serviceOf(row) {
  return SERVICES[resolveServiceKey(row)] || SERVICES.porte;
}

/** Etiqueta legible para conductor, admin y correos. */
export function serviceLabel(row) {
  return serviceOf(row).label;
}

/** Ruta de la landing SEO del servicio. */
export function serviceHref(key) {
  const s = SERVICES[key];
  return s ? `/${s.slug}` : "/";
}
