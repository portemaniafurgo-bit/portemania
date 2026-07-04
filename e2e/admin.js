/* E2E del panel de administración de PorteManía contra producción.
   Uso: node e2e-admin.js  →  imprime PASS/FAIL por paso y guarda capturas en ./shots */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "https://pontemania.vercel.app";
const SB = "https://dnehzwrqphqpkcdjwqfi.supabase.co";
const anon = fs.readFileSync(".env.local", "utf8").match(/ANON_KEY=(.+)/)[1].trim();
const ADMIN = { email: "renato.0550.calero@gmail.com", pass: "PorteMania2026!" };
const results = [];
let page;

const H = (tok) => ({ apikey: anon, "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) });
const apiLogin = async (email, password) =>
  (await (await fetch(SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: H(), body: JSON.stringify({ email, password }) })).json()).access_token;

// Siembra un pedido aceptado+pagado con petición de ayuda (para el detalle)
async function seedOrder() {
  const dtok = await apiLogin("conductor.test@portemania.es", "Conductor2026!");
  const dUid = JSON.parse(Buffer.from(dtok.split(".")[1], "base64").toString()).sub;
  const r = await fetch(SB + "/rest/v1/rpc/create_guest_request", {
    method: "POST", headers: H(),
    body: JSON.stringify({ payload: {
      client_name: "PRUEBA ADMIN", client_phone: "600999888",
      origin_address: "Calle Ancha 2, 02001 Albacete", destination_address: "Calle Mayor 5, 02002 Albacete",
      cargo_description: "PRUEBA ADMIN caja grande", vehicle_type: "small", estimated_price: 40,
      needs_help: true, help_description: "Subir caja a un 2º sin ascensor", force: true,
    } }),
  });
  const order = await r.json();
  await fetch(SB + `/rest/v1/transport_requests?id=eq.${order.id}`, {
    method: "PATCH", headers: H(dtok),
    body: JSON.stringify({ status: "accepted", driver_id: dUid, driver_name: "Conductor Prueba", accepted_at: new Date().toISOString() }),
  });
  const atok = await apiLogin(ADMIN.email, ADMIN.pass);
  await fetch(SB + `/rest/v1/transport_requests?id=eq.${order.id}`, {
    method: "PATCH", headers: H(atok), body: JSON.stringify({ payment_status: "paid" }),
  });
  return order.id;
}

async function cleanup() {
  const atok = await apiLogin(ADMIN.email, ADMIN.pass);
  await fetch(SB + "/rest/v1/transport_requests?client_name=eq.PRUEBA%20ADMIN", { method: "DELETE", headers: H(atok) });
}

// isVisible() NO espera en Playwright; este helper sí.
async function visible(locator, timeout = 15000) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
}

function ok(name, cond, note = "") {
  results.push({ name, pass: !!cond, note });
  console.log((cond ? "PASS" : "FAIL") + "  " + name + (note ? "  — " + note : ""));
}

async function shot(name) {
  await page.screenshot({ path: `shots/${name}.png`, fullPage: false });
}

