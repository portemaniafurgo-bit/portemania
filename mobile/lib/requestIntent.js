import { SERVICES, SERVICE_KEYS } from "./services";

/**
 * Traspaso del servicio elegido en la landing al asistente de compra, y de ahí
 * al login/registro y de vuelta, sin perder lo que el cliente ya había escrito.
 */

// Claves antiguas que siguen circulando en enlaces y marcadores.
const ALIASES = {
  transport: "porte",
  package: "paquete",
  envio_paquete: "paquete",
  compra_tienda: "porte_tienda",
};

const REQUEST_FIELDS = [
  "client_name",
  "client_phone",
  "origin_address",
  "destination_address",
];

function getParamValue(input, key) {
  if (!input) return "";
  if (typeof input.get === "function") return input.get(key) || "";
  return input[key] || "";
}

/** Servicio pedido en la URL, normalizado. Por defecto, porte. */
export function resolveServiceKey(input = {}) {
  const raw = getParamValue(input, "service");
  const key = ALIASES[raw] || raw;
  return SERVICE_KEYS.includes(key) ? key : "porte";
}

export function resolveRequestIntent(input = {}) {
  const service = resolveServiceKey(input);
  return { service, vehicle: SERVICES[service].vehicle || "" };
}

export function buildRequestSearchParams(input = {}) {
  const params = new URLSearchParams();
  params.set("service", resolveServiceKey(input));

  const zone = getParamValue(input, "zone");
  if (zone === "villarrobledo") params.set("zone", zone);

  REQUEST_FIELDS.forEach((field) => {
    const value = getParamValue(input, field).trim();
    if (value) params.set(field, value);
  });

  return params;
}

export function buildRequestHref(path, input = {}) {
  const query = buildRequestSearchParams(input).toString();
  return query ? `${path}?${query}` : path;
}

export function hasRequestDraft(input = {}) {
  return ["service", ...REQUEST_FIELDS].some((field) =>
    Boolean(getParamValue(input, field).trim()),
  );
}

export function readRequestDraft(searchParams) {
  const service = resolveServiceKey(searchParams);
  return {
    service,
    vehicle: SERVICES[service].vehicle || "",
    destination_zone:
      getParamValue(searchParams, "zone") === "villarrobledo" ? "villarrobledo" : "albacete",
    client_name: getParamValue(searchParams, "client_name"),
    client_phone: getParamValue(searchParams, "client_phone"),
    origin_address: getParamValue(searchParams, "origin_address"),
    destination_address: getParamValue(searchParams, "destination_address"),
  };
}
