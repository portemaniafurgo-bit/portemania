// Uso: node scripts/tests/geo.test.mjs  (copia lib/geo.js a un .mjs temporal)
import { copyFileSync } from "node:fs"; copyFileSync(new URL("../../lib/geo.js", import.meta.url), new URL("./.geo.tmp.mjs", import.meta.url));
const g = await import("./.geo.tmp.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { (cond ? pass++ : fail++); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const L = (lat, lng, acc, ts) => ({ coords: { latitude: lat, longitude: lng, accuracy: acc }, timestamp: ts });
const T0 = 1_700_000_000_000;
const base = { lat: 38.99, lng: -1.85, ts: T0 };
const dLat = m => m / 111_195; // metros -> grados de latitud

// pickFix
let f = g.pickFix([L(38.99, -1.85, 80, T0 + 1000), L(38.99 + dLat(30), -1.85, 12, T0 + 2000), L(38.99 + dLat(40), -1.85, 70, T0 + 3000)], base, T0 + 3000);
ok("lote: elige el bueno mas reciente, no el ultimo malo", f && f.acc === 12, JSON.stringify(f));
f = g.pickFix([L(38.99 + dLat(20), -1.85, 10, T0 + 2000), L(38.99 + dLat(30), -1.85, 15, T0 + 4000)], base, T0 + 4000);
ok("varios buenos: el mas reciente", f && f.ts === T0 + 4000);
f = g.pickFix([L(38.99 + dLat(20), -1.85, 10, T0 - 1000)], base, T0 + 1000);
ok("fix mas viejo que lo escrito: fuera", f === null);
f = g.pickFix([L(38.99 + dLat(20), -1.85, 10, T0)], base, T0 + 1000);
ok("fix con la misma marca que lo escrito: fuera", f === null);
f = g.pickFix([L(38.99 + dLat(80), -1.85, 90, T0 + 5000)], base, T0 + 10_000);
ok("todos malos y lo escrito tiene 10 s: no se escribe", f === null);
f = g.pickFix([L(38.99 + dLat(80), -1.85, 140, T0 + 14_000)], base, T0 + 15_000);
ok("(11) todos malos y lo escrito tiene 15 s justos: aun no", f === null);
f = g.pickFix([L(38.99 + dLat(80), -1.85, 140, T0 + 14_000), L(38.99 + dLat(60), -1.85, 90, T0 + 15_000), L(38.99, -1.85, 200, T0 + 16_000)], base, T0 + 16_000);
ok("(11) todos malos y lo escrito tiene 16 s: el de mejor precision <=150", f && f.acc === 90, JSON.stringify(f));
f = g.pickFix([L(38.99, -1.85, 200, T0 + 40_000)], base, T0 + 41_000);
ok("todos >150 m con 41 s sin escribir: no se escribe", f === null);
f = g.pickFix([L(38.99 + dLat(30), -1.85, 60, T0 + 4000)], base, T0 + 4000);
ok("(11) fix de 60 m cuenta como bueno (limite 65)", f && f.acc === 60);
f = g.pickFix([L(38.99 + dLat(30), -1.85, 70, T0 + 4000)], base, T0 + 4000);
ok("(11) fix de 70 m con 4 s sin escribir: no", f === null);
// (2) tercer nivel
f = g.pickFix([L(38.99 + dLat(300), -1.85, 600, T0 + 91_000), L(38.99 + dLat(200), -1.85, 400, T0 + 92_000)], base, T0 + 92_000);
ok("(2) 92 s sin escribir: acepta el mejor hasta 1 km", f && f.acc === 400, JSON.stringify(f));
f = g.pickFix([L(38.99 + dLat(200), -1.85, 400, T0 + 60_000)], base, T0 + 60_000);
ok("(2) 60 s sin escribir: 400 m aun no", f === null);
f = g.pickFix([L(38.99, -1.85, 1200, T0 + 120_000)], base, T0 + 120_000);
ok("(2) mas de 1 km de precision: nunca", f === null);
f = g.pickFix([L(38.99 + dLat(30), -1.85, 900, T0 + 95_000)], null, T0 + 95_000);
ok("(2) nada escrito todavia: tambien vale hasta 1 km", f && f.acc === 900);
f = g.pickFix([L(38.99, -1.85, 120, T0)], null, T0);
ok("primer fix del servicio, regular (120 m): se acepta para no dejar el mapa vacio", f && f.acc === 120);
const baseRegular = { ...base, acc: 60 };
f = g.pickFix([L(38.99 + dLat(250), -1.85, 10, T0 + 4000)], base, T0 + 4000);
ok("(8) 250 m en 4 s, ultimo sin precision guardada: fuera (240 m -> 216 km/h)", f === null);
f = g.pickFix([L(38.99 + dLat(250), -1.85, 10, T0 + 4000)], baseRegular, T0 + 4000);
ok("(8) mismo salto con el ultimo a 60 m: se resta tambien, 180 m -> 162 km/h, vale", !!f);
f = g.pickFix([L(38.99 + dLat(1000), -1.85, 10, T0 + 4000)], baseRegular, T0 + 4000);
ok("(8) 1 km en 4 s aun restando ambas: fuera", f === null);
f = g.pickFix([L(38.99 + dLat(1000), -1.85, 10, T0 + 4000)], base, T0 + 4000);
ok("salto de 1 km en 4 s (900 km/h): fuera", f === null);
f = g.pickFix([L(38.99 + dLat(130), -1.85, 8, T0 + 4000)], base, T0 + 4000);
ok("autovia 130 m en 4 s (117 km/h): se acepta", !!f);
f = g.pickFix([L(38.99 + dLat(1000), -1.85, 10, T0 + 30_000)], base, T0 + 30_000);
ok("1 km en 30 s (120 km/h): se acepta (el filtro se cura solo)", !!f);
f = g.pickFix([L(38.99 + dLat(25), -1.85, 10, T0 + 200)], base, T0 + 200);
ok("dos marcas casi iguales: suelo de 1 s, sin velocidad infinita", !!f);
f = g.pickFix([{ coords: { latitude: 0, longitude: 0, accuracy: 5 }, timestamp: T0 + 9000 }, { coords: {}, timestamp: T0 + 9000 }], base, T0 + 9000);
ok("coordenadas 0,0 o vacias: fuera", f === null);
f = g.pickFix([L(38.99 + dLat(20), -1.85, undefined, T0 + 40_000)], base, T0 + 40_000);
ok("sin precision: cuenta como 100 m (solo vale de rescate)", f && f.acc === 100);
f = g.pickFix([L(38.99 + dLat(20), -1.85, 10, undefined)], base, T0 + 40_000);
ok("sin marca de tiempo: fuera", f === null);

// (3) isStillRepeat
const w = { lat: 38.99, lng: -1.85, ts: T0, acc: 8 };
const fx = (m, acc, dt) => ({ lat: 38.99 + dLat(m), lng: -1.85, acc, ts: T0 + dt });
ok("(3) parado: 5 m a los 8 s -> no se escribe", g.isStillRepeat(w, fx(5, 8, 8000)) === true);
ok("(3) parado: 25 m de ruido con precision 30 a los 8 s -> no se escribe", g.isStillRepeat(w, fx(25, 30, 8000)) === true);
ok("(3) parado: 5 m a los 20 s -> si se escribe (latido)", g.isStillRepeat(w, fx(5, 8, 20_000)) === false);
ok("(3) en marcha: 40 m a los 4 s con precision 8 -> se escribe", g.isStillRepeat(w, fx(40, 8, 4000)) === false);
ok("(3) sin ultimo escrito -> se escribe", g.isStillRepeat(null, fx(0, 8, 4000)) === false);

// distanceToPolyline
const line = [{ lat: 38.99, lng: -1.85 }, { lat: 38.99, lng: -1.84 }, { lat: 39.0, lng: -1.84 }];
const segLen = g.metersBetween(line[0], line[1]);
let p = g.distanceToPolyline({ lat: 38.99 + dLat(100), lng: -1.845 }, line);
ok("punto a 100 m al norte del primer tramo", Math.abs(p.distanceM - 100) < 1, `d=${p.distanceM.toFixed(2)} idx=${p.index} t=${p.t.toFixed(3)}`);
ok("  ...cae a mitad del tramo 0", p.index === 0 && Math.abs(p.t - 0.5) < 0.01 && Math.abs(p.alongM - segLen / 2) < 2, `along=${p.alongM.toFixed(1)} de ${segLen.toFixed(1)}`);
p = g.distanceToPolyline({ lat: 38.995, lng: -1.84 }, line);
ok("punto sobre el segundo tramo: distancia ~0", p.distanceM < 1 && p.index === 1, `d=${p.distanceM.toFixed(3)}`);
ok("  ...longitud total = suma de tramos", Math.abs(p.totalM - g.polylineLength(line)) < 2, `${p.totalM.toFixed(1)} vs ${g.polylineLength(line).toFixed(1)}`);
p = g.distanceToPolyline({ lat: 38.99, lng: -1.86 }, line);
ok("punto antes del inicio: distancia al extremo (t=0)", p.index === 0 && p.t === 0 && Math.abs(p.distanceM - g.metersBetween({ lat: 38.99, lng: -1.86 }, line[0])) < 2, `d=${p.distanceM.toFixed(1)}`);
p = g.distanceToPolyline({ lat: 38.99 + dLat(200), lng: -1.845 }, line);
ok("200 m fuera de la ruta: > 150 (pide ruta nueva)", p.distanceM > 150, `d=${p.distanceM.toFixed(1)}`);
ok("polilinea de un punto: null", g.distanceToPolyline({ lat: 1, lng: 1 }, [{ lat: 1, lng: 1 }]) === null);

// glidePlan + lerpPoint
const a = { lat: 38.99, lng: -1.85 }, b = { lat: 38.99 + dLat(50), lng: -1.85 };
ok("50 m, fixes a 4 s: desliza 4 s", JSON.stringify(g.glidePlan(a, b, 4000)) === '{"instant":false,"durationMs":4000}');
ok("50 m, fixes a 2,5 s: desliza 2,5 s", g.glidePlan(a, b, 2500).durationMs === 2500);
ok("fixes a 10 s: tope de 4 s", g.glidePlan(a, b, 10_000).durationMs === 4000);
ok("salto > 1,5 km: instantaneo", g.glidePlan(a, { lat: 38.99 + dLat(1600), lng: -1.85 }, 4000).instant === true);
ok("fix anterior de hace 61 s: instantaneo", g.glidePlan(a, b, 61_000).instant === true);
ok("hueco 0 o negativo: instantaneo", g.glidePlan(a, b, 0).instant && g.glidePlan(a, b, -5).instant);
const m = g.lerpPoint(a, b, 0.5);
ok("lerp a mitad", Math.abs(g.metersBetween(a, m) - 25) < 0.5, `${g.metersBetween(a, m).toFixed(2)} m`);
ok("lerp acota t (t=2 -> destino)", g.lerpPoint(a, b, 2).lat === b.lat);
console.log(`\n${pass} OK, ${fail} FAIL`);
