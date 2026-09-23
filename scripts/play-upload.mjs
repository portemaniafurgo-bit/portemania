/**
 * Sube a Google Play lo que en la consola exigiría un selector de ficheros del
 * navegador: el AAB, las notas de la versión y los gráficos de la ficha (icono,
 * gráfico de cabecera y capturas). Habla directamente con la Google Play
 * Developer API v3 (androidpublisher), autenticándose con la cuenta de servicio
 * que vive en `mobile/play-service-account.json` (ignorada por git).
 *
 * Node >= 20, sin dependencias: solo módulos de Node y el `fetch` global.
 *
 * EJEMPLOS
 * --------
 *   # 1) Comprobar credenciales y permisos sin cambiar nada
 *   node scripts/play-upload.mjs --validate
 *
 *   # 2) Subida completa: bundle a la pista interna + icono + cabecera
 *   node scripts/play-upload.mjs \
 *     --aab "C:/Users/PROPIETARIO/Downloads/clicyvoy-1.0.0-vc2.aab" \
 *     --icon mobile/store/icon-512.png \
 *     --feature mobile/store/feature-graphic-1024x500.png
 *
 *   # 3) Solo las capturas (borra las que hubiera y sube las del directorio)
 *   node scripts/play-upload.mjs --screenshots mobile/store/screenshots
 *
 *   # 4) Ensayo sin red: valida ficheros, dimensiones y notas, y enseña el plan
 *   node scripts/play-upload.mjs --dry-run --aab ... --icon ... --feature ...
 *
 * AVISOS IMPORTANTES
 * ------------------
 * - En una app NUNCA PUBLICADA, Google solo admite versiones en estado `draft`.
 *   Por eso `--status` vale `draft` por defecto. El botón «Iniciar lanzamiento»
 *   se pulsa a mano en Play Console (Pruebas internas -> la versión aparece como
 *   borrador -> Revisar versión -> Iniciar lanzamiento en pruebas internas).
 * - El commit se hace con `changesNotSentForReview=true`: NO envía nada a
 *   revisión. Para enviarlo, y solo con decisión explícita, `--send-for-review`.
 * - Este script escribe en la cuenta de Play del negocio. Antes de tocar nada en
 *   serio, pasa `--dry-run` y luego `--validate`.
 */
import { createSign } from "node:crypto";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ESTE_FICHERO = fileURLToPath(import.meta.url);
const RAIZ = path.resolve(path.dirname(ESTE_FICHERO), "..");

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const BASE_UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";

const PISTAS = ["internal", "alpha", "beta", "production"];
const ESTADOS = ["draft", "completed"];

const AYUDA = `
play-upload.mjs — sube a Google Play el AAB, las notas y los gráficos de la ficha
                  por la Developer API v3 (sin tocar la consola).

USO
  node scripts/play-upload.mjs [opciones]

CREDENCIALES
  --service-account <ruta>  JSON de la cuenta de servicio.
                            Por defecto: mobile/play-service-account.json
                            (también se acepta la variable PLAY_SERVICE_ACCOUNT)
  --package <id>            Nombre de paquete. Por defecto: com.clicyvoy.app
  --lang <bcp47>            Idioma de la ficha. Por defecto: es-ES

QUÉ SUBIR
  --aab <ruta>              Sube el bundle y crea/actualiza la versión en la pista.
  --track <pista>           internal | alpha | beta | production. Por defecto: internal
  --status <estado>         draft | completed. Por defecto: draft
                            (en una app nunca publicada Google SOLO admite draft)
  --version-name <texto>    Nombre de la versión. Por defecto: el de mobile/app.json
  --notes <ruta>            Fichero de texto con las notas en el idioma de --lang.
                            Si se omite y hay --aab, se extraen del bloque de
                            mobile/store/listing.es.md bajo "## Novedades de la versión".
  --icon <png>              Icono 512x512 (borra los iconos anteriores).
  --feature <png>           Gráfico de cabecera 1024x500 (borra los anteriores).
  --screenshots <dir>       Sube como phoneScreenshots los .png/.jpg/.jpeg del
                            directorio en orden alfabético (borra los anteriores).

MODOS
  --validate                Solo autentica, abre un edit, lista las pistas y lo
                            DESCARTA. Comprueba credenciales y permisos sin cambiar nada.
  --dry-run                 No toca la red: valida ficheros, dimensiones y notas,
                            y enseña el plan de llamadas.
  --send-for-review         Quita changesNotSentForReview=true del commit.
                            Por defecto NUNCA se envía a revisión.
  --help                    Esta ayuda.

TRAS LA SUBIDA
  La versión queda como borrador. En Play Console: Pruebas internas ->
  Revisar versión -> Iniciar lanzamiento en pruebas internas.
`.trim();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

