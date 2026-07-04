"use client";

/**
 * Tiempo estimado de llegada por carretera usando el router público de
 * OpenStreetMap (OSRM). Gratis y sin API key, igual que los mapas.
 * Devuelve { minutes, km } o null si el servicio no responde.
 */
// Zona de servicio: bounding box de Albacete capital
const ZONE = { latMin: 38.945, latMax: 39.03, lngMin: -1.91, lngMax: -1.81 };
const inZone = ({ lat, lng }) => lat >= ZONE.latMin && lat <= ZONE.latMax && lng >= ZONE.lngMin && lng <= ZONE.lngMax;

/**
 * Geocodifica una dirección de Albacete capital. Primario: Photon (OSM, gratis,
 * CORS abierto y sin restricciones de User-Agent). Respaldo: Nominatim.
 * Devuelve { lat, lng } o null. Uso ligero: una vez por pedido, con caché del caller.
 */
export async function geocodeAlbacete(address) {
  if (!address) return null;
  // Evitar "..., Albacete, Albacete": solo añadimos la ciudad si no está ya.
  const q = /albacete/i.test(address) ? address : `${address}, Albacete`;

  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=3&lat=38.9943&lon=-1.8585&lang=default`
    );
    if (res.ok) {
      const data = await res.json();
      for (const f of data?.features || []) {
        const [lng, lat] = f.geometry?.coordinates || [];
        if (lat && inZone({ lat, lng })) return { lat, lng };
      }
    }
  } catch {
    /* probar respaldo */
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", España")}&format=json&limit=1&countrycodes=es&viewbox=-1.91,39.03,-1.81,38.945&bounded=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const hit = (await res.json())?.[0];
    if (!hit) return null;
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
  } catch {
    return null;
  }
}

export async function fetchRouteEta(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  try {
    // overview=full + geojson: además de duración/distancia, la GEOMETRÍA de la
    // ruta para dibujarla en el mapa (estilo Uber).
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=false`;
    const res = await fetch(url);
    if (!res.ok) return haversineEta(from, to);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return haversineEta(from, to);
    return {
      minutes: Math.max(1, Math.round(route.duration / 60)),
      km: Math.round(route.distance / 100) / 10,
      // GeoJSON viene [lng, lat]; Leaflet quiere [lat, lng]
      coords: (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
    };
  } catch {
    return haversineEta(from, to);
  }
}

/** Distancia en línea recta (km) — para detectar "está llegando" (~100 m). */
export function distanceKm(from, to) {
  if (!from?.lat || !to?.lat) return Infinity;
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Fallback si el router público no responde: distancia en línea recta ×1.3
// (factor urbano) a ~20 km/h; la "ruta" es la línea recta entre ambos puntos.
function haversineEta(from, to) {
  const km = distanceKm(from, to) * 1.3;
  return {
    minutes: Math.max(1, Math.round((km / 20) * 60)),
    km: Math.round(km * 10) / 10,
    coords: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  };
}
