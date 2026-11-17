// ============================================================
// Prueba de la migración 0030_aviso_chat_unico_y_servicios_conductor.sql sin
// Postgres, con PGlite (Postgres en WebAssembly, en memoria).
//
// Monta un esquema MÍNIMO con las columnas que la migración toca (profiles,
// driver_profiles, transport_requests, chat_messages), aplica el fichero 0030
// REAL sin tocarlo y comprueba:
//   - que se puede aplicar dos veces sin error;
//   - la «reclamación» atómica que hace send-push sobre chat_messages:
//     UPDATE ... WHERE push_sent_at IS NULL solo marca el mensaje una vez.
//
// Cómo ejecutarlo: igual que partners.test.mjs (PGLITE_DIR=<carpeta con
// @electric-sql/pglite> node supabase/tests/aviso-chat-y-servicios.test.mjs).
// ============================================================

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIG_0030 = path.join(here, '..', 'migrations', '0030_aviso_chat_unico_y_servicios_conductor.sql');

async function loadPGlite() {
  try {
    return (await import('@electric-sql/pglite')).PGlite;
  } catch { /* se busca en PGLITE_DIR o en la carpeta actual */ }
  for (const base of [process.env.PGLITE_DIR, process.cwd()].filter(Boolean)) {
    try {
      const req = createRequire(path.join(path.resolve(base), 'noop.js'));
      const resolved = req.resolve('@electric-sql/pglite');
      const esm = resolved.replace(/index\.cjs$/, 'index.js');
      return (await import(pathToFileURL(esm).href)).PGlite;
    } catch { /* siguiente */ }
  }
  console.error('No encuentro @electric-sql/pglite (ver cabecera de partners.test.mjs).');
  process.exit(2);
}

const PGlite = await loadPGlite();
const db = new PGlite();

let ok = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    ok++;
    console.log(`OK   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
  }
}

const A = '00000000-0000-0000-0000-00000000000a'; // conductor con perfil propio
const B = '00000000-0000-0000-0000-00000000000b'; // conductor dado de alta por el admin
const C = '00000000-0000-0000-0000-00000000000c'; // conductor sin entregas
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
const CLIENT = '00000000-0000-0000-0000-0000000000c1';

await db.exec(`
  create table public.profiles (id uuid primary key, email text);
  create table public.driver_profiles (
    id uuid primary key default gen_random_uuid(),
    created_by_id uuid,
    email text,
    total_trips integer not null default 0
  );
  create table public.transport_requests (
    id uuid primary key default gen_random_uuid(),
    created_by_id uuid,
    driver_id uuid,
    status text not null
  );
  create table public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null,
    message text not null
  );

  insert into public.profiles (id, email) values
    ('${A}', 'a@x.es'), ('${B}', 'B@X.es'), ('${C}', 'c@x.es'), ('${ADMIN}', 'admin@x.es');

  -- A: perfil propio, valor viejo 0. B: perfil creado por el admin (created_by_id
  -- del admin) que solo casa por email, valor viejo 1. C: 5 a mano, sin entregas.
  insert into public.driver_profiles (created_by_id, email, total_trips) values
    ('${A}', 'a@x.es', 0), ('${ADMIN}', 'b@x.es', 1), ('${C}', 'c@x.es', 5);

  insert into public.transport_requests (created_by_id, driver_id, status) values
    ('${CLIENT}', '${A}', 'delivered'), ('${CLIENT}', '${A}', 'delivered'),
    ('${CLIENT}', '${A}', 'delivered'), ('${CLIENT}', '${A}', 'picked_up'),
    ('${CLIENT}', '${B}', 'delivered'), ('${CLIENT}', '${B}', 'delivered'),
    ('${CLIENT}', '${B}', 'cancelled'), ('${CLIENT}', null, 'pending');
`);

const sql = readFileSync(MIG_0030, 'utf8');
await db.exec(sql);

// Idempotente: segunda pasada sin error por la columna ya creada.
await db.exec(sql);

// Columna nueva y reclamación atómica, como la hace send-push.
const col = await db.query(
  `select data_type from information_schema.columns where table_name = 'chat_messages' and column_name = 'push_sent_at'`,
);
check('chat_messages.push_sent_at existe', col.rows[0]?.data_type === 'timestamp with time zone', col.rows);

const msg = (
  await db.query(`insert into public.chat_messages (request_id, message) values (gen_random_uuid(), 'hola') returning id`)
).rows[0].id;
const claim = () =>
  db.query(
    'update public.chat_messages set push_sent_at = now() where id = $1 and push_sent_at is null returning id',
    [msg],
  );
const first = await claim();
const second = await claim();
check('Primera llamada a send-push reclama el mensaje', first.rows.length === 1);
check('Segunda llamada (trigger + app) no lo reclama: no hay aviso doble', second.rows.length === 0);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
