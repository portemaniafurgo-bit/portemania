import { SERVICES } from "@/lib/services";
import { INCLUDED_HOURS } from "@/lib/pricing";

/**
 * Contenido editorial de las cuatro páginas de servicio.
 *
 * Separado de `services.js` (que define el comportamiento del flujo) porque
 * esto es texto de marketing y SEO: se retoca a menudo y no debe arrastrar
 * cambios en la lógica de precios.
 *
 * Regla de la casa: aquí van precios y ventajas, nunca advertencias ni
 * requisitos. Todo lo que condiciona al cliente ("la ayuda es un trabajo de
 * dos", "declara bien la carga o se recalcula") vive dentro del asistente,
 * cuando ya ha decidido que le interesa.
 *
 * `prices` recibe las tarifas vivas y devuelve las filas de la tabla de precios.
 */
export const SERVICE_CONTENT = {
  porte: {
    metaTitle: "Portes en Albacete desde 40€ | Furgoneta con conductor | ClicyVoy",
    metaDescription:
      "Portes rápidos en Albacete para particulares: muebles, electrodomésticos y objetos sueltos. Precio cerrado de 40€, conductor verificado y seguimiento en tiempo real.",
    keywords: ["portes Albacete", "porte muebles Albacete", "furgoneta con conductor Albacete"],
    intro: [
      "Un porte es el servicio más directo de ClicyVoy: recogemos en un punto de Albacete capital y entregamos en otro, con precio cerrado y sin sorpresas. Es la opción para mover una lavadora, un lavavajillas, un colchón, un sofá o esa compra de Wallapop que no te cabe en el coche.",
      "El conductor llega con su propia furgoneta en el horario acordado. Tú solo tienes que tener la mercancía preparada: la recogida y la entrega se hacen a pie de calle, en el portal.",
    ],
    features: [
      {
        icon: "bolt",
        title: "Precio cerrado",
        text: "Lo que ves al reservar es lo que pagas. Sin tarifas por kilómetro ni recargos de última hora.",
      },
      {
        icon: "inventory_2",
        title: "Hasta 6 objetos",
        text: "Pensado para cargas puntuales: electrodomésticos, muebles sueltos o cajas grandes.",
      },
      {
        icon: "share_location",
        title: "Seguimiento en vivo",
        text: "Ves al conductor en el mapa desde que acepta el servicio hasta que entrega.",
      },
      {
        icon: "verified_user",
        title: "Conductores verificados",
        text: "Documentación, seguro y alta de autónomo revisados antes de dejarles trabajar.",
      },
    ],
    prices: (t) => [
      { label: "Porte en Albacete capital", value: `${t.porte_base}€`, hint: "Precio cerrado, a pie de calle" },
      { label: "Seguro de mercancía (opcional)", value: `+${t.insurance}€`, hint: "Se añade al reservar" },
    ],
    faq: [
      {
        q: "¿Qué puedo transportar en un porte?",
        a: "Muebles y electrodomésticos sueltos: lavadora, lavavajillas, colchón, sofá, armario desmontado, cajas voluminosas. Si son varias habitaciones o el contenido de un piso, el servicio que necesitas es la mini mudanza.",
      },
      {
        q: "¿El conductor sube la carga a mi piso?",
        a: "En el porte la recogida y la entrega son a pie de calle. Si necesitas que alguien cargue y descargue contigo, reserva una mini mudanza con ayuda del conductor.",
      },
      {
        q: "¿Cuánto tarda?",
        a: "Depende de los conductores disponibles en ese momento. En cuanto uno acepta tu servicio, recibes el aviso y puedes seguirlo en el mapa.",
      },
    ],
  },

  mini_mudanza: {
    metaTitle: "Mini mudanzas en Albacete desde 99€ | ClicyVoy",
    metaDescription:
      "Mini mudanzas en Albacete con furgoneta grande y conductor: 99€ con 2 horas incluidas. Añade paradas intermedias y ayuda del conductor. Reserva online en minutos.",
    keywords: ["mini mudanza Albacete", "mudanza barata Albacete", "furgoneta grande Albacete"],
    intro: [
      "La mini mudanza es el servicio para habitaciones, estudios y pisos pequeños. Va siempre con furgoneta grande y el precio base incluye 2 horas de servicio, contadas desde que el conductor llega a tu puerta.",
      "Puedes reservarla solo con transporte —tú cargas y descargas— o añadir la ayuda del conductor para hacerlo entre los dos. Y si el traslado tiene más de una parada, puedes añadirlas en la misma reserva sin llamar a nadie.",
    ],
    features: [
      {
        icon: "local_shipping",
        title: "Furgoneta grande",
        text: "El vehículo con más capacidad de la flota, el que corresponde a este tipo de traslado.",
      },
      {
        icon: "schedule",
        title: "2 horas incluidas",
        text: "El tiempo empieza cuando el conductor llega. Si necesitas más, añades horas al reservar.",
      },
      {
        icon: "alt_route",
        title: "Paradas intermedias",
        text: "¿Recoges en una calle, pasas por otra y terminas en una tercera? Se reserva de una vez.",
      },
      {
        icon: "group",
        title: "Ayuda del conductor",
        text: "Opcional, para cargar y descargar. Se contrata durante la reserva.",
      },
    ],
    prices: (t) => [
      {
        label: "Mini mudanza",
        value: `${t.mudanza_base}€`,
        hint: `Furgoneta grande, ${INCLUDED_HOURS} horas incluidas`,
      },
      { label: "Hora adicional", value: `${t.mudanza_extra_hour}€`, hint: "Se añade al reservar" },
      { label: "Ayuda del conductor", value: `${t.mudanza_help}€`, hint: "Para cargar y descargar" },
      { label: "Parada intermedia", value: `${t.mudanza_stop}€`, hint: "Por cada parada extra" },
      { label: "Seguro de mercancía (opcional)", value: `+${t.insurance}€`, hint: "Se añade al reservar" },
    ],
    faq: [
      {
        q: "¿Qué tamaño de furgoneta se usa?",
        a: "Siempre la grande. La mini mudanza no ofrece furgoneta pequeña: para cargas menores el servicio adecuado es el porte.",
      },
      {
        q: "¿Cómo se cuentan las 2 horas incluidas?",
        a: "Desde que el conductor llega a la dirección de recogida hasta que termina la entrega. Si prevés que necesitarás más tiempo, puedes añadir horas al reservar.",
      },
      {
        q: "¿Puedo hacer varias paradas?",
        a: "Sí. Si recoges en una dirección, paras en una segunda y entregas en una tercera, eso es una parada adicional y la añades durante la reserva.",
      },
    ],
  },

  porte_tienda: {
    metaTitle: "Portes para tiendas en Albacete | Reparto para tu negocio | ClicyVoy",
    metaDescription:
      "Servicio de entrega para comercios de Albacete desde 30€: reparto geolocalizado, subida a domicilio y firma del receptor. Automatiza tus entregas sin contratar personal.",
    keywords: [
      "reparto para tiendas Albacete",
      "entrega a domicilio comercios Albacete",
      "transporte electrodomésticos Albacete",
    ],
    intro: [
      "Si tienes una tienda en Albacete y entregas a domicilio, este servicio sustituye a tener repartidor propio. Contratas la entrega cuando la necesitas, sin costes fijos ni vehículo parado.",
      "Trabajamos habitualmente con tiendas de electrodomésticos y muebles. Cada entrega queda geolocalizada y firmada por quien la recibe, así que tienes justificante de la entrega sin llamar a nadie.",
      "También sirve para particulares: si has comprado algo en una tienda y necesitas que te lo lleven a casa, este es el servicio.",
    ],
    features: [
      {
        icon: "draw",
        title: "Firma en la entrega",
        text: "El receptor firma al recibir. Queda registrada con la hora y la ubicación.",
      },
      {
        icon: "elevator",
        title: "Subida a domicilio",
        text: "Incluye subir el producto al piso cuando el edificio tiene ascensor.",
      },
      {
        icon: "storefront",
        title: "Sin personal en nómina",
        text: "Pagas por entrega. Ni sueldos, ni furgoneta, ni seguro de vehículo.",
      },
      {
        icon: "share_location",
        title: "Entregas geolocalizadas",
        text: "Tú y tu cliente veis el reparto avanzar en tiempo real.",
      },
    ],
    prices: (t) => [
      {
        label: "Entrega para tiendas",
        value: `${t.tienda_base}€`,
        hint: "Por servicio, con subida si hay ascensor",
      },
      { label: "Seguro de mercancía (opcional)", value: `+${t.insurance}€`, hint: "Se añade al reservar" },
    ],
    faq: [
      {
        q: "¿Qué diferencia hay con un porte normal?",
        a: "Este servicio incluye la subida al domicilio del cliente cuando hay ascensor y la firma obligatoria del receptor. El porte se entrega a pie de calle y no lleva firma.",
      },
      {
        q: "Tengo una tienda, ¿puedo tener un acuerdo?",
        a: "Sí. Escríbenos y organizamos el volumen de entregas de tu negocio. Si repartes a diario, podemos ajustar el flujo a tu forma de trabajar.",
      },
      {
        q: "¿Mi cliente puede seguir la entrega?",
        a: "Sí, la entrega se sigue en el mapa en tiempo real y avisamos en cada cambio de estado.",
      },
    ],
  },

  paquete: {
    metaTitle: "Envío de paquetes en Albacete y Villarrobledo | ClicyVoy",
    metaDescription:
      "Envía paquetes en Albacete el mismo día desde 4,99€ y a Villarrobledo en 24 horas por 19,99€ hasta 10 kg. Recogida a domicilio y firma del receptor.",
    keywords: [
      "envío de paquetes Albacete",
      "mensajería Albacete",
      "paquetería Villarrobledo",
      "envío urgente Albacete",
    ],
    intro: [
      "Recogemos tu paquete donde estés y lo entregamos en la dirección que nos digas. Dentro de Albacete capital, el mismo día; a Villarrobledo, en 24 horas.",
      "El precio depende solo del peso, no de la distancia dentro de la zona. Y la entrega se firma siempre, así que sabes con certeza que ha llegado a su destinatario.",
    ],
    features: [
      {
        icon: "schedule",
        title: "Mismo día en Albacete",
        text: "Recogemos y entregamos dentro de la capital sin esperar a un reparto programado.",
      },
      {
        icon: "route",
        title: "Villarrobledo en 24 h",
        text: "Recogida en Albacete y entrega a domicilio en Villarrobledo al día siguiente.",
      },
      {
        icon: "draw",
        title: "Firma del receptor",
        text: "Obligatoria en todos los envíos: queda registrada con hora y ubicación.",
      },
      {
        icon: "scale",
        title: "Hasta 30 kg",
        text: "Tres tramos de peso dentro de la capital; hasta 10 kg en los envíos a Villarrobledo.",
      },
    ],
    prices: (t) => [
      { label: "Albacete · 0 – 9 kg", value: `${Number(t.pkg_light).toFixed(2)}€`, hint: "Entrega el mismo día" },
      { label: "Albacete · 10 – 19 kg", value: `${Number(t.pkg_medium).toFixed(2)}€`, hint: "Entrega el mismo día" },
      { label: "Albacete · 20 – 30 kg", value: `${Number(t.pkg_heavy).toFixed(2)}€`, hint: "Entrega el mismo día" },
      {
        label: "Villarrobledo · hasta 10 kg",
        value: `${Number(t.pkg_villarrobledo).toFixed(2)}€`,
        hint: "Recogida en Albacete, entrega en 24 h",
      },
    ],
    faq: [
      {
        q: "¿Cuánto tarda un envío dentro de Albacete?",
        a: "Se entrega el mismo día. En cuanto un repartidor acepta el envío, recibes el aviso y puedes seguirlo en el mapa.",
      },
      {
        q: "¿Cómo funciona el envío a Villarrobledo?",
        a: "Recogemos el paquete en Albacete y lo entregamos a domicilio en Villarrobledo en 24 horas. El servicio admite hasta 10 kg.",
      },
      {
        q: "¿Qué pasa si el destinatario no está?",
        a: "El repartidor te contacta por el chat para acordar qué hacer. La entrega solo se cierra con la firma de quien la recibe.",
      },
    ],
  },
};

/** Contenido + definición del servicio, listo para la plantilla de landing. */
export function getServicePage(key) {
  const service = SERVICES[key];
  const content = SERVICE_CONTENT[key];
  if (!service || !content) return null;
  return { service, content };
}