class ErrorGoogle extends Error {}
class ErrorUso extends Error {}

function base64url(datos) {
  return Buffer.from(datos).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function resolverRuta(ruta) {
  return path.isAbsolute(ruta) ? path.normalize(ruta) : path.resolve(process.cwd(), ruta);
}

function mb(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ok(texto) {
  console.log(`✓ ${texto}`);
}

function mal(texto) {
  console.error(`✗ ${texto}`);
}

function aviso(texto) {
  console.log(`! ${texto}`);
}

/** Lee el ancho y el alto de un PNG desde la cabecera IHDR (primeros 24 bytes). */
function dimensionesPng(ruta) {
  const fd = openSync(ruta, "r");
  try {
    const cab = Buffer.alloc(24);
    const leidos = readSync(fd, cab, 0, 24, 0);
    if (leidos < 24) throw new ErrorUso(`${ruta}: fichero demasiado corto para ser un PNG.`);
    const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!cab.subarray(0, 8).equals(firma)) throw new ErrorUso(`${ruta}: no tiene firma PNG.`);
    if (cab.subarray(12, 16).toString("latin1") !== "IHDR") throw new ErrorUso(`${ruta}: PNG sin IHDR al principio.`);
    return { ancho: cab.readUInt32BE(16), alto: cab.readUInt32BE(20) };
  } finally {
    closeSync(fd);
  }
}

function esPng(ruta) {
  return path.extname(ruta).toLowerCase() === ".png";
}

function tipoContenidoImagen(ruta) {
  return esPng(ruta) ? "image/png" : "image/jpeg";
}

/** Relación 16:9 o 9:16 con tolerancia del 2 %. */
function relacionValidaCaptura(ancho, alto) {
  const objetivo = 16 / 9;
  const r = Math.max(ancho, alto) / Math.min(ancho, alto);
  return Math.abs(r - objetivo) / objetivo <= 0.02;
}

/** Comprueba un fichero de imagen según su papel en la ficha. Devuelve el detalle. */
function validarImagen(ruta, papel) {
  if (!existsSync(ruta)) throw new ErrorUso(`No existe la imagen: ${ruta}`);
  const tam = statSync(ruta).size;
  if (!esPng(ruta)) {
    if (papel !== "captura") throw new ErrorUso(`${ruta}: ${papel} debe ser PNG.`);
    return `${path.basename(ruta)} (${mb(tam)}) — JPEG: dimensiones no comprobadas (solo se leen las de PNG)`;
  }
  const { ancho, alto } = dimensionesPng(ruta);
  if (papel === "icono" && (ancho !== 512 || alto !== 512)) {
    throw new ErrorUso(`${ruta}: el icono debe ser 512x512 y es ${ancho}x${alto}.`);
  }
  if (papel === "cabecera" && (ancho !== 1024 || alto !== 500)) {
    throw new ErrorUso(`${ruta}: el gráfico de cabecera debe ser 1024x500 y es ${ancho}x${alto}.`);
  }
  if (papel === "captura") {
    const lados = [ancho, alto];
    if (lados.some((l) => l < 320 || l > 3840)) {
      throw new ErrorUso(`${ruta}: cada lado debe medir entre 320 y 3840 px, y mide ${ancho}x${alto}.`);
    }
    if (!relacionValidaCaptura(ancho, alto)) {
      const r = (Math.max(ancho, alto) / Math.min(ancho, alto)).toFixed(3);
      throw new ErrorUso(`${ruta}: la relación debe ser 16:9 o 9:16 (±2 %) y es ${ancho}x${alto} (${r}:1).`);
    }
  }
  return `${path.basename(ruta)} ${ancho}x${alto} (${mb(tam)})`;
}

/** Ficheros de imagen de un directorio, en orden alfabético. */
function listarCapturas(dir) {
  if (!existsSync(dir)) throw new ErrorUso(`No existe el directorio de capturas: ${dir}`);
  if (!statSync(dir).isDirectory()) throw new ErrorUso(`No es un directorio: ${dir}`);
  return readdirSync(dir)
    .filter((f) => [".png", ".jpg", ".jpeg"].includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((f) => path.join(dir, f));
}

/** Notas de la versión: del fichero indicado o del bloque de listing.es.md. */
function leerNotas(opciones) {
  if (opciones.notas) {
    const ruta = resolverRuta(opciones.notas);
    if (!existsSync(ruta)) throw new ErrorUso(`No existe el fichero de notas: ${ruta}`);
    const texto = readFileSync(ruta, "utf8").trim();
    if (!texto) throw new ErrorUso(`El fichero de notas está vacío: ${ruta}`);
    return { texto, origen: ruta };
  }
  const listado = path.join(RAIZ, "mobile", "store", "listing.es.md");
  if (!existsSync(listado)) {
    throw new ErrorUso(
      `No hay --notes y tampoco existe ${listado}. Pasa --notes <fichero.txt> con las notas de la versión.`,
    );
  }
  const texto = readFileSync(listado, "utf8");
  const indice = texto.search(/^##\s+Novedades de la versi[oó]n/im);
  if (indice < 0) {
    throw new ErrorUso(
      `No encuentro el encabezado "## Novedades de la versión" en ${listado}. Pasa --notes <fichero.txt>.`,
    );
  }
  const bloque = texto.slice(indice).match(/```[a-zA-Z0-9]*\r?\n([\s\S]*?)\r?\n```/);
  if (!bloque) {
    throw new ErrorUso(
      `Encontré "## Novedades de la versión" en ${listado} pero no el bloque \`\`\` que lo sigue. Pasa --notes <fichero.txt>.`,
    );
  }
  const notas = bloque[1].trim();
  if (!notas) throw new ErrorUso(`El bloque de novedades de ${listado} está vacío. Pasa --notes <fichero.txt>.`);
  return { texto: notas, origen: `${listado} (bloque de novedades)` };
}

/** Nombre de versión por defecto: el `expo.version` de mobile/app.json. */
function versionPorDefecto() {
  const appJson = path.join(RAIZ, "mobile", "app.json");
  try {
    const datos = JSON.parse(readFileSync(appJson, "utf8"));
    if (datos?.expo?.version) return String(datos.expo.version);
  } catch {
    // Sin app.json legible se cae al valor fijo; no es motivo para parar.
  }
  return "1.0.0";
}

// ---------------------------------------------------------------------------
// Línea de comandos
// ---------------------------------------------------------------------------

function parsearArgumentos(argv) {
  const opciones = {
    cuentaServicio: process.env.PLAY_SERVICE_ACCOUNT || null,
    paquete: "com.clicyvoy.app",
    idioma: "es-ES",
    aab: null,
    pista: "internal",
    estado: "draft",
    nombreVersion: null,
    notas: null,
    icono: null,
    cabecera: null,
    capturas: null,
    validar: false,
    ensayo: false,
    enviarARevision: false,
    ayuda: false,
  };

  const conValor = {
    "--service-account": "cuentaServicio",
    "--package": "paquete",
    "--lang": "idioma",
    "--aab": "aab",
    "--track": "pista",
    "--status": "estado",
    "--version-name": "nombreVersion",
    "--notes": "notas",
    "--icon": "icono",
    "--feature": "cabecera",
    "--screenshots": "capturas",
  };
  const banderas = {
    "--validate": "validar",
    "--dry-run": "ensayo",
    "--send-for-review": "enviarARevision",
    "--help": "ayuda",
    "-h": "ayuda",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (banderas[arg]) {
      opciones[banderas[arg]] = true;
      continue;
    }
    if (conValor[arg]) {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith("--")) {
        throw new ErrorUso(`La opción ${arg} necesita un valor.`);
      }
      opciones[conValor[arg]] = valor;
      i++;
      continue;
    }
    throw new ErrorUso(`Opción desconocida: ${arg}. Usa --help para ver las opciones.`);
  }

  if (!PISTAS.includes(opciones.pista)) {
    throw new ErrorUso(`--track debe ser uno de: ${PISTAS.join(", ")} (recibido: ${opciones.pista}).`);
  }
  if (!ESTADOS.includes(opciones.estado)) {
    throw new ErrorUso(`--status debe ser uno de: ${ESTADOS.join(", ")} (recibido: ${opciones.estado}).`);
  }
  if (!opciones.nombreVersion) opciones.nombreVersion = versionPorDefecto();
  if (!opciones.cuentaServicio) opciones.cuentaServicio = path.join(RAIZ, "mobile", "play-service-account.json");

  return opciones;
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

function cargarCuentaServicio(ruta) {
  const absoluta = resolverRuta(ruta);
  if (!existsSync(absoluta)) {
    throw new ErrorUso(
      [
        `No encuentro el JSON de la cuenta de servicio en: ${absoluta}`,
        "",
        "Cómo se consigue:",
        "  1. Google Cloud (console.cloud.google.com) -> proyecto `clicyvoy` ->",
        "     APIs y servicios -> Biblioteca -> «Google Play Android Developer API» -> Habilitar.",
        "  2. IAM y administración -> Cuentas de servicio -> Crear cuenta de servicio",
        "     (p. ej. `play-publisher-clicyvoy`, sin roles) -> Claves -> Añadir clave ->",
        "     Crear clave nueva -> JSON. Se descarga al PC.",
        "  3. Play Console (play.google.com/console) -> Usuarios y permisos ->",
        "     Invitar usuarios nuevos -> el correo de esa cuenta de servicio ->",
        "     Permisos de la app -> ClicyVoy, con: Ver información de la app,",
        "     Editar y eliminar borradores de versiones, Publicar versiones en pistas",
        "     de prueba, Gestionar pistas de prueba y editar listas de testers, y",
        "     Editar información de la ficha de Play Store, precios y distribución.",
        "  4. Guardar el JSON como mobile/play-service-account.json (git ya lo ignora)",
        "     o pasar su ruta con --service-account.",
      ].join("\n"),
    );
  }
  let datos;
  try {
    datos = JSON.parse(readFileSync(absoluta, "utf8"));
  } catch (e) {
    throw new ErrorUso(`El JSON de la cuenta de servicio no se puede leer (${absoluta}): ${e.message}`);
  }
  if (!datos.client_email || !datos.private_key) {
    throw new ErrorUso(`El JSON de ${absoluta} no tiene client_email y private_key: ¿es una clave de cuenta de servicio?`);
  }
  return datos;
}

/**
 * Construye el JWT RS256 que Google canjea por un access_token.
 * Exportado para poder probarlo sin red.
 */
export function buildJwt(cuentaServicio, ahoraSegundos = Math.floor(Date.now() / 1000)) {
  const cabecera = { alg: "RS256", typ: "JWT" };
  const carga = {
    iss: cuentaServicio.client_email,
    scope: SCOPE,
    aud: cuentaServicio.token_uri || URL_TOKEN,
    iat: ahoraSegundos,
    exp: ahoraSegundos + 3600,
  };
  const sinFirmar = `${base64url(JSON.stringify(cabecera))}.${base64url(JSON.stringify(carga))}`;
  const firmador = createSign("RSA-SHA256");
  firmador.update(sinFirmar);
  firmador.end();
  return `${sinFirmar}.${base64url(firmador.sign(cuentaServicio.private_key))}`;
}

async function pedirToken(cuentaServicio) {
  const jwt = buildJwt(cuentaServicio);
  const cuerpo = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch(cuentaServicio.token_uri || URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: cuerpo.toString(),
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new ErrorGoogle(`No se pudo obtener el token de acceso.\n${formatearErrorGoogle(res.status, texto)}`);
  }
  const datos = JSON.parse(texto);
  if (!datos.access_token) throw new ErrorGoogle(`Google devolvió 200 pero sin access_token: ${texto}`);
  return datos.access_token;
}

// ---------------------------------------------------------------------------
// Llamadas a androidpublisher
// ---------------------------------------------------------------------------

function formatearErrorGoogle(estado, texto) {
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    // Respuesta no JSON: se enseña tal cual.
  }
  if (datos?.error) {
    const e = datos.error;
    const lineas = [`HTTP ${estado} — código ${e.code ?? estado}: ${e.message ?? "(sin mensaje)"}`];
    if (e.status) lineas.push(`  estado: ${e.status}`);
    for (const detalle of e.errors || []) {
      const partes = [
        detalle.reason ? `motivo=${detalle.reason}` : null,
        detalle.domain ? `dominio=${detalle.domain}` : null,
        detalle.location ? `ubicación=${detalle.location}` : null,
      ].filter(Boolean);
      lineas.push(`  - ${detalle.message ?? ""}${partes.length ? ` [${partes.join(" ")}]` : ""}`);
    }
    for (const detalle of e.details || []) lineas.push(`  - ${JSON.stringify(detalle)}`);
    return lineas.join("\n");
  }
  return `HTTP ${estado} — ${texto || "(cuerpo vacío)"}`;
}

/** Llamada JSON a androidpublisher. Lanza ErrorGoogle con el error completo. */
async function api(ctx, metodo, ruta, cuerpo) {
  const url = `${BASE}/${encodeURIComponent(ctx.paquete)}${ruta}`;
  const cabeceras = { Authorization: `Bearer ${ctx.token}` };
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  if (!res.ok) throw new ErrorGoogle(`${metodo} ${ruta}\n${formatearErrorGoogle(res.status, texto)}`);
  return texto ? JSON.parse(texto) : {};
}

/** Subida binaria (uploadType=media) a androidpublisher. */
async function subir(ctx, ruta, bytes, tipoContenido) {
  const url = `${BASE_UPLOAD}/${encodeURIComponent(ctx.paquete)}${ruta}?uploadType=media`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      "Content-Type": tipoContenido,
      "Content-Length": String(bytes.length),
    },
    body: bytes,
  });
  const texto = await res.text();
  if (!res.ok) throw new ErrorGoogle(`POST (upload) ${ruta}\n${formatearErrorGoogle(res.status, texto)}`);
  return texto ? JSON.parse(texto) : {};
}

