/**
 * Zonas de operación y validación de direcciones por código postal.
 *
 * Todo servicio recoge en Albacete capital. Solo el envío de paquetes puede
 * entregar fuera: Villarrobledo (02600), con entrega en 24 h y precio propio.
 */

export const ZONES = {
  albacete: {
    key: "albacete",
    label: "Albacete capital",
    codes: ["02001", "02002", "02003", "02004", "02005", "02006", "02007", "02008"],
    hint: "Incluye código postal (02001–02008)",
    range: "02001–02008",
  },
  villarrobledo: {
    key: "villarrobledo",
    label: "Villarrobledo",
    codes: ["02600"],
    hint: "Incluye el código postal de Villarrobledo (02600)",
    range: "02600",
  },
};

export const ZONE_KEYS = Object.keys(ZONES);

/** Todos los números de 5 dígitos de la dirección ("Polígono 12345, Albacete 02001"). */
export function extractPostalCodes(address = "") {
  return String(address).match(/\b\d{5}\b/g) || [];
}

/** ¿La dirección lleva un CP de la zona indicada? */
export function isInZone(address, zoneKey = "albacete") {
  const zone = ZONES[zoneKey];
  if (!zone) return false;
  return extractPostalCodes(address).some((cp) => zone.codes.includes(cp));
}

/**
 * Mensaje de error de una dirección, o "" si es válida.
 * Devolver cadena vacía en direcciones aún sin escribir evita marcar en rojo
 * un campo que el cliente todavía no ha tocado.
 */
export function postalCodeError(address, zoneKey = "albacete") {
  if (!String(address || "").trim()) return "";
  const zone = ZONES[zoneKey] || ZONES.albacete;
  const found = extractPostalCodes(address);
  if (found.length === 0) return `El código postal es obligatorio (${zone.range}).`;
  if (!found.some((cp) => zone.codes.includes(cp))) {
    return `El código postal ${found[0]} no pertenece a ${zone.label} (${zone.range}).`;
  }
  return "";
}

/** Zona de destino de un pedido: solo el envío de paquetes puede salir de la capital. */
export function destinationZoneOf(row) {
  const zone = row?.destination_zone;
  return ZONES[zone] ? zone : "albacete";
}