(async () => {
  fs.mkdirSync("shots", { recursive: true });
  const seedId = await seedOrder();
  console.log("seed pedido admin:", seedId);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "es-ES",
    geolocation: { latitude: 38.9943, longitude: -1.8585 },
    permissions: ["geolocation"],
  });
  page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });

  // ---------- 1. Landing ----------
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  ok("1a landing carga", await visible(page.locator("text=Quiero ser conductor")));
  ok("1b sección mapa presente", await visible(page.locator("text=Conductores en tu zona")));
  await page.locator("text=Conductores en tu zona").scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000);
  const badge = await page.locator("text=/conductor(es)? disponible/").first().textContent().catch(() => "");
  ok("1c contador de conductores", /\d+ conductor/.test(badge || ""), badge?.trim());
  await shot("01-landing-mapa");

  // ---------- 2. Login admin ----------
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|admin/, { timeout: 30000 }).catch(() => {});
  await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  ok("2a dashboard Operación carga", await visible(page.locator("h1:has-text('Operación')"), 25000));
  await shot("02-admin-dashboard");

  // ---------- 3. Menú lateral completo ----------
  const menuItems = ["Operación", "Pedidos", "Conductores", "Usuarios", "Incidencias", "Ajustes"];
  const missing = [];
  for (const item of menuItems) {
    if (!(await visible(page.locator(`a:has-text("${item}")`), 5000))) missing.push(item);
  }
  ok("3 menú admin completo", missing.length === 0, missing.length ? "faltan: " + missing.join(",") : "6 secciones");

  // ---------- 4. KPIs ----------
  for (const kpi of ["Pedidos hoy", "Sin aceptar", "Conductores disponibles", "Facturado este mes", "Comisión plataforma", "Valoración media"]) {
    ok("4 KPI " + kpi, await visible(page.locator(`text=${kpi}`), 10000));
  }
  ok("4g mapa flota", await visible(page.locator("text=/conductor(es)? con posición/"), 20000));

  // ---------- 5. Pedidos ----------
  await page.goto(BASE + "/admin/orders", { waitUntil: "networkidle" });
  ok("5a tabla pedidos carga", await visible(page.locator("thead >> text=Cliente"), 20000));
  await shot("05-admin-orders");
  const row = page.locator("tbody tr", { hasText: "PRUEBA ADMIN" }).first();
  const hasRow = await visible(row, 10000);
  ok("5b pedido PRUEBA ADMIN visible", hasRow);
  if (hasRow) {
    await page.waitForTimeout(1200); // hidratación
    await row.click();
    await page.waitForURL(/admin\/orders\/[0-9a-f-]+/, { timeout: 10000 }).catch(() => {});
    ok("5c detalle del pedido abre", await visible(page.locator("text=Cronología"), 25000));
    ok("5d cronología con aceptado", await visible(page.locator("text=/Aceptado por/"), 8000));
    ok("5e recuadro ayuda", await visible(page.locator("text=Pidió ayuda del conductor"), 8000));
    ok("5f pago pagado", await visible(page.locator("text=Pagado"), 8000));
    await shot("05c-order-detail");
  }

  // ---------- 6. Conductores ----------
  await page.goto(BASE + "/admin/drivers", { waitUntil: "networkidle" });
  ok("6a página conductores", await visible(page.locator("h1:has-text('Conductores')"), 20000));
  const card = page.locator("div.bg-card", { hasText: "Conductor Prueba" }).first();
  await card.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  await card.locator("button").last().click().catch(() => {});
  ok("6b ficha expandida", await visible(page.locator("text=Documentación"), 8000));
  const delBtn = page.locator("button:has-text('Eliminar')").first();
  if (await visible(delBtn, 5000)) {
    await delBtn.click();
    ok("6c confirmación 2 clics eliminar", await visible(page.locator("text=¿Seguro? Pulsa otra vez"), 4000), "sin confirm() nativo");
    await page.waitForTimeout(4500); // dejar expirar sin confirmar
  }
  await shot("06-admin-drivers");

  // ---------- 7. Ajustes ----------
  await page.goto(BASE + "/admin/settings", { waitUntil: "networkidle" });
  const smallInput = page.locator("div:has(> label:has-text('pequeña')) input").first();
  const inputVisible = await visible(smallInput, 20000);
  ok("7a tarifas cargan", inputVisible);
  if (inputVisible) {
    const val = await smallInput.inputValue();
    ok("7b pequeña = 40", val === "40", "valor: " + val);
  }
  await shot("07-admin-settings");

  // ---------- 8. Usuarios / Incidencias ----------
  await page.goto(BASE + "/admin/users", { waitUntil: "networkidle" });
  ok("8a usuarios carga", await visible(page.locator("text=/Email|Rol|usuario/i"), 20000));
  await page.goto(BASE + "/admin/incidents", { waitUntil: "networkidle" });
  ok("8b incidencias carga", await visible(page.locator("text=/incidencia/i"), 20000));
  await page.goto(BASE + "/admin/finance", { waitUntil: "networkidle" });
  ok("8c finanzas carga", await visible(page.locator("h1:has-text('Finanzas')"), 20000));
  ok("8d liquidaciones con neto", await visible(page.locator("text=Neto a liquidar"), 10000));
  await page.goto(BASE + "/admin/stats", { waitUntil: "networkidle" });
  ok("8e estadísticas cargan", await visible(page.locator("text=Horas punta"), 20000));
  ok("8f menú con Finanzas y Estadísticas", (await visible(page.locator("a:has-text('Finanzas')"), 5000)) && (await visible(page.locator("a:has-text('Estadísticas')"), 5000)));

  // ---------- 9. Consola ----------
  ok("9 sin errores de consola", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await browser.close();
  await cleanup();
  console.log("limpieza hecha");
  const fails = results.filter(r => !r.pass);
  console.log(`\n==== ${results.length - fails.length}/${results.length} PASS ====`);
  if (fails.length) { console.log("FALLOS:"); fails.forEach(f => console.log(" -", f.name, f.note)); process.exit(1); }
})().catch(e => { console.error("ERROR FATAL:", e.message); process.exit(2); });
