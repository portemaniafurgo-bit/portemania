/**
 * Melodía propia del aviso de OFERTA NUEVA (canal Android `ofertas`).
 *
 * Genera `mobile/assets/sounds/oferta.wav` sin dependencias: dos golpes de dos
 * notas ascendentes (La5 → Re6), con envolvente de ataque corto y caída
 * exponencial para que no suene el clic del corte. Es un aviso que el conductor
 * tiene que reconocer conduciendo o cargando, sin mirar el móvil.
 *
 *   node scripts/generate-notification-sound.mjs
 *
 * El negocio puede sustituirlo por su propia melodía con el MISMO nombre de
 * fichero (WAV o un MP3 corto) y volver a compilar el APK/AAB: el sonido de un
 * canal de notificación es un recurso NATIVO, no viaja por OTA. Ojo: Android
 * congela la configuración del canal en la primera instalación, así que en un
 * móvil que ya tenga la app hay que desinstalarla para oír el sonido nuevo
 * (ver el comentario de `ensureChannels` en mobile/lib/push.js).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";

const OUT_DIR = "mobile/assets/sounds";
const OUT_FILE = `${OUT_DIR}/oferta.wav`;

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BITS = 16;
const PEAK = 0.75; // amplitud pico (0–1)
const ATTACK_S = 0.008; // 8 ms: sin ataque, el arranque chasquea

// Dos notas ascendentes, el silencio entre golpes y la cola final. Total 1,4 s.
const NOTE_A = { hz: 880, seconds: 0.15 }; // La5
const NOTE_B = { hz: 1174.66, seconds: 0.22 }; // Re6
const GAP_S = 0.2;
const TAIL_S = 0.26;

/**
 * Una nota con ataque lineal y caída exponencial. La caída llega a ~1 % del
 * pico al final, que es lo que hace que el corte no se oiga.
 */
function note({ hz, seconds }) {
  const total = Math.round(seconds * SAMPLE_RATE);
  const attack = Math.max(1, Math.round(ATTACK_S * SAMPLE_RATE));
  const samples = new Float64Array(total);
  for (let i = 0; i < total; i += 1) {
    const t = i / SAMPLE_RATE;
    const rise = i < attack ? i / attack : 1;
    // e^-5 ≈ 0,0067: la nota se apaga sola antes de acabarse.
    const fall = Math.exp((-5 * i) / total);
    samples[i] = PEAK * rise * fall * Math.sin(2 * Math.PI * hz * t);
  }
  return samples;
}

function silence(seconds) {
  return new Float64Array(Math.round(seconds * SAMPLE_RATE));
}

function concat(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Float64Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const golpe = [note(NOTE_A), note(NOTE_B), silence(GAP_S)];
const samples = concat([...golpe, ...golpe, silence(TAIL_S)]);

// PCM 16 bits con signo, little-endian.
const bytesPerSample = BITS / 8;
const dataBytes = samples.length * bytesPerSample * CHANNELS;
const data = Buffer.alloc(dataBytes);
for (let i = 0; i < samples.length; i += 1) {
  const clamped = Math.max(-1, Math.min(1, samples[i]));
  data.writeInt16LE(Math.round(clamped * 32767), i * bytesPerSample);
}

// Cabecera RIFF/WAVE canónica (44 bytes), con los tamaños calculados.
const header = Buffer.alloc(44);
const byteRate = SAMPLE_RATE * CHANNELS * bytesPerSample;
const blockAlign = CHANNELS * bytesPerSample;
header.write("RIFF", 0, "ascii");
header.writeUInt32LE(36 + dataBytes, 4); // tamaño del chunk RIFF
header.write("WAVE", 8, "ascii");
header.write("fmt ", 12, "ascii");
header.writeUInt32LE(16, 16); // tamaño del sub-chunk fmt (PCM)
header.writeUInt16LE(1, 20); // formato 1 = PCM sin comprimir
header.writeUInt16LE(CHANNELS, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(byteRate, 28);
header.writeUInt16LE(blockAlign, 32);
header.writeUInt16LE(BITS, 34);
header.write("data", 36, "ascii");
header.writeUInt32LE(dataBytes, 40);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, Buffer.concat([header, data]));

console.log(
  `Sonido generado: ${OUT_FILE} · ${(samples.length / SAMPLE_RATE).toFixed(2)} s · ` +
    `${(header.length + dataBytes) / 1024} KB`,
);
