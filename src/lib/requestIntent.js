const VALID_VEHICLES = new Set(["small", "large"]);

const SERVICE_DEFAULTS = {
  porte: { service: "transport", vehicle: "small" },
  mini_mudanza: { service: "transport", vehicle: "large" },
  compra_tienda: { service: "transport", vehicle: "large" },
  envio_paquete: { service: "package", vehicle: "" },
  package: { service: "package", vehicle: "" },
  transport: { service: "transport", vehicle: "" },
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

export function resolveRequestIntent(input = {}) {
  const rawService = getParamValue(input, "service") || "transport";
  const preset = SERVICE_DEFAULTS[rawService] || SERVICE_DEFAULTS.transport;
  const service = preset.service;
  const requestedVehicle = getParamValue(input, "vehicle");
  const vehicle =
    service === "transport" && VALID_VEHICLES.has(requestedVehicle)
      ? requestedVehicle
      : preset.vehicle;

  return { service, vehicle };
}

export function buildRequestSearchParams(input = {}) {
  const params = new URLSearchParams();
  const { service, vehicle } = resolveRequestIntent(input);

  params.set("service", service);
  if (vehicle) params.set("vehicle", vehicle);

  REQUEST_FIELDS.forEach((field) => {
    const value = getParamValue(input, field).trim();
    if (value) params.set(field, value);
  });

  return params;
}

export function buildRequestHref(path, input = {}) {
  const params = buildRequestSearchParams(input);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function hasRequestDraft(input = {}) {
  return ["service", "vehicle", ...REQUEST_FIELDS].some((field) =>
    Boolean(getParamValue(input, field).trim())
  );
}

export function readRequestDraft(searchParams) {
  const { service, vehicle } = resolveRequestIntent(searchParams);
  return {
    service,
    vehicle,
    client_name: getParamValue(searchParams, "client_name"),
    client_phone: getParamValue(searchParams, "client_phone"),
    origin_address: getParamValue(searchParams, "origin_address"),
    destination_address: getParamValue(searchParams, "destination_address"),
  };
}
