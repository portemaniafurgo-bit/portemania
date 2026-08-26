/**
 * Comprueba que TODO lo que la app le pide a la base de datos existe de verdad.
 *
 * Es la otra clase de fallo que ya se coló: `driver_profiles.rating` se pintaba
 * en tres pantallas y esa columna nunca se creó, así que la valoración salía
 * siempre vacía y nadie se enteraba. Aquí se extraen del código todas las
 * tablas, columnas y funciones que se usan, y se contrastan con el esquema.
 *
 *   SUPABASE_PAT=... node scripts/check-db-usage.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PROJECT = "dnehzwrqphqpkcdjwqfi";
const PAT = process.env.SUPABASE_PAT;
if (!PAT) {
  console.error("Falta SUPABASE_PAT");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = ["app", "components", "lib"].flatMap(d => walk(path.join(ROOT, d)));

const rpcs = new Set();
const tableColumns = new Map(); // tabla -> Set(columnas)
const tables = new Set();

for (const file of files) {
  const code = fs.readFileSync(file, "utf8");

  for (const m of code.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/gi)) rpcs.add(m[1]);

  // .from("tabla") … .select("a, b, c")  — se empareja cada select con la
  // tabla que lo precede.
  for (const m of code.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)([\s\S]{0,900}?)(?=\.from\(|$)/gi)) {
    const table = m[1];
    tables.add(table);
    const bloque = m[2];
    for (const sel of bloque.matchAll(/\.select\(\s*["'`]([^"'`]+)["'`]/g)) {
      const cols = sel[1];
      if (cols.trim() === "*") continue;
      const set = tableColumns.get(table) || new Set();
      for (const raw of cols.split(",")) {
        const col = raw.trim().split(":")[0].split("(")[0].trim();
        // Se ignoran los joins tipo tabla(campo) y los alias con conteo
        if (col && /^[a-z0-9_]+$/i.test(col)) set.add(col);
      }
      tableColumns.set(table, set);
    }
    // Filtros y escrituras también nombran columnas
    for (const eq of bloque.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|in|is|ilike|like|order)\(\s*["'`]([a-z0-9_]+)["'`]/gi)) {
      const set = tableColumns.get(table) || new Set();
      set.add(eq[1]);
      tableColumns.set(table, set);
    }
  }
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

(async () => {
  const cols = await sql(`
    select table_name, column_name from information_schema.columns
     where table_schema = 'public'`);
  const esquema = new Map();
  for (const row of cols) {
    if (!esquema.has(row.table_name)) esquema.set(row.table_name, new Set());
    esquema.get(row.table_name).add(row.column_name);
  }

  const funcs = new Set(
    (await sql(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`))
      .map(r => r.proname),
  );

  let fallos = 0;

  for (const rpc of [...rpcs].sort()) {
    if (!funcs.has(rpc)) {
      console.log(`FUNCIÓN QUE NO EXISTE  →  ${rpc}()`);
      fallos++;
    }
  }

  for (const [table, columnas] of [...tableColumns].sort()) {
    if (!esquema.has(table)) {
      console.log(`TABLA QUE NO EXISTE  →  ${table}`);
      fallos++;
      continue;
    }
    for (const col of [...columnas].sort()) {
      if (!esquema.get(table).has(col)) {
        console.log(`COLUMNA QUE NO EXISTE  →  ${table}.${col}`);
        fallos++;
      }
    }
  }

  console.log(
    fallos
      ? `\n${fallos} problema(s): la app pide algo que la base de datos no tiene.`
      : `\nTodo cuadra: ${rpcs.size} funciones y ${tableColumns.size} tablas usadas por la app existen con todas sus columnas.`,
  );
  process.exit(fallos ? 1 : 0);
})();
