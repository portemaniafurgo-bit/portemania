/**
 * Despliega una Edge Function al Supabase de producción.
 *
 * GOTCHA IMPORTANTE (nos costó un BOOT_ERROR en julio de 2026): hay que usar el
 * endpoint MULTIPART `POST /v1/projects/{ref}/functions/deploy?slug=...`, que
 * genera el ESZIP. El `PATCH /v1/projects/{ref}/functions/{slug}` con el código
 * en el cuerpo lo sube crudo: el panel dice ACTIVE pero la función revienta al
 * arrancar. Verifica siempre llamándola después de desplegar.
 *
 *   SUPABASE_PAT=sbp_xxx node scripts/deploy-function.mjs send-push [--public]
 *
 * Por defecto exige JWT. `--public` solo para funciones que deban responder sin
 * sesión (como send-email, por el flujo de invitado).
 */
import { readFileSync } from "node:fs";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "dnehzwrqphqpkcdjwqfi";
const pat = process.env.SUPABASE_PAT;
const slug = process.argv[2];
const isPublic = process.argv.includes("--public");

if (!pat || !slug) {
  console.error("Uso: SUPABASE_PAT=sbp_xxx node scripts/deploy-function.mjs <slug> [--public]");
  process.exit(1);
}

const path = `supabase/functions/${slug}/index.ts`;
const source = readFileSync(path, "utf8");

const form = new FormData();
form.append(
  "metadata",
  new Blob(
    [JSON.stringify({ name: slug, entrypoint_path: "index.ts", verify_jwt: !isPublic })],
    { type: "application/json" },
  ),
);
form.append("file", new Blob([source], { type: "application/typescript" }), "index.ts");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${slug}`,
  { method: "POST", headers: { Authorization: `Bearer ${pat}` }, body: form },
);

const text = await res.text();
console.log(`${res.status} ${text.slice(0, 400)}`);
process.exit(res.ok ? 0 : 1);
