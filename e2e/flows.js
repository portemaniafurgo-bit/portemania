/* E2E de flujos cliente/invitado/conductor de PorteManía contra producción. */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "https://pontemania.vercel.app";
const SB = "https://dnehzwrqphqpkcdjwqfi.supabase.co";
const anon = fs.readFileSync(".env.local", "utf8").match(/ANON_KEY=(.+)/)[1].trim();
const results = [];
let page;

async function visible(locator, timeout = 15000) {
  try { await locator.first().waitFor({ state: "visible", timeout }); return true; } catch { return false; }
}
function ok(name, cond, note = "") {
  results.push({ name, pass: !!cond, note });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (note ? "  — " + note : ""));
}
async function shot(name) { await page.screenshot({ path: `shots/${name}.png` }); }

const H = (tok) => ({ apikey: anon, "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) });
const login = async (email, password) =>
  (await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: H(), body: JSON.stringify({ email, password }) })).json()).access_token;

// PNG 1x1 válido para el upload de foto
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

(async () => {
  fs.mkdirSync("shots", { recursive: true });

  // ===== SEED vía API: pedido entregado con chat (para verificar fixes) =====
  const ctok = await login("cliente.test@portemania.es", "Cliente2026!");
  const dtok = await login("conductor.test@portemania.es", "Conductor2026!");
  const dUid = JSON.parse(Buffer.from(dtok.split(".")[1], "base64").toString()).sub;
  let r = await fetch(SB + "/rest/v1/transport_requests", {
    method: "POST", headers: { ...H(ctok), Prefer: "return=representation" },
    body: JSON.stringify({
      client_name: "Cliente Prueba", client_phone: "600111222",
      origin_address: "Calle Ancha 2, 02001 Albacete", destination_address: "Calle Mayor 5, 02002 Albacete",
      cargo_description: "SEED FLOWS entrega con chat", cargo_photos: [], vehicle_type: "small",
      estimated_price: 50, payment_method: "cash", status: "pending", payment_status: "pending",
    }),
  });
  const seed = (await r.json())[0];
  await fetch(SB + `/rest/v1/transport_requests?id=eq.${seed.id}`, {
    method: "PATCH", headers: H(dtok),
    body: JSON.stringify({ status: "accepted", driver_id: dUid, driver_name: "Conductor Prueba", accepted_at: new Date().toISOString() }),
  });
  await fetch(SB + "/rest/v1/chat_messages", {
    method: "POST", headers: H(dtok),
    body: JSON.stringify({ request_id: seed.id, sender_id: dUid, sender_name: "Conductor Prueba", sender_role: "driver", message: "Mensaje de prueba del conductor" }),
  });
  await fetch(SB + `/rest/v1/transport_requests?id=eq.${seed.id}`, {
    method: "PATCH", headers: H(dtok),
    body: JSON.stringify({ status: "delivered", pickup_time: new Date().toISOString(), delivery_time: new Date().toISOString() }),
  });
  console.log("seed entregado:", seed.id);
  // Pedido activo (aceptado) para verificar el tracking del cliente
  r = await fetch(SB + "/rest/v1/transport_requests", {
    method: "POST", headers: { ...H(ctok), Prefer: "return=representation" },
    body: JSON.stringify({
      client_name: "Cliente Prueba", client_phone: "600111222",
      origin_address: "Calle Ancha 2, 02001 Albacete", destination_address: "Calle Mayor 5, 02002 Albacete",
      cargo_description: "SEED FLOWS activo tracking", cargo_photos: [], vehicle_type: "small",
      estimated_price: 40, payment_method: "cash", status: "pending", payment_status: "pending",
    }),
  });
  const seedActive = (await r.json())[0];
  await fetch(SB + "/rest/v1/transport_requests?id=eq." + seedActive.id, {
    method: "PATCH", headers: H(dtok),
    body: JSON.stringify({ status: "accepted", driver_id: dUid, driver_name: "Conductor Prueba", accepted_at: new Date().toISOString() }),
  });
  console.log("seed activo:", seedActive.id);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-ES", geolocation: { latitude: 38.9943, longitude: -1.8585 }, permissions: ["geolocation"] });
  page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });

  // ===== 1. Invitado: /solicitar completo =====
  await page.goto(BASE + "/solicitar", { waitUntil: "networkidle" });
  await page.fill('input[placeholder*="nombre y apellidos"]', "INVITADO E2E");
  await page.fill('input[type="tel"]', "600333444");
  // CP obligatorio: sin CP el botón sigue deshabilitado
  await page.fill('input[placeholder*="Calle, número, piso"] >> nth=0', "Calle Ancha 2");
  await page.fill('input[placeholder*="Calle, número, piso"] >> nth=1', "Calle Mayor 5, 02002 Albacete");
  ok("1a aviso CP obligatorio", await visible(page.locator("text=El código postal es obligatorio"), 5000));
  ok("1b continuar deshabilitado sin CP", await page.locator("button:has-text('Continuar')").isDisabled());
  await page.fill('input[placeholder*="Calle, número, piso"] >> nth=0', "Calle Ancha 2, 02001 Albacete");
  await page.waitForTimeout(300);
  ok("1c continuar habilitado con CP", await page.locator("button:has-text('Continuar')").isEnabled());
  await page.click("button:has-text('Continuar')");
  // Paso 2
  await page.fill("textarea >> nth=0", "INVITADO E2E mudanza de cajas de prueba");
  await page.setInputFiles('input[type="file"]', { name: "foto.png", mimeType: "image/png", buffer: PNG });
  ok("1d foto subida", await visible(page.locator("img[alt='cargo']"), 20000));
  // ayuda
  await page.locator("button[role='switch']").first().click();
  await page.fill("textarea >> nth=1", "Bajar cajas de un 2º, hay ascensor");
  // Con ayuda activada, el checkbox de pie de calle desaparece (feature 2026-07-04)
  ok("1e-pre checkbox pie de calle oculto con ayuda", !(await page.locator("button:has-text('Acepto que la mercancía')").isVisible().catch(() => false)));
  ok("1e-pre2 aviso conductor ayuda visible", await visible(page.locator("text=sube/baja la mercancía contigo"), 5000));
  await page.locator("button:has-text('Acepto los')").click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(300);
  ok("1e continuar habilitado paso 2", await page.locator("button:has-text('Continuar')").isEnabled());
  await page.click("button:has-text('Continuar')");
  // Paso 3: vehículo
  await page.click("text=Furgoneta pequeña");
  await page.waitForTimeout(300);
  await page.click("button:has-text('Continuar')");
  // Paso 4: confirmar
  ok("1f resumen con precio", await visible(page.locator("text=Precio estimado"), 10000));
  ok("1f2 suplemento de ayuda en el desglose", await visible(page.locator("text=Ayuda del conductor:"), 5000));
  await page.click("button:has-text('Confirmar solicitud')");
  ok("1g solicitud enviada", await visible(page.locator("text=/Solicitud enviada|solicitud-enviada/i").or(page.locator("text=¡Solicitud enviada!")), 25000) || page.url().includes("solicitud-enviada"));
  await shot("10-invitado-enviado");

  // ===== 2. Conductor: ve el pendiente con ayuda y acepta =====
  await page.goto(BASE + "/login-conductores", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "conductor.test@portemania.es");
  await page.fill('input[type="password"]', "Conductor2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/driver/, { timeout: 30000 }).catch(() => {});
  await page.goto(BASE + "/driver/requests", { waitUntil: "networkidle" });
  const reqCard = page.locator("div.bg-card", { hasText: "INVITADO E2E" }).first();
  ok("2a conductor ve el pendiente", await visible(reqCard, 20000));
  ok("2b recuadro ámbar de ayuda", await visible(reqCard.locator("text=Pide ayuda del conductor"), 5000));
  await page.waitForTimeout(1000);
  await reqCard.locator("button:has-text('Aceptar servicio')").click();
  ok("2c acepta y va al trabajo", await page.waitForURL(/driver\/job/, { timeout: 20000 }).then(() => true).catch(() => false));
  ok("2d ayuda visible en trabajo activo", await visible(page.locator("text=El cliente pide ayuda"), 10000));
  // Sistema de rutas del conductor (estilo Uber)
  ok("2e mapa con ruta hacia destino", await visible(page.locator("text=Tu ruta hacia"), 25000));
  ok("2f botón Google Maps", await visible(page.locator("a[href*='google.com/maps']"), 8000));
  ok("2g botón Waze", await visible(page.locator("a[href*='waze.com']"), 5000));
  ok("2h ETA del conductor con hora", await visible(page.locator("text=/Llegas a la recogida en ~/"), 30000));
  ok("2i ruta dibujada en el mapa", await visible(page.locator("path.leaflet-interactive"), 15000));
  await shot("11b-conductor-ruta");
  await shot("11-conductor-job");
  // cerrar sesión del conductor
  await page.click("text=Cerrar sesión").catch(() => {});
  await page.waitForTimeout(2000);

  // ===== 3. Cliente: pedido entregado muestra chat-historial + nombre completo =====
  await page.goto(BASE + "/login-clientes", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "cliente.test@portemania.es");
  await page.fill('input[type="password"]', "Cliente2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {});
  await page.goto(BASE + "/order/" + seed.id, { waitUntil: "networkidle" });
  ok("3a detalle entregado carga", await visible(page.locator("text=Entregado"), 25000));
  ok("3b chat historial visible tras entrega", await visible(page.locator("text=Mensaje de prueba del conductor"), 10000));
  ok("3c etiqueta Historial", await visible(page.locator("text=Historial"), 5000));
  ok("3d input de chat oculto", !(await page.locator("input[placeholder='Escribe un mensaje...']").isVisible().catch(() => false)));
  ok("3e nombre completo del conductor", await visible(page.locator("text=Conductor Prueba"), 5000));
  ok("3f puede valorar", await visible(page.locator("text=/Valora|valoración/i"), 5000));
  await shot("12-cliente-entregado");
  // Tracking en vivo del pedido ACTIVO (ETA + hora + ruta)
  await page.goto(BASE + "/order/" + seedActive.id, { waitUntil: "networkidle" });
  ok("3g ETA visible para el cliente", await visible(page.locator("text=/Llega a la recogida en ~/"), 30000));
  ok("3h hora estimada de llegada", await visible(page.locator("text=/\\d{1,2}:\\d{2}/"), 8000));
  ok("3i ruta dibujada en el mapa del cliente", await visible(page.locator("path.leaflet-interactive"), 15000));
  await shot("13-cliente-tracking");

  // ===== 4. Consola =====
  ok("4 sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();

  // ===== LIMPIEZA vía API (admin) =====
  const atok = await login("renato.0550.calero@gmail.com", "PorteMania2026!");
  await fetch(SB + "/rest/v1/transport_requests?cargo_description=like.SEED%20FLOWS*", { method: "DELETE", headers: H(atok) });
  await fetch(SB + "/rest/v1/driver_profiles?email=eq.conductor.test@portemania.es", { method: "PATCH", headers: H(atok), body: JSON.stringify({ current_lat: 39.0, current_lng: -1.86 }) });
  await fetch(SB + "/rest/v1/transport_requests?client_name=eq.INVITADO%20E2E", { method: "DELETE", headers: H(atok) });
  await fetch(SB + "/rest/v1/driver_profiles?email=eq.conductor.test@portemania.es", { method: "PATCH", headers: H(atok), body: JSON.stringify({ average_rating: 5, total_trips: 0 }) });
  console.log("limpieza hecha");

  const fails = results.filter((r) => !r.pass);
  console.log(`\n==== ${results.length - fails.length}/${results.length} PASS ====`);
  if (fails.length) { console.log("FALLOS:"); fails.forEach((f) => console.log(" -", f.name, f.note)); process.exit(1); }
})().catch((e) => { console.error("ERROR FATAL:", e.message); process.exit(2); });
