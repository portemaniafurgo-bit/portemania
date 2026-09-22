/**
 * Assets de la FICHA de Google Play y el icono de notificación de Android.
 *
 *   node scripts/generate-store-assets.mjs
 *
 * Reutiliza los trazados del logo de `generate-app-assets.mjs` (un solo origen
 * de verdad) y el sharp de la raíz. Salidas:
 *
 *   mobile/assets/notification-icon.png       96x96, silueta blanca transparente
 *   mobile/store/icon-512.png                 512x512, icono de la ficha
 *   mobile/store/feature-graphic-1024x500.png gráfico de cabecera de la ficha
 *
 * Las capturas de pantalla NO se generan aquí: las exige Play de un móvil real
 * (ver mobile/store/README.md).
 */
import { mkdirSync } from "node:fs";
import { MARK, markMono, markOnly, render } from "./generate-app-assets.mjs";

const ASSETS = "mobile/assets";
const STORE = "mobile/store";

mkdirSync(ASSETS, { recursive: true });
mkdirSync(STORE, { recursive: true });
mkdirSync(`${STORE}/screenshots`, { recursive: true });

// 1. Icono de NOTIFICACIÓN. Android lo pinta como silueta monocroma (a partir
// de Lollipop ignora el color y usa solo el canal alfa), así que todo el
// dibujo va en blanco puro sobre transparente: si se deja el pin amarillo, en
// el móvil sale un cuadrado gris.
await render(markMono("#ffffff"), {
  width: 76,
  height: 76,
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
})
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${ASSETS}/notification-icon.png`);

// 2. Icono de la ficha de Play: 512x512, el MISMO diseño que
// mobile/assets/icon.png (símbolo centrado sobre blanco) y sin transparencia,
// que Play rechaza el alfa.
await render(markOnly(), { width: 320, height: 320, fit: "contain", background: "#FFFFFF" })
  .extend({ top: 96, bottom: 96, left: 96, right: 96, background: "#FFFFFF" })
  .flatten({ background: "#FFFFFF" })
  .png()
  .toFile(`${STORE}/icon-512.png`);

// 3. Gráfico de cabecera (feature graphic), 1024x500: fondo morado de marca,
// logo completo en tono claro y el reclamo debajo.
//
// ⚠️ Tipografía: se pide Poppins, pero puede NO estar instalada en la máquina
// que ejecute esto (sharp/librsvg usa las fuentes del sistema, no las de la
// web). Por eso la pila acaba en Arial y en sans-serif genérica: el gráfico
// sale bien igualmente, solo cambia el corte de la letra del reclamo.
const FUENTE = "'Poppins','Montserrat','Arial','DejaVu Sans',sans-serif";

const featureGraphic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500">
  <rect width="1024" height="500" fill="#7145d6"/>
  <!-- Logo completo en tono claro: el trazado principal del isotipo en blanco
       (el pin se queda amarillo, como en la web) y el wordmark Clicy blanco /
       Voy amarillo. Caja del logo: 900x252, escalada a 560 de ancho. -->
  <g transform="translate(232 128) scale(0.6222) translate(0 6)">
    ${MARK("#FFFFFF")}
    <text x="225" y="145" font-family="${FUENTE}" font-weight="700" font-size="108">
      <tspan fill="#FFFFFF">Clicy</tspan><tspan fill="#F5B400">Voy</tspan>
    </text>
  </g>
  <text x="512" y="360" text-anchor="middle" font-family="${FUENTE}" font-weight="600" font-size="34" fill="#FFFFFF">Portes y mudanzas en Albacete, al momento</text>
</svg>`;

await render(featureGraphic, { width: 1024, height: 500, fit: "contain", background: "#7145d6" })
  .flatten({ background: "#7145d6" })
  .png()
  .toFile(`${STORE}/feature-graphic-1024x500.png`);

console.log("Assets de la ficha generados:");
console.log(` · ${ASSETS}/notification-icon.png`);
console.log(` · ${STORE}/icon-512.png`);
console.log(` · ${STORE}/feature-graphic-1024x500.png`);
