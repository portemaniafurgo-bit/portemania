import * as Location from "expo-location";
import { ZONES } from "./zones";

/**
 * Autocompletado de direcciones y "usar mi ubicación".
 *
 * Mismo geocodificador que la web (Photon, de OpenStreetMap): gratis, sin API
 * key y sin las restricciones de User-Agent que hacían fallar a Nominatim desde
 * cliente. Aquí, además, se devuelven SUGERENCIAS mientras se escribe y se
 * deduce el código postal del resultado, en vez de exigir que el cliente lo
 * teclee y acertarlo con una expresión regular.
 *
 * La zona se sigue validando en el servidor: esto es comodidad, no seguridad.
 */
const PHOTON = "https://photon.komoot.io";
const ALBACETE = { lat: 38.9943, lng: -1.8585 };

/** Códigos postales de una zona, de la misma fuente que usa la web. */
function codesFor(zoneKey) {
  return new Set(ZONES[zoneKey]?.codes || []);
}

function formatFeature(feature, served) {
  const p = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (!lat || !lng) return null;

  // "Calle Mayor 3, 02001 Albacete" — el CP va incluido porque es lo que valida
  // el servidor al crear el pedido.
  const street = [p.name, p.housenumber].filter(Boolean).join(" ");
  const label = [street, p.postcode, p.city || p.county].filter(Boolean).join(", ");

  return {
    id: `${lat},${lng},${label}`,
    label,
    lat,
    lng,
    postcode: p.postcode || null,
    served: p.postcode ? served.has(p.postcode) : false,
  };
}

/**
 * Sugerencias para lo que el cliente lleva escrito. Devuelve [] si falla la red.
 * `zone` decide qué se marca como servible: una dirección de Villarrobledo es
 * válida como entrega de paquete y no como recogida de un porte.
 */
export async function suggestAddresses(query, { limit = 6, zone = "albacete" } = {}) {
  const q = (query || "").trim();
  if (q.length < 3) return [];
  const served = codesFor(zone);
  try {
    const res = await fetch(
      `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=${limit}&lat=${ALBACETE.lat}&lon=${ALBACETE.lng}&lang=default`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.features || [])
      .map(f => formatFeature(f, served))
      .filter(Boolean)
      // Primero lo que sí podemos servir: el resto se deja visible para que el
      // cliente entienda por qué no le vale, en vez de desaparecer sin más.
      .sort((a, b) => Number(b.served) - Number(a.served));
  } catch {
    return [];
  }
}

/** Dirección a partir de unas coordenadas (pin en el mapa o GPS del móvil). */
export async function addressFromCoords({ lat, lng }, { zone = "albacete" } = {}) {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=default`);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = (data?.features || [])[0];
    return feature ? formatFeature(feature, codesFor(zone)) : null;
  } catch {
    return null;
  }
}

/**
 * Ubicación actual del móvil, ya convertida en dirección.
 * Devuelve { granted: false } si el usuario no da permiso, para que la pantalla
 * lo explique en vez de quedarse en silencio.
 */
export async function currentAddress() {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return { granted: false, address: null };

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const address = await addressFromCoords({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  });
  return { granted: true, address };
}
