/**
 * Genera los assets de la app Android a partir del logotipo REAL de la web
 * (src/components/landing/Logo.jsx). Un solo origen de verdad: si el logo
 * cambia allí, se vuelve a ejecutar esto y la app queda igual que la web.
 *
 *   node scripts/generate-app-assets.mjs
 *
 * Usa el sharp de node_modules de la web (rasteriza SVG). Salidas en mobile/assets/.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "mobile/assets";
mkdirSync(OUT, { recursive: true });

// Los mismos trazados que Logo.jsx, con tone="dark" (wordmark #111111).
const MARK = (fill = "#111111") => `
  <g transform="translate(0 15)">
    <path fill="${fill}" d="M90 20 C55 20 28 47 28 82 V145 H58 V82 C58 64 72 50 90 50 H110 C128 50 142 64 142 82 V145 H172 V82 C172 47 145 20 110 20 Z"/>
    <path fill="#F5B400" d="M28 160 H58 V178 C58 202 76 220 100 220 C124 220 142 202 142 178 V160 H172 V178 C172 217 143 250 100 278 C57 250 28 217 28 178 Z" transform="translate(0 -60)"/>
    <path fill="#F5B400" d="M100 188 L74 162 H126 Z"/>
    <circle fill="#F5B400" cx="100" cy="102" r="16"/>
  </g>`;

const WORDMARK = `
  <text x="225" y="145" font-family="'Poppins','Montserrat','Arial',sans-serif" font-weight="700" font-size="108">
    <tspan fill="#111111">Clicy</tspan><tspan fill="#F5B400">Voy</tspan>
  </text>`;

const fullLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 220">${MARK()}${WORDMARK}</svg>`;
// Solo el símbolo, encuadrado a su caja real (x 28-172, y -15..215 tras el translate).
const markOnly = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 0 180 230">${MARK(fill)}</svg>`;

const render = (svg, opts) => sharp(Buffer.from(svg), { density: 300 }).resize(opts);

// Icono principal: símbolo centrado sobre blanco (Play lo redondea él).
await render(markOnly(), { width: 640, height: 640, fit: "contain", background: "#FFFFFF" })
  .extend({ top: 192, bottom: 192, left: 192, right: 192, background: "#FFFFFF" })
  .flatten({ background: "#FFFFFF" })
  .png()
  .toFile(`${OUT}/icon.png`);

// Adaptive icon: el sistema recorta hasta ~66% central, así que el símbolo va
// pequeño sobre transparente.
await render(markOnly(), { width: 480, height: 480, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 272, bottom: 272, left: 272, right: 272, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${OUT}/android-icon-foreground.png`);

await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#FFFFFF" } })
  .png()
  .toFile(`${OUT}/android-icon-background.png`);

// Monocromo (themed icons de Android 13+): silueta en un solo color.
await render(markOnly("#FFFFFF").replaceAll("#F5B400", "#FFFFFF"), {
  width: 480,
  height: 480,
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
})
  .extend({ top: 272, bottom: 272, left: 272, right: 272, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${OUT}/android-icon-monochrome.png`);

// Splash: logo completo sobre blanco. expo-splash-screen lo centra.
await render(fullLogo, { width: 1200, height: 294, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${OUT}/splash-icon.png`);

// Logo del login (@3x aprox para nitidez en pantallas densas).
await render(fullLogo, { width: 960, height: 235, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(`${OUT}/logo.png`);

// Favicon del modo web de Expo (irrelevante, pero que no quede el de la plantilla).
await render(markOnly(), { width: 48, height: 48, fit: "contain", background: "#FFFFFF" })
  .png()
  .toFile(`${OUT}/favicon.png`);

console.log("Assets generados en", OUT);
