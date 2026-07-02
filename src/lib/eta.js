"use client";

/**
 * Tiempo estimado de llegada por carretera usando el router público de
 * OpenStreetMap (OSRM). Gratis y sin API key, igual que los mapas.
 * Devuelve { minutes, km } o null si el servicio no responde.
 */
/**
 * Geocodifica una dirección de Albacete capital con Nominatim (OSM, gratis).
 * Devuelve { lat, lng } o null. Uso ligero: una vez por pedido, con caché del caller.
 */
export async function geocodeAlbacete(address) {
  if (!address) return null;
  try {
    const q = encodeURIComponent(`${address}, Albacete, España`);
    // viewbox + bounded: solo resultados dentro de Albacete capital (zona de servicio)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=es&viewbox=-1.91,39.03,-1.81,38.945&bounded=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  } catch {
    return null;
  }
}

export async function fetchRouteEta(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
    const res = await fetch(url);
    if (!res.ok) return haversineEta(from, to);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return haversineEta(from, to);
    return {
      minutes: Math.max(1, Math.round(route.duration / 60)),
      km: Math.round(route.distance / 100) / 10,
    };
  } catch {
    return haversineEta(from, to);
  }
}

// Fallback si el router público no responde: distancia en línea recta ×1.3
// (factor urbano) a ~20 km/h de velocidad media en ciudad.
function haversineEta(from, to) {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(a)) * 1.3;
  return {
    minutes: Math.max(1, Math.round((km / 20) * 60)),
    km: Math.round(km * 10) / 10,
  };
}