// ---------------------------------------------------------------------------
// Modos
// ---------------------------------------------------------------------------

async function modoValidar(ctx) {
  const edit = await api(ctx, "POST", "/edits", {});
  ok(`Edit abierto: ${edit.id} (caduca ${edit.expiryTimeSeconds ?? "?"})`);
  try {
    const pistas = await api(ctx, "GET", `/edits/${edit.id}/tracks`);
    const lista = pistas.tracks || [];
    if (lista.length === 0) {
      aviso("La app no tiene ninguna pista con versiones todavía (normal en una app nunca publicada).");
    }
    for (const pista of lista) {
      const versiones = (pista.releases || [])
        .map((r) => `${r.name ?? "(sin nombre)"} [${r.status}] codes=${(r.versionCodes || []).join(",") || "-"}`)
        .join(" · ");
      ok(`Pista ${pista.track}: ${versiones || "sin versiones"}`);
    }
  } finally {
    await api(ctx, "DELETE", `/edits/${edit.id}`);
    ok(`Edit ${edit.id} descartado: no se ha cambiado nada.`);
  }
  console.log("\nResumen: credenciales y permisos correctos; ningún cambio en Play.");
}

function modoEnsayo(opciones, plan) {
  console.log("Ensayo (--dry-run): no se hace ninguna llamada de red.\n");

  const cuenta = resolverRuta(opciones.cuentaServicio);
  if (existsSync(cuenta)) ok(`Cuenta de servicio: ${cuenta}`);
  else aviso(`Cuenta de servicio ausente (${cuenta}): hará falta para la subida real.`);

  ok(`Paquete ${opciones.paquete} · idioma ${opciones.idioma}`);

  if (plan.aab) {
    ok(`AAB: ${plan.aab} (${mb(plan.tamAab)})`);
    ok(`Versión "${opciones.nombreVersion}" en pista ${opciones.pista} con estado ${opciones.estado}`);
    ok(`Notas (${plan.notas.texto.length} caracteres) de ${plan.notas.origen}`);
    console.log(`  «${plan.notas.texto.slice(0, 80)}»`);
  }
  if (plan.icono) ok(`Icono: ${plan.detalleIcono}`);
  if (plan.cabecera) ok(`Gráfico de cabecera: ${plan.detalleCabecera}`);
  if (plan.capturas) {
    if (plan.capturas.length === 0) {
      aviso(`Directorio de capturas vacío (${plan.dirCapturas}): no se tocarían las capturas de Play.`);
    } else {
      ok(`Capturas (${plan.capturas.length}):`);
      for (const detalle of plan.detalleCapturas) console.log(`    - ${detalle}`);
    }
  }

  console.log("\nPlan de llamadas:");
  let n = 0;
  const paso = (t) => console.log(`  ${++n}. ${t}`);
  paso(`POST /edits  (abrir edición sobre ${opciones.paquete})`);
  if (plan.aab) {
    paso(`POST (upload) /edits/{id}/bundles?uploadType=media  — ${mb(plan.tamAab)} application/octet-stream`);
    paso(
      `PUT /edits/{id}/tracks/${opciones.pista}  — release "${opciones.nombreVersion}", status ${opciones.estado}, ` +
        `versionCodes [el que devuelva el bundle], releaseNotes ${opciones.idioma}`,
    );
  }
  if (plan.icono) {
    paso(`DELETE /edits/{id}/listings/${opciones.idioma}/icon  (borra los iconos anteriores)`);
    paso(`POST (upload) /edits/{id}/listings/${opciones.idioma}/icon?uploadType=media`);
  }
  if (plan.cabecera) {
    paso(`DELETE /edits/{id}/listings/${opciones.idioma}/featureGraphic`);
    paso(`POST (upload) /edits/{id}/listings/${opciones.idioma}/featureGraphic?uploadType=media`);
  }
  if (plan.capturas && plan.capturas.length > 0) {
    paso(`DELETE /edits/{id}/listings/${opciones.idioma}/phoneScreenshots`);
    paso(`POST (upload) /edits/{id}/listings/${opciones.idioma}/phoneScreenshots?uploadType=media  x${plan.capturas.length}`);
  }
  paso(
    `POST /edits/{id}:commit${opciones.enviarARevision ? "" : "?changesNotSentForReview=true"}` +
      `  (${opciones.enviarARevision ? "ENVÍA a revisión" : "sin enviar a revisión"})`,
  );

  console.log(
    "\nNada de esto se ha ejecutado. En una app nunca publicada la versión queda como borrador:\n" +
      "el «Iniciar lanzamiento» se pulsa en Play Console.",
  );
}

