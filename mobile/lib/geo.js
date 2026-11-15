/**
 * Cálculos puros de posición para el seguimiento en vivo: qué fix del GPS se
 * acepta, a qué distancia está el conductor de la ruta dibujada y cómo se
 * desliza la furgoneta entre dos posiciones.
 *
 * Sin imports a propósito: lo usan la tarea de segundo plano (que corre sin
 * interfaz), el mapa y la pantalla del conductor, y así se puede comprobar con
 * node sin levantar la app.
 *
 * Por qué existe: en viajes reales el cliente veía la furgoneta en calles por
 * las que no pasaba y saltando de manzana en manzana (y a saltos por la
 * autovía). La captura era de precisión media, se escribía a ciegas el último
 * punto del lote, fuera bueno o malo, y el mapa lo pintaba sin transición.
 */

/** Precisión (radio en metros) a partir de la cual un fix se considera malo.
 *  65 y no 50: en calles estrechas el GPS bueno ronda los 50-60 m. */
export const GOOD_ACCURACY_M = 65;
/** Si todo es malo y lo último escrito tiene más de 15 s, se acepta hasta 150 m
 *  para que el mapa del cliente no se congele (túnel, garaje, cañón urbano). */
export const FALLBACK_ACCURACY_M = 150;
export const STALE_AFTER_MS = 15_000;
/** Último recurso: con más de 90 s sin escribir nada, hasta 1 km. Mejor una
 *  posición aproximada que una congelada (conductor aún con las opciones de
 *  captura viejas a mitad de servicio, o dentro de un edificio). */
export const LAST_RESORT_ACCURACY_M = 1000;
export const LAST_RESORT_AFTER_MS = 90_000;
/** Parado: con el conductor quieto, una escritura cada 20 s como mucho. */
export const STILL_WRITE_MS = 20_000;
/** Velocidad imposible para una furgoneta: un salto así es un rebote del GPS. */
export const MAX_SPEED_KMH = 180;

