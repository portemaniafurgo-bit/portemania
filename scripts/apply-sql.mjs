/**
 * Aplica un fichero SQL al Supabase de producción por la Management API.
 *
 * El proyecto `dnehzwrqphqpkcdjwqfi` (cuenta del negocio portemaniafurgo) NO es
 * visible desde el MCP de Supabase por defecto, así que las migraciones se
 * aplican por REST con el PAT del negocio.
 *
 *   SUPABASE_PAT=sbp_xxx node scripts/apply-sql.mjs supabase/migrations/0011_app_android_base.sql
 *
 * Escribe en PRODUCCIÓN. Antes de ejecutarlo, lee la migración entera.
 */
import { readFileSync } from "node:fs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "dnehzwrqphqpkcdjwqfi";
const pat = process.env.SUPABASE_PAT;
const file = process.argv[2];

if (!pat) {
  console.error("Falta SUPABASE_PAT (Access Token de la cuenta del negocio).");
  process.exit(1);
}
if (!file) {
  console.error("Uso: node scripts/apply-sql.mjs <fichero.sql>");
  process.exit(1);
}

const query = readFileSync(file, "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});

const text = await res.text();
console.log(`${res.status} ${text}`);
// Salir con error si la API lo rechazó: así el fallo no pasa desapercibido en
// un encadenado de comandos.
process.exit(res.ok ? 0 : 1);