async function modoSubida(ctx, opciones, plan) {
  const edit = await api(ctx, "POST", "/edits", {});
  ok(`Edit abierto: ${edit.id}`);
  const hechos = [];

  try {
    let versionCode = null;

    if (plan.aab) {
      const bytes = readFileSync(plan.aab);
      const bundle = await subir(ctx, `/edits/${edit.id}/bundles`, bytes, "application/octet-stream");
      versionCode = bundle.versionCode;
      ok(`Bundle subido: versionCode ${versionCode} (${mb(bytes.length)})`);
      hechos.push(`bundle versionCode ${versionCode}`);

      await api(ctx, "PUT", `/edits/${edit.id}/tracks/${opciones.pista}`, {
        track: opciones.pista,
        releases: [
          {
            name: opciones.nombreVersion,
            versionCodes: [String(versionCode)],
            status: opciones.estado,
            releaseNotes: [{ language: opciones.idioma, text: plan.notas.texto }],
          },
        ],
      });
      ok(`Pista ${opciones.pista}: versión "${opciones.nombreVersion}" (${versionCode}) como ${opciones.estado}`);
      hechos.push(`pista ${opciones.pista} con "${opciones.nombreVersion}" (${versionCode}) en ${opciones.estado}`);
    }

    if (plan.icono) {
      await api(ctx, "DELETE", `/edits/${edit.id}/listings/${opciones.idioma}/icon`);
      await subir(
        ctx,
        `/edits/${edit.id}/listings/${opciones.idioma}/icon`,
        readFileSync(plan.icono),
        tipoContenidoImagen(plan.icono),
      );
      ok(`Icono subido: ${plan.detalleIcono}`);
      hechos.push("icono");
    }

    if (plan.cabecera) {
      await api(ctx, "DELETE", `/edits/${edit.id}/listings/${opciones.idioma}/featureGraphic`);
      await subir(
        ctx,
        `/edits/${edit.id}/listings/${opciones.idioma}/featureGraphic`,
        readFileSync(plan.cabecera),
        tipoContenidoImagen(plan.cabecera),
      );
      ok(`Gráfico de cabecera subido: ${plan.detalleCabecera}`);
      hechos.push("gráfico de cabecera");
    }

    if (plan.capturas && plan.capturas.length > 0) {
      await api(ctx, "DELETE", `/edits/${edit.id}/listings/${opciones.idioma}/phoneScreenshots`);
      for (const captura of plan.capturas) {
        await subir(
          ctx,
          `/edits/${edit.id}/listings/${opciones.idioma}/phoneScreenshots`,
          readFileSync(captura),
          tipoContenidoImagen(captura),
        );
        ok(`Captura subida: ${path.basename(captura)}`);
      }
      hechos.push(`${plan.capturas.length} capturas`);
    } else if (plan.capturas) {
      aviso(`Directorio de capturas vacío (${plan.dirCapturas}): no se han tocado las capturas de Play.`);
    }

    const sufijo = opciones.enviarARevision ? "" : "?changesNotSentForReview=true";
    const confirmado = await api(ctx, "POST", `/edits/${edit.id}:commit${sufijo}`, undefined);
    ok(
      `Edit ${confirmado.id ?? edit.id} confirmado ` +
        `(${opciones.enviarARevision ? "ENVIADO a revisión" : "sin enviar a revisión"}).`,
    );

    console.log(`\nResumen: ${hechos.join("; ") || "nada que subir"}.`);
    if (plan.aab) {
      console.log(
        `La versión "${opciones.nombreVersion}" (${versionCode}) queda en la pista ${opciones.pista} como ` +
          `${opciones.estado}. En Play Console: Pruebas internas -> Revisar versión -> Iniciar lanzamiento.`,
      );
    }
    return 0;
  } catch (e) {
    mal(e.message);
    try {
      await api(ctx, "DELETE", `/edits/${edit.id}`);
      aviso(`Edit ${edit.id} descartado: no queda nada a medias en Play.`);
    } catch (e2) {
      mal(`Además, no se pudo descartar el edit ${edit.id}: ${e2.message}`);
    }
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

/** Valida ficheros y prepara lo que se va a subir. No toca la red. */
function prepararPlan(opciones) {
  const plan = { aab: null, tamAab: 0, notas: null, icono: null, cabecera: null, capturas: null, dirCapturas: null };

  if (opciones.aab) {
    plan.aab = resolverRuta(opciones.aab);
    if (!existsSync(plan.aab)) throw new ErrorUso(`No existe el AAB: ${plan.aab}`);
    const info = statSync(plan.aab);
    if (!info.isFile() || info.size === 0) throw new ErrorUso(`El AAB no es un fichero con contenido: ${plan.aab}`);
    if (path.extname(plan.aab).toLowerCase() !== ".aab") {
      throw new ErrorUso(`Play solo acepta un bundle .aab (recibido: ${path.basename(plan.aab)}).`);
    }
    plan.tamAab = info.size;
    plan.notas = leerNotas(opciones);
  }

  if (opciones.icono) {
    plan.icono = resolverRuta(opciones.icono);
    plan.detalleIcono = validarImagen(plan.icono, "icono");
  }
  if (opciones.cabecera) {
    plan.cabecera = resolverRuta(opciones.cabecera);
    plan.detalleCabecera = validarImagen(plan.cabecera, "cabecera");
  }
  if (opciones.capturas) {
    plan.dirCapturas = resolverRuta(opciones.capturas);
    plan.capturas = listarCapturas(plan.dirCapturas);
    plan.detalleCapturas = plan.capturas.map((c) => validarImagen(c, "captura"));
  }

  return plan;
}

async function main(argv) {
  let opciones;
  try {
    opciones = parsearArgumentos(argv);
  } catch (e) {
    mal(e.message);
    return 1;
  }

  if (opciones.ayuda) {
    console.log(AYUDA);
    return 0;
  }

  const hayTrabajo = Boolean(opciones.aab || opciones.icono || opciones.cabecera || opciones.capturas);
  if (!hayTrabajo && !opciones.validar) {
    mal("No hay nada que hacer: pasa --aab, --icon, --feature, --screenshots o --validate. Usa --help.");
    return 1;
  }
  if (opciones.estado === "completed") {
    aviso("--status completed: en una app nunca publicada Google lo rechaza; ahí solo vale draft.");
  }
  if (opciones.enviarARevision) {
    aviso("--send-for-review: el commit ENVIARÁ los cambios a revisión de Google.");
  }

  try {
    const plan = opciones.validar && !hayTrabajo ? null : prepararPlan(opciones);

    if (opciones.ensayo) {
      modoEnsayo(opciones, plan ?? {});
      return 0;
    }

    const cuentaServicio = cargarCuentaServicio(opciones.cuentaServicio);
    const token = await pedirToken(cuentaServicio);
    ok(`Token obtenido para ${cuentaServicio.client_email}`);
    const ctx = { token, paquete: opciones.paquete };

    if (opciones.validar) {
      await modoValidar(ctx);
      return 0;
    }
    return await modoSubida(ctx, opciones, plan);
  } catch (e) {
    if (e instanceof ErrorUso || e instanceof ErrorGoogle) {
      mal(e.message);
      return 1;
    }
    throw e;
  }
}

// El `main` solo corre si el script se ejecuta directamente: así las pruebas
// pueden importar `buildJwt` sin lanzar nada.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