/** Metros entre dos coordenadas { lat, lng } (fórmula del semiverseno). */
export function metersBetween(a, b) {
  const rad = x => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Pasa un LocationObject de expo-location a { lat, lng, acc, ts }, o null si
 * no trae coordenadas válidas. Sin precisión conocida se asume 100 m: no pasa
 * como bueno, pero puede salvar al mapa de quedarse congelado.
 */
export function normalizeFix(location) {
  const c = location?.coords;
  const lat = Number(c?.latitude);
  const lng = Number(c?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const acc = Number.isFinite(c?.accuracy) && c.accuracy >= 0 ? c.accuracy : 100;
  const ts = Number.isFinite(location?.timestamp) ? location.timestamp : null;
  return { lat, lng, acc, ts };
}

/**
 * Elige, de un lote de fixes, el que merece escribirse (o null si ninguno).
 *
 * - Descarta los que no son más nuevos que el último escrito.
 * - Descarta los saltos imposibles (> 180 km/h respecto al último escrito). A
 *   la distancia se le restan las precisiones de los DOS fixes, para no
 *   castigar un fix bueno que llega justo después de uno regular; y el tiempo
 *   tiene un suelo de 1 s para que dos marcas casi iguales no den velocidad
 *   infinita.
 * - De los buenos (≤ 65 m), el más reciente.
 * - Si no hay ninguno bueno y lo último escrito tiene más de 15 s (o no hay
 *   nada escrito), el de mejor precisión hasta 150 m.
 * - Y si tiene más de 90 s, el de mejor precisión hasta 1 km.
 *
 * `last` es { lat, lng, ts, acc } del último escrito (o null). `nowMs` es la hora
 * del dispositivo, para decidir si lo escrito ya está viejo.
 */
export function pickFix(locations, last, nowMs) {
  const fixes = (locations || []).map(normalizeFix).filter(Boolean);
  const lastTs = Number.isFinite(last?.ts) ? last.ts : null;

  const plausible = fixes.filter(fix => {
    // Sin marca de tiempo no se puede ordenar ni medir velocidad: fuera.
    if (fix.ts == null) return false;
    if (lastTs == null) return true;
    if (fix.ts <= lastTs) return false;
    const seconds = Math.max(1, (fix.ts - lastTs) / 1000);
    const lastAcc = Number.isFinite(last.acc) ? last.acc : 0;
    const meters = Math.max(0, metersBetween(last, fix) - fix.acc - lastAcc);
    return (meters / seconds) * 3.6 <= MAX_SPEED_KMH;
  });

  const good = plausible.filter(fix => fix.acc <= GOOD_ACCURACY_M);
  if (good.length) {
    return good.reduce((best, fix) => (fix.ts > best.ts ? fix : best));
  }

  const silentMs = lastTs == null ? Infinity : nowMs - lastTs;
  if (silentMs <= STALE_AFTER_MS) return null;
  const limit = silentMs > LAST_RESORT_AFTER_MS ? LAST_RESORT_ACCURACY_M : FALLBACK_ACCURACY_M;
  const usable = plausible.filter(fix => fix.acc <= limit);
  if (!usable.length) return null;
  return usable.reduce((best, fix) =>
    fix.acc < best.acc || (fix.acc === best.acc && fix.ts > best.ts) ? fix : best,
  );
}

/**
 * Conductor parado: el fix nuevo cae dentro del ruido del GPS respecto al
 * último escrito (menos de 10 m o de su propia precisión) y hace menos de
 * 20 s de aquel. No se escribe, y así la furgoneta no "repta" por la calle
 * con el ruido; cada 20 s sí, para que la posición siga constando como viva.
 */
export function isStillRepeat(last, fix) {
  if (!last || !fix || !Number.isFinite(last.ts) || !Number.isFinite(fix.ts)) return false;
  return (
    metersBetween(last, fix) < Math.max(10, fix.acc || 0) && fix.ts - last.ts < STILL_WRITE_MS
  );
}

/**
 * Proyección local en metros alrededor de `origin` (equirectangular). Para
 * distancias de una ciudad o un tramo de autovía el error es despreciable.
 */
function toLocalMeters(origin, point) {
  const R = 6371000;
  const rad = x => (x * Math.PI) / 180;
  return {
    x: rad(point.lng - origin.lng) * Math.cos(rad(origin.lat)) * R,
    y: rad(point.lat - origin.lat) * R,
  };
}

/**
 * Distancia (m) de `point` a la polilínea `line` ([{ lat, lng }, ...]) y en
 * qué punto de ella cae: `index` del tramo, `t` (0..1) dentro del tramo y
 * `alongM`, metros recorridos desde el inicio hasta la proyección. Sirve para
 * saber si el conductor se ha salido de la ruta dibujada y cuánto le queda.
 * Devuelve null con menos de dos puntos.
 */
export function distanceToPolyline(point, line) {
  if (!point || !line || line.length < 2) return null;
  let best = null;
  let along = 0;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = toLocalMeters(point, line[i]);
    const b = toLocalMeters(point, line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const segLen = Math.sqrt(len2);
    // El punto está en el origen (0, 0) de la proyección local.
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2)) : 0;
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.sqrt(px * px + py * py);
    if (!best || d < best.distanceM) {
      best = { distanceM: d, index: i, t, alongM: along + t * segLen };
    }
    along += segLen;
  }
  return { ...best, totalM: along };
}

/** Longitud total (m) de una polilínea [{ lat, lng }, ...]. */
export function polylineLength(line) {
  let total = 0;
  for (let i = 0; i < (line?.length || 0) - 1; i += 1) total += metersBetween(line[i], line[i + 1]);
  return total;
}

/** Saltos a partir de los cuales la furgoneta se coloca sin deslizarse. */
export const SNAP_DISTANCE_M = 1500;
export const SNAP_GAP_MS = 60_000;
export const MAX_GLIDE_MS = 4000;

/**
 * Cómo pasar de la posición pintada a la nueva: `{ instant: true }` o
 * `{ instant: false, durationMs }`. Se desliza durante el tiempo que separa
 * los dos fixes (tope 4 s), así la furgoneta va a ritmo real. Si el salto es
 * de más de 1,5 km o el fix anterior tiene más de 60 s, se coloca de golpe:
 * deslizar por encima de manzanas enteras sería inventarse el recorrido.
 */
export function glidePlan(from, to, gapMs) {
  if (!from || !to) return { instant: true };
  if (metersBetween(from, to) > SNAP_DISTANCE_M) return { instant: true };
  if (!Number.isFinite(gapMs) || gapMs <= 0 || gapMs > SNAP_GAP_MS) return { instant: true };
  const durationMs = Math.min(gapMs, MAX_GLIDE_MS);
  if (durationMs < 50) return { instant: true };
  return { instant: false, durationMs };
}

/** Punto intermedio lineal entre a y b, con `t` en 0..1. */
export function lerpPoint(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}
