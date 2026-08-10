import { SERVICES, resolveServiceKey, serviceOf } from "./services";

/**
 * Motor de precios — puro e isomorfo (lo usan la landing en servidor, el
 * asistente en cliente y los tests).
 *
 * Las tarifas viven en `app_settings.tariffs` y las edita el admin en Ajustes.
 * ÚNICA fuente de precios de la web: landing, páginas de servicio, asistente y
 * términos legales leen de aquí. La autoridad final es el servidor —
 * `public.compute_quote(payload)` en Supabase aplica esta misma fórmula y es
 * quien fija el importe que se cobra (ver migración 0010). Si tocas una regla
 * aquí, tócala también allí.
 */
export const DEFAULT_TARIFFS = {
  // Porte — precio cerrado, recogida y entrega a pie de calle
  porte_base: 40,
  // Mini mudanza — furgoneta grande, 2 h incluidas
  mudanza_base: 99,
  mudanza_extra_hour: 25,
  mudanza_help: 39,
  mudanza_floor: 15, // por planta sin ascensor, solo con ayuda contratada
  mudanza_stop: 20, // por parada intermedia
  // Portes para tiendas / compra en tienda — con subida y firma
  tienda_base: 30,
  // Envío de paquetes (precio fijo por tramo de peso)
  pkg_light: 4.99, // 0–9 kg
  pkg_medium: 7.99, // 10–19 kg
  pkg_heavy: 9.99, // 20–30 kg
  pkg_villarrobledo: 19.99, // hasta 10 kg, entrega en 24 h
  // Comunes
  insurance: 12,
  commission_pct: 15,
};

/** Horas incluidas en el precio base de la mini mudanza. */
export const INCLUDED_HOURS = 2;

/** Paradas intermedias que se permiten añadir en una mini mudanza. */
export const MAX_STOPS = 3;

/** Tramos de peso del envío dentro de Albacete (máx. 30 kg). */
export const PACKAGE_WEIGHTS = [
  { key: "light", label: "0 – 9 kg", priceKey: "pkg_light", hint: "Sobres, paquetes y cajas ligeras" },
  { key: "medium", label: "10 – 19 kg", priceKey: "pkg_medium", hint: "Cajas medianas" },
  { key: "heavy", label: "20 – 30 kg", priceKey: "pkg_heavy", hint: "Cajas pesadas (máximo 30 kg)" },
];

/** Villarrobledo tiene un único tramo: hasta 10 kg con entrega en 24 h. */
export const VILLARROBLEDO_WEIGHTS = [
  {
    key: "vr_light",
    label: "Hasta 10 kg",
    priceKey: "pkg_villarrobledo",
    hint: "Recogida en Albacete y entrega en Villarrobledo en 24 h",
  },
];

const ALL_WEIGHTS = [...PACKAGE_WEIGHTS, ...VILLARROBLEDO_WEIGHTS];

/** Tramos disponibles según la zona de entrega. */
export function weightsForZone(zone) {
  return zone === "villarrobledo" ? VILLARROBLEDO_WEIGHTS : PACKAGE_WEIGHTS;
}

/** Etiqueta legible del tramo (para conductor, admin y resúmenes). */
export function packageWeightLabel(weight) {
  return ALL_WEIGHTS.find((w) => w.key === weight)?.label || "";
}

/**
 * Nombre del servicio de un pedido tal y como se enseña en listados, correos y
 * pantallas de seguimiento ("Envío de paquete · 10 – 19 kg").
 */
export function serviceSummary(row) {
  const service = serviceOf(row);
  if (service.key === "paquete" && row?.package_weight) {
    return `${service.label} · ${packageWeightLabel(row.package_weight)}`;
  }
  return service.label;
}

const num = (tariffs, key) => Number(tariffs?.[key] ?? DEFAULT_TARIFFS[key]) || 0;

/** Plantas que se cobran en una dirección: 0 si hay ascensor o no se ha indicado. */
export function billableFloors(hasLift, floors) {
  if (hasLift !== false) return 0;
  return Math.max(0, Math.min(20, Number(floors) || 0));
}

/** Paradas intermedias con dirección escrita. */
export function countStops(stops) {
  return (stops || []).filter((s) => String(s?.address || "").trim()).length;
}

/**
 * Precio de un pedido con su desglose línea a línea.
 *
 * El desglose es lo que ve el cliente antes de confirmar y lo que se guarda en
 * `price_breakdown`: ningún concepto puede llegar al total sin haberse mostrado
 * antes en el asistente.
 *
 * @returns {{ total: number, lines: {key:string,label:string,amount:number}[] }}
 */
export function quoteRequest(tariffs, form = {}) {
  const service = SERVICES[resolveServiceKey(form.service || form.service_type)] || SERVICES.porte;
  const lines = [];
  const add = (key, label, amount) => {
    if (amount) lines.push({ key, label, amount: round2(amount) });
  };

  if (service.key === "paquete") {
    const zone = form.destination_zone === "villarrobledo" ? "villarrobledo" : "albacete";
    const bracket = weightsForZone(zone).find((w) => w.key === form.package_weight);
    if (!bracket) return { total: 0, lines: [] };
    add(
      "base",
      zone === "villarrobledo"
        ? `Envío a Villarrobledo · ${bracket.label}`
        : `Envío de paquete · ${bracket.label}`,
      num(tariffs, bracket.priceKey),
    );
    return { total: round2(sum(lines)), lines };
  }

  add("base", baseLabel(service), num(tariffs, service.priceKey));

  if (service.hasExtraHours) {
    const hours = Math.max(0, Number(form.extra_hours) || 0);
    add("extra_hours", `${hours} h extra`, hours * num(tariffs, "mudanza_extra_hour"));
  }

  // Las plantas solo se cobran con ayuda contratada: sin ayuda el servicio es a
  // pie de calle y el conductor no sube.
  if (service.hasHelp && form.needs_help) {
    add("help", "Ayuda del conductor", num(tariffs, "mudanza_help"));

    if (service.hasAccess) {
      const floorPrice = num(tariffs, "mudanza_floor");
      const origin = billableFloors(form.origin_has_lift, form.origin_floors);
      const destination = billableFloors(form.destination_has_lift, form.destination_floors);
      add("origin_floors", `Recogida sin ascensor · ${plural(origin, "planta")}`, origin * floorPrice);
      add("destination_floors", `Entrega sin ascensor · ${plural(destination, "planta")}`, destination * floorPrice);
    }
  }

  if (service.hasStops) {
    const stops = countStops(form.stops);
    add("stops", `${plural(stops, "parada")} adicional${stops === 1 ? "" : "es"}`, stops * num(tariffs, "mudanza_stop"));
  }

  if (service.hasInsurance && form.insurance_selected) {
    add("insurance", "Seguro de mercancía", num(tariffs, "insurance"));
  }

  return { total: round2(sum(lines)), lines };
}

/** Precio "desde" que se muestra en la home y en las landings de cada servicio. */
export function servicePriceFrom(tariffs, key) {
  if (key === "paquete") return num(tariffs, "pkg_light");
  const service = SERVICES[key];
  return service?.priceKey ? num(tariffs, service.priceKey) : 0;
}

function baseLabel(service) {
  if (service.key === "mini_mudanza") return `Mini mudanza · ${INCLUDED_HOURS} h incluidas`;
  if (service.key === "porte_tienda") return "Compra en tienda · entrega con firma";
  return "Porte · precio cerrado";
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sum = (lines) => lines.reduce((acc, l) => acc + l.amount, 0);
const round2 = (n) => Math.round(n * 100) / 100;
