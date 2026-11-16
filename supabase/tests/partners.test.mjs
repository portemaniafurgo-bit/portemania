// ============================================================
// Prueba de las migraciones 0029_proteger_campos_pedido.sql y 0028_partners.sql
// (ClicyVoy Partners) sin Postgres.
//
// Usa PGlite (Postgres compilado a WebAssembly, en memoria). Monta un esquema
// MÍNIMO que imita lo de Supabase que las migraciones necesitan: roles anon /
// authenticated / service_role, auth.users, auth.uid(), profiles,
// driver_profiles, app_settings, is_admin(), is_staff(), los permisos por
// defecto de Supabase y, en transport_requests, la RLS REAL (select de la 0001,
// update de la 0003) y los triggers REALES que importan aquí
// (protect_order_payment_fields y zz_stamp_delivered_at de la 0027,
// stamp_final_price de la 0010), copiados en este fichero. Después aplica los
// ficheros 0029 y 0028 REALES sin tocarlos y recorre los escenarios como
// distintos usuarios (set local role + claims del JWT).
//
// Cómo ejecutarlo (no hace falta instalar nada en el repo):
//   1. En una carpeta cualquiera:   npm i --no-save @electric-sql/pglite
//   2. Desde ESA carpeta:           node <repo>/supabase/tests/partners.test.mjs
//      o desde donde sea (bash):    PGLITE_DIR=<esa carpeta> node supabase/tests/partners.test.mjs
//      (PowerShell):                $env:PGLITE_DIR = '<esa carpeta>'; node supabase/tests/partners.test.mjs
// Imprime una línea por comprobación y al final "N OK, M FAIL" (sale con
// código 1 si hay algún FAIL).
// ============================================================

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIG_0029 = path.join(here, '..', 'migrations', '0029_proteger_campos_pedido.sql');
const MIG_0028 = path.join(here, '..', 'migrations', '0028_partners.sql');

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
  console.error('No encuentro @electric-sql/pglite. Instálalo en una carpeta (npm i --no-save @electric-sql/pglite) y ejecuta desde ahí o con PGLITE_DIR=<carpeta>.');
  process.exit(2);
}

const PGlite = await loadPGlite();
const db = new PGlite();

// ---------- utilidades ----------
let ok = 0;
let fail = 0;
const notices = [];
const onNotice = (n) => notices.push(n);

function check(name, cond, extra) {
  if (cond) {
    ok++;
    console.log(`OK   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
  }
}

const warnings = () => notices.filter((n) => n.severity === 'WARNING');
let warnMark = 0;
const markWarnings = () => { warnMark = warnings().length; };
const newWarnings = () => warnings().slice(warnMark);

/** Como superusuario (postgres), igual que el backoffice o una migración. */
const su = (q, p = []) => db.query(q, p, { onNotice });
const suExec = (q) => db.exec(q, { onNotice });

/** Como un usuario de la app (uid) o como anónimo (uid = null). */
async function as(uid, q, p = []) {
  return db.transaction(async (tx) => {
    const role = uid ? 'authenticated' : 'anon';
    await tx.exec(`set local role ${role}`);
    const claims = uid ? { sub: uid, role } : { role };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    return tx.query(q, p, { onNotice });
  });
}

async function rpc(uid, fn, args = []) {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  const r = await as(uid, `select public.${fn}(${ph}) as r`, args);
  return r.rows[0].r;
}

async function errorOf(promise) {
  try {
    await promise;
    return null;
  } catch (e) {
    return String(e.message || e);
  }
}

const num = (v) => Number(v);
const near = (a, b) => Math.abs(num(a) - b) < 0.001;

// ---------- usuarios ----------
const U = {
  admin: '00000000-0000-0000-0000-0000000000a1',
  staff: '00000000-0000-0000-0000-0000000000a2', // empleado (staff), NO admin
  p1: '00000000-0000-0000-0000-0000000000b1', // comercial Ana (y a veces conductora)
  p2: '00000000-0000-0000-0000-0000000000b2', // comercial Bea
  drv: '00000000-0000-0000-0000-0000000000d1', // conductor verificado
  drv2: '00000000-0000-0000-0000-0000000000d2', // otro conductor verificado
  c1: '00000000-0000-0000-0000-0000000000c1',
  c2: '00000000-0000-0000-0000-0000000000c2',
  c3: '00000000-0000-0000-0000-0000000000c3',
  c4: '00000000-0000-0000-0000-0000000000c4',
  c5: '00000000-0000-0000-0000-0000000000c5',
  c6: '00000000-0000-0000-0000-0000000000c6',
  c7: '00000000-0000-0000-0000-0000000000c7',
  c8: '00000000-0000-0000-0000-0000000000c8',
};

// ---------- esquema mínimo que imita Supabase ----------
await suExec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  -- Permisos por defecto de Supabase: todo lo nuevo en public se concede a
  -- anon/authenticated/service_role (por eso las migraciones tienen que revocar).
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());

  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(auth.jwt() ->> 'role', '')
  $$;
  grant execute on all functions in schema auth to anon, authenticated, service_role;

  create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text,
    full_name text,
    role text not null default 'client',
    created_date timestamptz not null default now()
  );

  create table public.driver_profiles (
    id uuid primary key default gen_random_uuid(),
    created_by_id uuid,
    email text,
    status text not null default 'pending_verification'
  );

  -- Solo las columnas que usan las migraciones y los triggers copiados.
  create table public.transport_requests (
    id uuid primary key default gen_random_uuid(),
    created_date timestamptz not null default now(),
    updated_date timestamptz not null default now(),
    created_by text,
    created_by_id uuid,
    status text not null default 'pending',
    client_name text,
    origin_address text,
    destination_address text,
    notes text,
    estimated_price numeric,
    final_price numeric,
    price_breakdown jsonb not null default '[]'::jsonb,
    payment_method text not null default 'card',
    payment_status text not null default 'pending',
    stripe_session_id text,
    driver_id uuid,
    driver_name text,
    accepted_at timestamptz,
    delivery_time timestamptz,
    tip_amount numeric,
    proposed_price numeric,
    client_rating numeric,
    client_review text,
    driver_cancel_reason text,
    service_type text,
    vehicle_type text,
    needs_help boolean not null default false,
    origin_floors integer not null default 0,
    destination_floors integer not null default 0,
    origin_has_lift boolean,
    destination_has_lift boolean,
    origin_zone text not null default 'albacete',
    destination_zone text not null default 'albacete',
    extra_hours numeric not null default 0,
    items_count integer,
    package_weight text,
    stops jsonb not null default '[]'::jsonb,
    -- 0027
    driver_transfer_id text,
    driver_transfer_amount numeric,
    driver_transferred_at timestamptz,
    tip_payment_intent_id text,
    tip_transfer_id text,
    tip_transfer_amount numeric,
    tip_transferred_at timestamptz,
    delivered_stamped_at timestamptz
  );

  create table public.app_settings (
    id uuid primary key default gen_random_uuid(),
    created_date timestamptz not null default now(),
    key text unique not null,
    value jsonb
  );

  -- Mismas firmas y cuerpo que producción (0001).
  create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles p
      where p.id = auth.uid() and (p.role = 'admin' or p.email = 'renato.0550.calero@gmail.com'));
  $$;
  create or replace function public.is_staff()
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles p
      where p.id = auth.uid() and (p.role in ('admin', 'staff') or p.email = 'renato.0550.calero@gmail.com'));
  $$;

  -- Sustituto de compute_quote (0026): aquí el presupuesto = estimated_price,
  -- que es lo que set_request_price guardó al crear el pedido.
  create or replace function public.compute_quote(payload jsonb)
  returns jsonb language sql stable as $$
    select jsonb_build_object('total', coalesce((payload->>'estimated_price')::numeric, 0), 'lines', '[]'::jsonb)
  $$;

  alter table public.app_settings enable row level security;
  create policy app_settings_select on public.app_settings for select using (true);
  create policy app_settings_write on public.app_settings for all
    using (public.is_admin()) with check (public.is_admin());
  insert into public.app_settings (key, value) values ('tariffs', '{"commission_pct": 15}');

  -- ===== RLS REAL de transport_requests =====
  alter table public.transport_requests enable row level security;
  -- select: 0001
  create policy transport_requests_select on public.transport_requests for select
    using (
      public.is_staff()
      or created_by_id = auth.uid()
      or driver_id = auth.uid()
      or (
        status = 'pending'
        and exists (
          select 1 from public.driver_profiles dp
          where (dp.created_by_id = auth.uid() or lower(dp.email) = lower(auth.jwt() ->> 'email'))
            and dp.status = 'verified'
        )
      )
    );
  -- update: 0003 (la vigente)
  create policy transport_requests_update on public.transport_requests for update
    using (
      public.is_staff()
      or created_by_id = auth.uid()
      or driver_id = auth.uid()
      or (
        status = 'pending'
        and exists (
          select 1 from public.driver_profiles dp
          where (dp.created_by_id = auth.uid() or lower(dp.email) = lower(auth.jwt() ->> 'email'))
            and dp.status = 'verified'
        )
      )
    )
    with check (
      public.is_staff()
      or created_by_id = auth.uid()
      or driver_id = auth.uid()
      or (status = 'pending' and driver_id is null)
    );
  -- delete: 0001
  create policy transport_requests_delete on public.transport_requests for delete
    using (public.is_admin());

  -- ===== Triggers REALES (cuerpos de la 0001, 0027 y 0010) =====
  create or replace function public.set_updated_date()
  returns trigger language plpgsql as $$
  begin
    new.updated_date := now();
    return new;
  end;
  $$;
  create trigger set_updated_date before update on public.transport_requests
    for each row execute function public.set_updated_date();

  create or replace function public.protect_order_payment_fields()
  returns trigger language plpgsql security invoker set search_path = public as $$
  begin
    if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
       or coalesce(auth.role(), '') = 'service_role' then
      return new;
    end if;
    new.driver_transfer_id := old.driver_transfer_id;
    new.driver_transfer_amount := old.driver_transfer_amount;
    new.driver_transferred_at := old.driver_transferred_at;
    new.tip_payment_intent_id := old.tip_payment_intent_id;
    new.tip_transfer_id := old.tip_transfer_id;
    new.tip_transfer_amount := old.tip_transfer_amount;
    new.tip_transferred_at := old.tip_transferred_at;
    new.delivered_stamped_at := old.delivered_stamped_at;
    if public.is_staff() then
      return new;
    end if;
    new.payment_status := old.payment_status;
    new.final_price := old.final_price;
    new.stripe_session_id := old.stripe_session_id;
    return new;
  end;
  $$;
  create trigger trg_protect_order_payment_fields
    before update on public.transport_requests
    for each row execute function public.protect_order_payment_fields();

  create or replace function public.stamp_final_price()
  returns trigger language plpgsql security invoker set search_path = public as $$
  begin
    if new.status = 'delivered'
       and old.status is distinct from 'delivered'
       and new.final_price is null then
      new.final_price := new.estimated_price;
    end if;
    return new;
  end;
  $$;
  create trigger trg_stamp_final_price
    before update on public.transport_requests
    for each row execute function public.stamp_final_price();

  create or replace function public.zz_stamp_delivered_at()
  returns trigger language plpgsql security invoker set search_path = public as $$
  begin
    if new.status = 'delivered'
       and old.status is distinct from 'delivered'
       and new.delivered_stamped_at is null then
      new.delivered_stamped_at := now();
    end if;
    return new;
  end;
  $$;
  create trigger zz_stamp_delivered_at
    before update on public.transport_requests
    for each row execute function public.zz_stamp_delivered_at();
`);

const sql0029 = readFileSync(MIG_0029, 'utf8');
const sql0028 = readFileSync(MIG_0028, 'utf8');
for (const [name, text] of [['0029', sql0029], ['0028', sql0028]]) {
  const e = await errorOf(suExec(text));
  check(`la migración ${name} se aplica sin errores`, e === null, e);
  if (e) {
    console.log(`\n${ok} OK, ${fail} FAIL`);
    process.exit(1);
  }
}
check('orden de triggers BEFORE: set_updated_date < core < payment < stamp_final_price < zz_stamp',
  JSON.stringify((await su(`select tgname from pg_trigger where tgrelid = 'public.transport_requests'::regclass
    and not tgisinternal and tgname in ('set_updated_date','trg_protect_order_core_fields','trg_protect_order_payment_fields','trg_stamp_final_price','zz_stamp_delivered_at')
    order by tgname`)).rows.map((r) => r.tgname)) ===
  JSON.stringify(['set_updated_date', 'trg_protect_order_core_fields', 'trg_protect_order_payment_fields', 'trg_stamp_final_price', 'zz_stamp_delivered_at']));

// Usuarios y perfiles. daysOld = antigüedad de la CUENTA; profileDaysOld, la del perfil.
async function addUser(id, email, fullName, role = 'client', daysOld = 0, profileDaysOld = daysOld) {
  await su(`insert into auth.users (id, email, created_at) values ($1, $2, now() - make_interval(days => $3::int))`, [id, email, daysOld]);
  await su(
    `insert into public.profiles (id, email, full_name, role, created_date)
     values ($1, $2, $3, $4, now() - make_interval(days => $5::int))`,
    [id, email, fullName, role, profileDaysOld],
  );
}
await addUser(U.admin, 'admin@x.test', 'Admin Jefe', 'admin');
await addUser(U.staff, 'staff@x.test', 'Esteban Empleado', 'staff');
await addUser(U.p1, 'ana@x.test', 'Ana López');
await addUser(U.p2, 'bea@x.test', 'Bea Ruiz');
await addUser(U.drv, 'drv@x.test', 'Dani Conductor', 'driver');
await addUser(U.drv2, 'drv2@x.test', 'Dora Conductora', 'driver');
await addUser(U.c1, 'carla@x.test', 'Carla Gómez Pérez');
await addUser(U.c2, 'c2@x.test', 'Carlos Viejo');
await addUser(U.c3, 'c3@x.test', 'Cris Antiguo', 'client', 40, 0); // cuenta vieja, perfil nuevo
await addUser(U.c4, 'c4@x.test', '');
await addUser(U.c5, 'c5@x.test', 'Celia');
await addUser(U.c6, 'c6@x.test', 'Clara');
await addUser(U.c7, 'c7@x.test', 'Coral');
await addUser(U.c8, 'c8@x.test', 'Cami Nueva', 'client', 0, 40); // cuenta nueva, perfil viejo
await su(`insert into public.driver_profiles (created_by_id, email, status) values ($1, 'drv@x.test', 'verified'), ($2, 'drv2@x.test', 'verified')`, [U.drv, U.drv2]);

// Pedidos: se crean como superusuario; los cambios de estado, también salvo
// que la prueba diga otra cosa (entonces van por RLS como cliente o conductor).
async function newOrder(client, {
  estimated = 100, final = null, breakdown = [], method = 'card', driver = U.drv, tip = null,
  status = 'accepted', paid = true,
} = {}) {
  const r = await su(
    `insert into public.transport_requests (created_by_id, status, estimated_price, final_price, price_breakdown, payment_method, driver_id, tip_amount, payment_status)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9) returning id`,
    [client, status, estimated, final, JSON.stringify(breakdown), method, driver, tip, paid ? 'paid' : 'pending'],
  );
  return r.rows[0].id;
}
const setStatus = (id, status) => su(`update public.transport_requests set status = $2 where id = $1`, [id, status]);
const order = async (id) => (await su(`select * from public.transport_requests where id = $1`, [id])).rows[0];
const commissionOf = async (reqId) =>
  (await su(`select * from public.partner_commissions where request_id = $1`, [reqId])).rows[0];
const setSetting = (patch) =>
  su(`update public.app_settings set value = value || $1::jsonb where key = 'partner_program'`, [JSON.stringify(patch)]);
const dropSettingKeys = (keys) =>
  su(`update public.app_settings set value = value - $1::text[] where key = 'partner_program'`, [keys]);

// ---------- ajustes ----------
{
  const s = (await su(`select value from public.app_settings where key = 'partner_program'`)).rows[0]?.value;
  check('ajustes partner_program creados con los valores del brief',
    s && s.enabled === true && s.public === false && s.first_pct === 5 && s.repeat_pct === 2 && s.hold_days === 15 &&
    s.min_payout === 20 && s.payout_interval_days === 30 && s.claim_window_days === 30 &&
    s.hold_same_driver === true && s.max_price_quote_ratio === 2 && s.max_auto_base === 300 &&
    s.max_auto_cash_base === 150 && !('hold_same_driver_cash' in s), s);
}

// ============================================================
// 0029 — campos clave del pedido, por RLS como cliente y conductor
// ============================================================
markWarnings();
{
  // Carlos (c2, sin comercial) pide; Dani (drv) conduce.
  const o = await newOrder(U.c2, { estimated: 80, status: 'picked_up', paid: false });

  let e = await errorOf(as(U.c2, `update public.transport_requests set status = 'delivered' where id = $1`, [o]));
  check('0029: el cliente no puede darse su pedido por entregado', e !== null && /Solo el conductor del servicio/.test(e), e);
  check('0029: tras el intento, sigue en picked_up', (await order(o)).status === 'picked_up');

  await as(U.c2, `update public.transport_requests
                    set estimated_price = 1, price_breakdown = '[{"key":"base","amount":1}]'::jsonb,
                        created_by_id = $2, created_by = 'otro@x.test', needs_help = true, extra_hours = 9
                  where id = $1`, [o, U.c1]);
  let r = await order(o);
  check('0029: el cliente no cambia estimated_price', num(r.estimated_price) === 80, r.estimated_price);
  check('0029: el cliente no cambia price_breakdown', JSON.stringify(r.price_breakdown) === '[]', r.price_breakdown);
  check('0029: el cliente no cambia created_by_id ni created_by', r.created_by_id === U.c2 && r.created_by === null, [r.created_by_id, r.created_by]);
  check('0029: el cliente no cambia las entradas del precio', r.needs_help === false && num(r.extra_hours) === 0, [r.needs_help, r.extra_hours]);

  await as(U.c2, `update public.transport_requests set payment_status = 'paid', final_price = 1 where id = $1`, [o]);
  r = await order(o);
  check('0027 (real) sigue protegiendo payment_status y final_price', r.payment_status === 'pending' && r.final_price === null, r);

  await as(U.c2, `update public.transport_requests set payment_method = 'cash', client_rating = 5 where id = $1`, [o]);
  r = await order(o);
  check('0029: con el pedido abierto, el cliente cambia la forma de pago', r.payment_method === 'cash' && num(r.client_rating) === 5, r.payment_method);

  await as(U.drv, `update public.transport_requests set created_by_id = $2 where id = $1`, [o, U.drv]);
  check('0029: el conductor no puede apropiarse del pedido (created_by_id)', (await order(o)).created_by_id === U.c2);

  // Entregar: solo desde picked_up
  const oa = await newOrder(U.c2, { status: 'accepted' });
  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'delivered' where id = $1`, [oa]));
  check('0029: el conductor no entrega desde accepted', e !== null && /Solo el conductor/.test(e), e);
  const oi = await newOrder(U.c2, { status: 'in_transit' });
  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'delivered' where id = $1`, [oi]));
  check('0029: el conductor no entrega desde in_transit', e !== null, e);
  e = await errorOf(as(U.drv2, `update public.transport_requests set status = 'delivered' where id = $1`, [o]));
  r = await order(o);
  check('0029: otro conductor no entrega un pedido ajeno', r.status === 'picked_up', { e, s: r.status });

  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'delivered', delivery_time = now(), recipient_name_x = null where id = $1`, [o]));
  // (columna inexistente a propósito: debe fallar por SQL, no por el trigger)
  check('(control) un update con columna inexistente falla', e !== null && /recipient_name_x/.test(e), e);
  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'delivered', delivery_time = now() where id = $1`, [o]));
  r = await order(o);
  check('0029: el conductor entrega desde picked_up', e === null && r.status === 'delivered', { e, s: r.status });
  check('0029: final_price se estampa con el precio ORIGINAL (80)', num(r.final_price) === 80, r.final_price);
  check('0027: el sello de entrega del servidor queda puesto', r.delivered_stamped_at !== null);

  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'in_transit' where id = $1`, [o]));
  check('0029: el conductor no puede sacar un pedido de delivered', e !== null && /ya está entregado/.test(e), e);
  e = await errorOf(as(U.c2, `update public.transport_requests set status = 'pending' where id = $1`, [o]));
  check('0029: el cliente tampoco', e !== null && /ya está entregado/.test(e), e);
  await as(U.c2, `update public.transport_requests set payment_method = 'card' where id = $1`, [o]);
  check('0029: entregado, la forma de pago queda congelada', (await order(o)).payment_method === 'cash');
  await as(U.c2, `update public.transport_requests set client_rating = 4, client_review = 'Bien' where id = $1`, [o]);
  check('0029: el cliente sigue pudiendo valorar un entregado', num((await order(o)).client_rating) === 4);

  // Aceptar y cancelar como conductor (los updates reales de la web y la app)
  const op = await newOrder(U.c2, { status: 'pending', driver: null });
  const acc = await as(U.drv, `update public.transport_requests
      set status = 'accepted', driver_id = $2, driver_name = 'Dani', accepted_at = now()
    where id = $1 and status = 'pending' returning id`, [op, U.drv]);
  r = await order(op);
  check('0029: aceptar (pendiente → yo) funciona como en la app', acc.rows.length === 1 && r.status === 'accepted' && r.driver_id === U.drv, r);
  const steal = await as(U.drv2, `update public.transport_requests set driver_id = $2 where id = $1 returning id`, [op, U.drv2]);
  check('0029: otro conductor no puede quitárselo', steal.rows.length === 0 && (await order(op)).driver_id === U.drv);
  e = await errorOf(as(U.drv, `update public.transport_requests
      set status = 'pending', driver_id = null, driver_name = null, accepted_at = null, driver_cancel_reason = 'Avería'
    where id = $1`, [op]));
  r = await order(op);
  check('0029: la cancelación del conductor (yo → nadie) funciona', e === null && r.status === 'pending' && r.driver_id === null && r.driver_cancel_reason === 'Avería', { e, r });
  await as(U.drv, `update public.transport_requests set driver_id = $2 where id = $1`, [oa, U.drv2]);
  check('0029: el conductor no puede pasar el pedido a otro', (await order(oa)).driver_id === U.drv);

  // El cliente intenta ponerse de conductor de su propio pedido
  const os = await newOrder(U.c2, { status: 'pending', driver: null });
  await as(U.c2, `update public.transport_requests set driver_id = $2 where id = $1`, [os, U.c2]);
  check('0029: el cliente no se asigna como conductor', (await order(os)).driver_id === null);

  // Staff: puede con todo
  e = await errorOf(as(U.staff, `update public.transport_requests set status = 'in_transit', estimated_price = 77, created_by_id = $2 where id = $1`, [o, U.c1]));
  r = await order(o);
  check('0029: el staff puede reabrir, cambiar precio y dueño', e === null && r.status === 'in_transit' && num(r.estimated_price) === 77 && r.created_by_id === U.c1, { e, r });
  await su(`update public.transport_requests set created_by_id = $2, status = 'delivered' where id = $1`, [o, U.c2]);
  e = await errorOf(as(U.staff, `update public.transport_requests set status = 'delivered' where id = $1`, [oa]));
  check('0029: el staff puede entregar desde cualquier estado', e === null && (await order(oa)).status === 'delivered', e);

  // ----- D1: un conductor verificado AJENO sobre un pedido pendiente -----
  const mk = async (fields) => (await su(
    `insert into public.transport_requests (created_by_id, status, estimated_price, proposed_price, payment_method, origin_address, destination_address, notes, client_name, updated_date)
     values ($1, 'pending', $2, $3, 'card', 'Calle A 1', 'Calle B 2', 'Frágil', 'Carlos', now() - interval '1 hour') returning id`,
    [U.c2, fields.estimated ?? 80, fields.proposed ?? null])).rows[0].id;
  const t1 = await mk({ proposed: 60 });
  const before1 = await order(t1);
  e = await errorOf(as(U.drv2, `update public.transport_requests
      set proposed_price = 5000, payment_method = 'cash', origin_address = 'Otra', destination_address = 'Otra',
          notes = 'cambiado', client_name = 'X', driver_name = 'Dora', accepted_at = now()
    where id = $1`, [t1]));
  r = await order(t1);
  check('D1: un conductor ajeno no cambia proposed_price, forma de pago, direcciones, notas ni nombre',
    e === null && num(r.proposed_price) === 60 && r.payment_method === 'card' && r.origin_address === 'Calle A 1' &&
    r.destination_address === 'Calle B 2' && r.notes === 'Frágil' && r.client_name === 'Carlos', { e, r });
  check('D1: sin aceptar, tampoco escribe driver_name ni accepted_at', r.driver_name === null && r.accepted_at === null, r);
  check('D1: updated_date se sigue actualizando', new Date(r.updated_date) > new Date(before1.updated_date), [before1.updated_date, r.updated_date]);
  e = await errorOf(as(U.drv2, `update public.transport_requests
      set status = 'accepted', driver_id = $2, driver_name = 'Dora', accepted_at = now(), proposed_price = 5000, notes = 'x'
    where id = $1 and status = 'pending'`, [t1, U.drv2]));
  r = await order(t1);
  check('D1: el conductor ajeno sí puede aceptar (y solo eso)',
    e === null && r.status === 'accepted' && r.driver_id === U.drv2 && r.driver_name === 'Dora' && r.accepted_at !== null &&
    num(r.proposed_price) === 60 && r.notes === 'Frágil', { e, r });

  // ----- D1: el dueño sube o baja su oferta dentro de límites -----
  const t2 = await mk({ estimated: 80 });
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 60 where id = $1`, [t2]));
  check('D1: el dueño ofrece 60 € sobre 80 € (dentro de límites)', e === null && num((await order(t2)).proposed_price) === 60, e);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 40 where id = $1`, [t2]));
  check('D1: por debajo del 60 % → error', e !== null && /demasiado baja/.test(e) && num((await order(t2)).proposed_price) === 60, e);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 4 where id = $1`, [t2]));
  check('D1: por debajo de 5 € → error', e !== null && /mínima es 5/.test(e), e);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 450 where id = $1`, [t2]));
  check('D1: hasta 500 € vale aunque sea más de 5 veces (80 × 5 = 400)', e === null && num((await order(t2)).proposed_price) === 450, e);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 501 where id = $1`, [t2]));
  check('D1: por encima de max(500, 5 × precio) → error', e !== null && /demasiado alta/.test(e), e);
  const t3 = await mk({ estimated: 200 });
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 900 where id = $1`, [t3]));
  check('D1: con precio 200 € el techo es 1000 € (900 vale)', e === null && num((await order(t3)).proposed_price) === 900, e);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = null where id = $1`, [t3]));
  check('D1: el dueño puede retirar su oferta (null)', e === null && (await order(t3)).proposed_price === null, e);
  await as(U.drv, `update public.transport_requests set status = 'accepted', driver_id = $2, driver_name = 'Dani', accepted_at = now()
                    where id = $1 and status = 'pending'`, [t2, U.drv]);
  e = await errorOf(as(U.c2, `update public.transport_requests set proposed_price = 70 where id = $1`, [t2]));
  check('D1: aceptado el pedido, la oferta queda fija', e === null && num((await order(t2)).proposed_price) === 450, e);
  await as(U.drv, `update public.transport_requests set proposed_price = 10 where id = $1`, [t2]);
  check('D1: el conductor asignado tampoco la cambia', num((await order(t2)).proposed_price) === 450);

  // ----- D4: cambio de conductor rechazado junto con cambio de estado → error -----
  const t4 = await mk({});
  e = await errorOf(as(U.c2, `update public.transport_requests set status = 'accepted', driver_id = $2 where id = $1`, [t4, U.c2]));
  r = await order(t4);
  check('D4: el cliente que se pone de conductor y cambia el estado recibe un error', e !== null && /No puedes cambiar el conductor/.test(e) && r.status === 'pending' && r.driver_id === null, { e, r });
  e = await errorOf(as(U.drv, `update public.transport_requests set status = 'in_transit', driver_id = $2 where id = $1`, [t2, U.drv2]));
  r = await order(t2);
  check('D4: el conductor que pasa el pedido a otro cambiando el estado recibe un error', e !== null && /No puedes cambiar el conductor/.test(e) && r.status === 'accepted' && r.driver_id === U.drv, { e, r });

  check('0029: sin advertencias', newWarnings().length === 0, newWarnings().map((w) => w.message));
}

// ============================================================
// 0028 — Partners
// ============================================================

// ---------- lanzamiento privado: con la fila recién creada (no pública) ----------
{
  const r = await rpc(U.p1, 'partner_activate', ['Ana López', 'ana-lopez']);
  check('privado: con la fila recién sembrada (no pública) un usuario normal no puede darse de alta (disabled)',
    r.ok === false && r.reason === 'disabled', r);
  const n = (await su(`select count(*)::int as n from public.partners`)).rows[0].n;
  check('privado: el intento rechazado no crea nada', n === 0, n);
  // El resto de escenarios prueba el programa ABIERTO; el privado tiene su
  // bloque propio al final (con usuarios que no se usan en ningún otro sitio).
  await setSetting({ public: true });
}

// ---------- alta de comercial ----------
{
  let r = await rpc(U.p1, 'partner_activate', ['Ana López', '  Ana-Lopez ']);
  check('activar: alta correcta y slug normalizado a minúsculas', r.ok === true && r.slug === 'ana-lopez', r);
  r = await rpc(U.p1, 'partner_activate', ['Ana', 'otra-ana']);
  check('activar: un comercial por usuario (already_partner)', r.ok === false && r.reason === 'already_partner', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'ana-lopez']);
  check('activar: slug ocupado (slug_taken)', r.reason === 'slug_taken', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'Admin']);
  check('activar: palabra reservada (reserved_slug)', r.reason === 'reserved_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'clicyvoy']);
  check('activar: "clicyvoy" reservado', r.reason === 'reserved_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'ab']);
  check('activar: slug demasiado corto (bad_slug)', r.reason === 'bad_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', '---']);
  check('activar: "---" no vale (bad_slug)', r.reason === 'bad_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'a-b-c']);
  check('activar: sin 3 letras/cifras seguidas no vale (bad_slug)', r.reason === 'bad_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'bea ruiz!']);
  check('activar: caracteres no válidos (bad_slug)', r.reason === 'bad_slug', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea', 'a'.repeat(31)]);
  check('activar: slug de 31 caracteres (bad_slug)', r.reason === 'bad_slug', r);
  r = await rpc(U.p2, 'partner_activate', [' B ', 'bea']);
  check('activar: nombre demasiado corto (bad_name)', r.reason === 'bad_name', r);
  r = await rpc(U.p2, 'partner_activate', ['Bea Ruiz', 'bea']);
  check('activar: segunda comercial correcta', r.ok === true && r.slug === 'bea', r);
  const e = await errorOf(rpc(null, 'partner_activate', ['Anon', 'anon-x']));
  check('activar: anónimo no puede llamarla', e !== null && /permission denied/i.test(e), e);
  const e2 = await errorOf(su(`insert into public.partners (slug, display_name) values ('---', 'x')`));
  check('activar: la tabla también rechaza "---"', e2 !== null && /check/i.test(e2), e2);
}

// ---------- datos de cobro ----------
{
  let r = await rpc(U.p1, 'partner_update_payout_data', ['Ana López', 'ES12 3456']);
  check('IBAN: forma incorrecta (bad_iban)', r.reason === 'bad_iban', r);
  r = await rpc(U.p1, 'partner_update_payout_data', ['A', 'ES9121000418450200051332']);
  check('IBAN: titular demasiado corto (bad_holder)', r.reason === 'bad_holder', r);
  r = await rpc(U.p1, 'partner_update_payout_data', ['Ana López', 'es91 2100 0418 4502 0005 1332']);
  check('IBAN: español con espacios aceptado y normalizado', r.ok === true && r.iban_last4 === '1332', r);
  const stored = (await su(`select payout_iban from public.partners where user_id = $1`, [U.p1])).rows[0].payout_iban;
  check('IBAN: guardado sin espacios y en mayúsculas', stored === 'ES9121000418450200051332', stored);
  r = await rpc(U.c1, 'partner_update_payout_data', ['Carla', 'ES9121000418450200051332']);
  check('IBAN: quien no es comercial (not_partner)', r.reason === 'not_partner', r);
  r = await rpc(U.p1, 'partner_update_payout_data', ['Ana López', 'ES91210004184502000513']);
  check('IBAN: español con 20 dígitos rechazado', r.reason === 'bad_iban', r);
  await rpc(U.p1, 'partner_update_payout_data', ['Ana López', 'ES9121000418450200051332']);
  const de = await rpc(U.p2, 'partner_update_payout_data', ['Bea Ruiz', 'DE89 3704 0044 0532 0130 00']);
  check('IBAN: extranjero genérico aceptado', de.ok === true, de);
  // Bea se queda SIN datos de cobro para probar no_payout_data
  await su(`update public.partners set payout_holder = null, payout_iban = null where slug = 'bea'`);
}

// ---------- página pública ----------
{
  let r = await rpc(null, 'partner_public', ['ANA-LOPEZ']);
  check('público: anónimo ve nombre de pila y activo', r.first_name === 'Ana' && r.active === true, r);
  check('público: solo devuelve first_name y active', JSON.stringify(Object.keys(r).sort()) === '["active","first_name"]', r);
  const unknown = await rpc(null, 'partner_public', ['no-existe']);
  check('público: slug desconocido = {first_name:null, active:false}', unknown.active === false && unknown.first_name === null, unknown);
  for (const fn of ['partner_dashboard', 'partner_clients', 'partner_request_payout', 'partner_admin_list']) {
    const e = await errorOf(rpc(null, fn));
    check(`anónimo: no puede ejecutar ${fn}`, e !== null && /permission denied/i.test(e), e);
  }
  const e = await errorOf(rpc(null, 'partner_claim_referral', ['ana-lopez']));
  check('anónimo: no puede ejecutar partner_claim_referral', e !== null && /permission denied/i.test(e), e);
  for (const t of ['partners', 'partner_referrals', 'partner_commissions', 'partner_payouts']) {
    const e2 = await errorOf(as(null, `select * from public.${t}`));
    check(`anónimo: no puede leer ${t}`, e2 !== null && /permission denied/i.test(e2), e2);
  }
  for (const fn of ['partner_program_settings()', 'partner_totals(null)', "partner_first_name('x')", "partner_effective_status('pending', now(), null)"]) {
    const e3 = await errorOf(as(U.c1, `select public.${fn}`));
    check(`authenticated: no puede ejecutar el auxiliar ${fn}`, e3 !== null && /permission denied/i.test(e3), e3);
  }
}

// ---------- atribución ----------
const BEA = (await su(`select id from public.partners where slug = 'bea'`)).rows[0].id;
const ANA = (await su(`select id from public.partners where slug = 'ana-lopez'`)).rows[0].id;
{
  let r = await rpc(U.c1, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: cliente nuevo queda con Ana', r.ok === true, r);
  r = await rpc(U.c1, 'partner_claim_referral', ['Ana-Lopez']);
  check('atribución: repetir con el mismo comercial es idempotente (ok)', r.ok === true && r.already === true, r);
  r = await rpc(U.c1, 'partner_claim_referral', ['bea']);
  check('atribución: ya tiene comercial (already_referred)', r.reason === 'already_referred', r);
  r = await rpc(U.p1, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: su propio enlace (own_link)', r.reason === 'own_link', r);
  r = await rpc(U.c2, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: ya tenía pedidos (has_orders)', r.reason === 'has_orders', r);
  r = await rpc(U.c3, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: cuenta de hace 40 días aunque el perfil sea nuevo (not_new)', r.reason === 'not_new', r);
  r = await rpc(U.c8, 'partner_claim_referral', ['bea']);
  check('atribución: cuenta nueva con perfil viejo sí vale (cuenta = auth.users)', r.ok === true, r);
  r = await rpc(U.c4, 'partner_claim_referral', ['no-existe']);
  check('atribución: código desconocido (unknown_code)', r.reason === 'unknown_code', r);
  await setSetting({ enabled: false });
  r = await rpc(U.c5, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: programa apagado (disabled)', r.reason === 'disabled', r);
  await setSetting({ enabled: true });
  await rpc(U.admin, 'partner_admin_set_status', [BEA, 'blocked']);
  r = await rpc(U.c5, 'partner_claim_referral', ['bea']);
  check('atribución: comercial bloqueado responde unknown_code', r.reason === 'unknown_code', r);
  const pb = await rpc(null, 'partner_public', ['bea']);
  check('público: bloqueado responde igual que desconocido', JSON.stringify(pb) === JSON.stringify({ active: false, first_name: null }), pb);
  await rpc(U.admin, 'partner_admin_set_status', [BEA, 'active']);
  r = await rpc(U.c6, 'partner_claim_referral', ['bea']);
  check('atribución: Clara queda con Bea', r.ok === true, r);
  r = await rpc(U.c4, 'partner_claim_referral', ['ana-lopez']);
  check('atribución: cliente sin nombre queda con Ana', r.ok === true, r);
}

// ---------- comisiones (Carla, clienta de Ana) ----------
const ORD = {};
{
  markWarnings();
  // A: primer servicio de Carla, 100 € estimado, tarjeta, conductor normal, con propina
  ORD.A = await newOrder(U.c1, { estimated: 100, tip: 10 });
  await setStatus(ORD.A, 'delivered');
  let c = await commissionOf(ORD.A);
  check('comisión: primer servicio = first al 5 %', c && c.kind === 'first' && num(c.rate_pct) === 5 && num(c.amount) === 5, c);
  check('comisión: la propina no cuenta (base 100)', c && num(c.base_amount) === 100, c?.base_amount);
  check('comisión: nace pendiente y sin avisos', c && c.status === 'pending' && c.flags.length === 0, c);
  const days = (await su(`select extract(epoch from (available_at - now())) / 86400 as d from public.partner_commissions where request_id = $1`, [ORD.A])).rows[0].d;
  check('comisión: disponible a los 15 días (hora del servidor)', num(days) > 14.99 && num(days) <= 15.0001, days);
  check('comisión: guarda conductor y forma de pago', c && c.driver_id === U.drv && c.payment_method === 'card', c);
  const stampA = (await order(ORD.A)).delivered_stamped_at;
  check('comisión: delivered_at = sello del servidor del pedido', c && new Date(c.delivered_at).getTime() === new Date(stampA).getTime(), [c?.delivered_at, stampA]);

  // B: segundo servicio con penalización pendiente cobrada en él
  ORD.B = await newOrder(U.c1, {
    estimated: 50, final: 60,
    breakdown: [{ key: 'base', label: 'Porte', amount: 55 }, { key: 'pending_cancellation', label: 'Penalización', amount: 5 }],
  });
  await setStatus(ORD.B, 'delivered');
  c = await commissionOf(ORD.B);
  check('comisión: siguiente servicio = repeat al 2 %', c && c.kind === 'repeat' && num(c.rate_pct) === 2, c);
  check('comisión: base = precio final − penalización (60 − 5 = 55)', c && num(c.base_amount) === 55 && num(c.amount) === 1.1, c);

  ORD.B2 = await newOrder(U.c1, { estimated: 40, final: 45 });
  await setStatus(ORD.B2, 'delivered');
  c = await commissionOf(ORD.B2);
  check('comisión: sin penalización, base = final_price (45)', c && num(c.base_amount) === 45 && num(c.amount) === 0.9, c);

  // Penalización negativa en el desglose: se ignora (no infla la base)
  ORD.NEG = await newOrder(U.c4, { estimated: 50, breakdown: [{ key: 'pending_cancellation', amount: -500 }] });
  await setStatus(ORD.NEG, 'delivered');
  c = await commissionOf(ORD.NEG);
  check('comisión: una penalización negativa no sube la base (50)', c && num(c.base_amount) === 50, c);

  // Penalización mayor que el precio: base 0 → no hay comisión
  ORD.Z = await newOrder(U.c1, { estimated: 3, breakdown: [{ key: 'pending_cancellation', amount: 5 }] });
  await setStatus(ORD.Z, 'delivered');
  check('comisión: base negativa se queda en 0 y no genera comisión', (await commissionOf(ORD.Z)) === undefined);

  // El conductor es el propio cliente: nunca hay comisión
  ORD.SELF = await newOrder(U.c4, { estimated: 100, driver: U.c4 });
  await setStatus(ORD.SELF, 'delivered');
  check('antifraude: conductor = cliente, sin comisión', (await commissionOf(ORD.SELF)) === undefined);

  // D: Ana conduce el servicio de su propia clienta, con tarjeta → retenida
  ORD.D = await newOrder(U.c1, { estimated: 100, driver: U.p1, method: 'card' });
  await setStatus(ORD.D, 'delivered');
  c = await commissionOf(ORD.D);
  check('antifraude: conductor = comercial con tarjeta → retenida (held) y same_driver',
    c && c.status === 'held' && c.flags.includes('same_driver') && !c.flags.includes('cash'), c);

  // E: Ana conduce y cobra en efectivo
  ORD.E = await newOrder(U.c1, { estimated: 100, driver: U.p1, method: 'cash' });
  await setStatus(ORD.E, 'delivered');
  c = await commissionOf(ORD.E);
  check('antifraude: conductor = comercial en efectivo → retenida con same_driver y cash',
    c && c.status === 'held' && c.flags.includes('same_driver') && c.flags.includes('cash'), c);

  // Nombre antiguo del ajuste (hold_same_driver_cash) como respaldo
  await dropSettingKeys(['hold_same_driver']);
  await setSetting({ hold_same_driver_cash: false });
  ORD.E2 = await newOrder(U.c1, { estimated: 100, driver: U.p1, method: 'cash' });
  await setStatus(ORD.E2, 'delivered');
  c = await commissionOf(ORD.E2);
  check('ajustes: hold_same_driver_cash=false (nombre antiguo) se respeta: pendiente y marcada', c && c.status === 'pending' && c.flags.includes('same_driver'), c);
  await dropSettingKeys(['hold_same_driver_cash']);
  await setSetting({ hold_same_driver: true });

  ORD.CASH = await newOrder(U.c1, { estimated: 50, method: 'cash' });
  await setStatus(ORD.CASH, 'delivered');
  c = await commissionOf(ORD.CASH);
  check('efectivo con otro conductor: comisión normal pendiente', c && c.status === 'pending' && c.flags.length === 0 && c.payment_method === 'cash', c);

  check('ninguna advertencia del trigger en los casos normales', newWarnings().length === 0, newWarnings().map((n) => n.message));

  // Des-entregar y re-entregar A
  await setStatus(ORD.A, 'in_transit');
  c = await commissionOf(ORD.A);
  check('des-entregar: comisión pendiente pasa a reversed', c && c.status === 'reversed', c);
  await setStatus(ORD.A, 'delivered');
  c = await commissionOf(ORD.A);
  check('re-entregar: la comisión anulada revive pendiente', c && c.status === 'pending', c);
  check('re-entregar: sigue siendo first (su sello de entrega es el más antiguo)', c && c.kind === 'first' && num(c.amount) === 5, c);
  const n = (await su(`select count(*)::int as n from public.partner_commissions where request_id = $1`, [ORD.A])).rows[0].n;
  check('re-entregar: sigue habiendo UNA comisión por pedido', n === 1, n);

  // Re-entregar una retenida conserva sus avisos sin duplicarlos
  await setStatus(ORD.D, 'in_transit');
  check('des-entregar: una retenida también se anula', (await commissionOf(ORD.D)).status === 'reversed');
  await setStatus(ORD.D, 'delivered');
  c = await commissionOf(ORD.D);
  check('re-entregar: vuelve retenida con sus avisos, sin duplicados',
    c.status === 'held' && JSON.stringify(c.flags) === '["same_driver"]', c.flags);

  await setStatus(ORD.E2, 'cancelled');
  check('des-entregar: también anula una pendiente marcada', (await commissionOf(ORD.E2)).status === 'reversed');

  await su(`update public.transport_requests set status = 'delivered' where id = $1`, [ORD.B]);
  c = await commissionOf(ORD.B);
  check('delivered → delivered no recalcula', c && num(c.amount) === 1.1 && c.status === 'pending', c);

  const o = await newOrder(U.c2);
  await setStatus(o, 'delivered');
  check('cliente sin comercial: no hay comisión', (await commissionOf(o)) === undefined);
}

// ---------- comisiones (Clara, clienta de Bea): retenciones, ajustes, fallos ----------
{
  markWarnings();
  // Comercial bloqueado: se crea RETENIDA y cuenta como el primero de Clara
  await rpc(U.admin, 'partner_admin_set_status', [BEA, 'blocked']);
  ORD.OB = await newOrder(U.c6);
  await setStatus(ORD.OB, 'delivered');
  let c = await commissionOf(ORD.OB);
  check('comercial bloqueado: comisión retenida con partner_blocked', c && c.status === 'held' && c.flags.includes('partner_blocked') && c.kind === 'first', c);
  await rpc(U.admin, 'partner_admin_set_status', [BEA, 'active']);

  // Programa apagado: retenida con program_disabled, y ya es repeat
  await setSetting({ enabled: false });
  ORD.OD = await newOrder(U.c6);
  await setStatus(ORD.OD, 'delivered');
  c = await commissionOf(ORD.OD);
  check('programa apagado: comisión retenida con program_disabled (y repeat)', c && c.status === 'held' && c.flags.includes('program_disabled') && c.kind === 'repeat', c);
  await setSetting({ enabled: true });

  // Ajustes rotos o fuera de rango: valores por defecto, sin fallo
  await setSetting({ first_pct: 'abc', repeat_pct: 80, hold_days: -3, min_payout: 'mucho' });
  const d = await rpc(U.p2, 'partner_dashboard');
  check('ajustes rotos: el panel muestra los valores por defecto',
    d.settings.first_pct === 5 && d.settings.repeat_pct === 2 && d.settings.hold_days === 15 && d.settings.min_payout === 20, d.settings);
  ORD.OF = await newOrder(U.c6, { estimated: 100 });
  await setStatus(ORD.OF, 'delivered');
  c = await commissionOf(ORD.OF);
  check('ajustes rotos: la comisión se calcula con el 2 % por defecto y 15 días', c && num(c.rate_pct) === 2 && num(c.amount) === 2, c);
  await setSetting({ first_pct: 5, repeat_pct: 2, hold_days: 15, min_payout: 20 });
  await setSetting({ enabled: 'quizás' });
  const pub = await rpc(null, 'partner_public', ['bea']);
  check('ajustes rotos: un "enabled" ilegible cuenta como apagado', pub.active === false, pub);
  await setSetting({ enabled: true });
  check('ajustes rotos: sin advertencias', newWarnings().length === 0, newWarnings().map((w) => w.message));

  // Fallo dentro del trigger (desglose roto): la entrega se guarda igual
  markWarnings();
  ORD.OG = await newOrder(U.c6, { breakdown: [{ key: 'pending_cancellation', amount: 'mucho' }] });
  const err = await errorOf(setStatus(ORD.OG, 'delivered'));
  check('fallo del trigger: la entrega se guarda igual', err === null && (await order(ORD.OG)).status === 'delivered', err);
  check('fallo del trigger: no se crea comisión', (await commissionOf(ORD.OG)) === undefined);
  check('fallo del trigger: deja un WARNING', newWarnings().length === 1 && /zz_partner_commission/.test(newWarnings()[0].message), newWarnings().map((w) => w.message));

  // El conductor entrega desde la app, por RLS, desde picked_up
  markWarnings();
  ORD.H = await newOrder(U.c6, { estimated: 80, status: 'picked_up' });
  const e = await errorOf(as(U.drv, `update public.transport_requests set status = 'delivered', delivery_time = now() where id = $1`, [ORD.H]));
  c = await commissionOf(ORD.H);
  check('entrega del conductor por RLS (authenticated): genera la comisión', e === null && c && c.kind === 'repeat' && num(c.amount) === 1.6 && c.status === 'pending', { e, c });
  check('sin advertencias al entregar como authenticated', newWarnings().length === 0, newWarnings().map((w) => w.message));

  // Precio final disparado sobre el presupuesto (300 € sobre 100 €): retenida
  ORD.Q = await newOrder(U.c6, { estimated: 100, final: 300 });
  await setStatus(ORD.Q, 'delivered');
  c = await commissionOf(ORD.Q);
  check('precio > 2 × presupuesto: retenida con price_above_quote', c && c.status === 'held' && c.flags.includes('price_above_quote') && num(c.amount) === 6, c);
  ORD.Q2 = await newOrder(U.c6, { estimated: 100, final: 150 });
  await setStatus(ORD.Q2, 'delivered');
  c = await commissionOf(ORD.Q2);
  check('precio pactado por encima pero razonable (150 sobre 100): normal', c && c.status === 'pending' && c.flags.length === 0, c);

  // Sin compute_quote (o si falla): se crea igual, sin esa comprobación
  await su(`alter function public.compute_quote(jsonb) rename to compute_quote_fuera`);
  ORD.Q3 = await newOrder(U.c6, { estimated: 100, final: 300 });
  const e2 = await errorOf(setStatus(ORD.Q3, 'delivered'));
  c = await commissionOf(ORD.Q3);
  check('sin compute_quote: la comisión se crea igual (sin price_above_quote)', e2 === null && c && c.status === 'pending' && !c.flags.includes('price_above_quote'), { e2, c });
  await su(`alter function public.compute_quote_fuera(jsonb) rename to compute_quote`);
  check('sin compute_quote: ninguna advertencia', newWarnings().length === 0, newWarnings().map((w) => w.message));

  // Pedido entregado pero SIN pagar: la comisión no está disponible
  ORD.UNPAID = await newOrder(U.c6, { estimated: 100, paid: false });
  await setStatus(ORD.UNPAID, 'delivered');
  await su(`update public.partner_commissions set available_at = now() - interval '1 minute' where request_id = $1`, [ORD.UNPAID]);
  const list = await rpc(U.p2, 'partner_commission_list', [100]);
  check('sin pagar: la lista la muestra como awaiting_payment aunque pasó la espera', list.filter((x) => x.status === 'awaiting_payment').length === 1, list.map((x) => x.status));
  const db2 = await rpc(U.p2, 'partner_dashboard');
  check('sin pagar: no cuenta como disponible en el panel', near(db2.totals.available, 0) && near(db2.totals.awaiting_payment, 2), db2.totals);
  await su(`update public.transport_requests set payment_status = 'paid' where id = $1`, [ORD.UNPAID]);
  const db3 = await rpc(U.p2, 'partner_dashboard');
  check('al pagarse el pedido, pasa a disponible', near(db3.totals.available, 2) && near(db3.totals.awaiting_payment, 0), db3.totals);

  // ----- D2: topes absolutos -----
  markWarnings();
  const deliver = async (opts) => { const id = await newOrder(U.c6, opts); await setStatus(id, 'delivered'); return commissionOf(id); };
  c = await deliver({ estimated: 400 });
  check('D2: base 400 € con tarjeta (> 300) → retenida high_amount', c && c.status === 'held' && c.flags.includes('high_amount') && !c.flags.includes('cash_high'), c);
  c = await deliver({ estimated: 300 });
  check('D2: base 300 € justos con tarjeta → normal', c && c.status === 'pending' && c.flags.length === 0, c);
  c = await deliver({ estimated: 200, method: 'cash' });
  check('D2: efectivo 200 € (> 150) → retenida cash_high', c && c.status === 'held' && c.flags.includes('cash_high') && !c.flags.includes('high_amount'), c);
  c = await deliver({ estimated: 160, method: 'bizum' });
  check('D2: Bizum 160 € → retenida cash_high', c && c.status === 'held' && c.flags.includes('cash_high'), c);
  c = await deliver({ estimated: 150, method: 'cash' });
  check('D2: efectivo 150 € justos → normal', c && c.status === 'pending' && c.flags.length === 0, c);
  c = await deliver({ estimated: 400, method: 'cash' });
  check('D2: efectivo 400 € → las dos marcas', c && c.status === 'held' && c.flags.includes('cash_high') && c.flags.includes('high_amount'), c);
  await setSetting({ max_auto_base: 1000, max_auto_cash_base: 'mucho' });
  c = await deliver({ estimated: 400 });
  check('D2: con max_auto_base = 1000, 400 € con tarjeta → normal', c && c.status === 'pending', c);
  c = await deliver({ estimated: 200, method: 'cash' });
  check('D2: max_auto_cash_base ilegible → vuelve a 150 (200 € en efectivo retenida)', c && c.status === 'held' && c.flags.includes('cash_high'), c);
  await setSetting({ max_auto_base: 300, max_auto_cash_base: 150 });
  const lstD2 = await rpc(U.admin, 'partner_admin_list');
  check('D2: la lista del admin cuenta los importes altos', lstD2.find((x) => x.slug === 'bea').flags.high_amount >= 5, lstD2.find((x) => x.slug === 'bea').flags);

  // ----- D3: ajustes de días con decimales -----
  await setSetting({ hold_days: 15.5, payout_interval_days: '30.9', claim_window_days: 30.0 });
  const d3 = await rpc(U.p2, 'partner_dashboard');
  check('D3: días con decimales se truncan (15,5 → 15; "30.9" → 30)', d3.settings.hold_days === 15 && d3.settings.payout_interval_days === 30, d3.settings);
  const o3 = await newOrder(U.c6, { estimated: 100 });
  const e3 = await errorOf(setStatus(o3, 'delivered'));
  c = await commissionOf(o3);
  const days3 = (await su(`select extract(epoch from (available_at - now())) / 86400 as d from public.partner_commissions where request_id = $1`, [o3])).rows[0]?.d;
  check('D3: con hold_days 15.5 la comisión se crea a 15 días, sin error', e3 === null && c && num(days3) > 14.99 && num(days3) <= 15.0001, { e3, days3 });
  const cr3 = await rpc(U.c5, 'partner_claim_referral', ['no-existe']);
  check('D3: claim_window_days decimal no rompe la atribución', cr3.reason === 'unknown_code', cr3);
  const rp3 = await rpc(U.p2, 'partner_request_payout');
  check('D3: payout_interval_days decimal no rompe la solicitud', rp3.ok === false && rp3.reason === 'no_payout_data', rp3);
  await setSetting({ hold_days: 15, payout_interval_days: 30, claim_window_days: 30 });
  check('D2/D3: sin advertencias', newWarnings().length === 0, newWarnings().map((w) => w.message));
}

// ---------- RLS de las tablas de Partners ----------
{
  let r = await as(U.p1, `select slug from public.partners`);
  check('RLS: Ana solo ve su fila de partners', r.rows.length === 1 && r.rows[0].slug === 'ana-lopez', r.rows);
  r = await as(U.p1, `select * from public.partner_commissions`);
  check('RLS: Ana no lee comisiones directamente', r.rows.length === 0, r.rows.length);
  r = await as(U.p1, `select * from public.partner_referrals`);
  check('RLS: Ana no lee la cartera directamente', r.rows.length === 0, r.rows.length);
  r = await as(U.c1, `select * from public.partners`);
  check('RLS: un cliente no ve ningún comercial', r.rows.length === 0, r.rows.length);
  let e = await errorOf(as(U.p1, `insert into public.partner_commissions (partner_id, kind, base_amount, rate_pct, amount, available_at) select id, 'first', 1, 1, 1, now() from public.partners`));
  check('RLS: Ana no puede insertar comisiones', e !== null && /permission denied/i.test(e), e);
  e = await errorOf(as(U.p1, `update public.partners set status = 'active', slug = 'x-y-z'`));
  check('RLS: Ana no puede actualizar su fila', e !== null && /permission denied/i.test(e), e);
  e = await errorOf(as(U.p1, `delete from public.partner_payouts`));
  check('RLS: Ana no puede borrar solicitudes', e !== null && /permission denied/i.test(e), e);
  r = await as(U.admin, `select count(*)::int as n from public.partner_commissions`);
  check('RLS: el admin lee todas las comisiones', r.rows[0].n > 5, r.rows[0]);
  r = await as(U.admin, `select count(*)::int as n from public.partners`);
  check('RLS: el admin lee todos los comerciales', r.rows[0].n === 2, r.rows[0]);
  r = await as(U.staff, `select count(*)::int as n from public.partners`);
  check('RLS: un empleado (staff) NO ve comerciales (IBAN)', r.rows[0].n === 0, r.rows[0]);
  r = await as(U.staff, `select count(*)::int as n from public.partner_commissions`);
  check('RLS: un empleado (staff) sí ve comisiones', r.rows[0].n > 5, r.rows[0]);
}

// ---------- panel, cartera y lista ----------
{
  const d = await rpc(U.p1, 'partner_dashboard');
  check('panel: responde ok con su slug', d.ok === true && d.partner.slug === 'ana-lopez', d);
  check('panel: 2 clientes (Carla y la cliente sin nombre)', d.clients === 2, d.clients);
  check('panel: serie de 6 meses', Array.isArray(d.monthly) && d.monthly.length === 6, d.monthly);
  // Vivas de Ana: A 5 + B 1.1 + B2 0.9 + D 2 (retenida) + E 2 (retenida) + CASH 1 + NEG 2,50 (first de la cliente sin nombre) = 14,50
  const lastMonth = d.monthly[5];
  check('panel: el mes actual suma lo generado y los meses vacíos van a 0',
    near(lastMonth.amount, 14.5) && lastMonth.services === 7 &&
    d.monthly.slice(0, 5).every((m) => num(m.amount) === 0), d.monthly);
  check('panel: nada disponible todavía (todo en espera de 15 días)', near(d.totals.available, 0), d.totals);
  check('panel: en espera = 10,50 € (A, B, B2, CASH, NEG)', near(d.totals.pending_hold, 10.5), d.totals);
  check('panel: retenido = 4 € (los dos servicios conducidos por Ana)', near(d.totals.held, 4), d.totals);
  check('panel: IBAN enmascarado (solo últimos 4)', d.payout_data.present === true && d.payout_data.iban_last4 === '1332' && !JSON.stringify(d).includes('ES9121'), d.payout_data);
  check('panel: ajustes del programa', d.settings.first_pct === 5 && d.settings.min_payout === 20 && d.settings.hold_days === 15, d.settings);
  check('panel: no puede pedir cobro aún', d.can_request === false, d.can_request);
  check('panel: al comercial no se le enseña lo anulado', !('reversed' in d.totals), d.totals);
  check('panel: total generado sin contar lo anulado (14,50 €)', near(d.totals.generated, 14.5), d.totals);

  const cl = await rpc(U.p1, 'partner_clients');
  check('cartera: 2 filas', cl.length === 2, cl);
  const carla = cl.find((x) => x.first_name === 'Carla');
  check('cartera: solo nombre de pila', !!carla && !JSON.stringify(cl).includes('Gómez'), cl);
  check('cartera: cliente sin nombre sale como "Cliente"', cl.some((x) => x.first_name === 'Cliente'), cl);
  check('D6: cartera con fecha de alta sin hora (AAAA-MM-DD)', cl.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.referred_at)), cl.map((x) => x.referred_at));
  check('cartera: sin ids, emails ni teléfonos',!JSON.stringify(cl).includes(U.c1) && !JSON.stringify(cl).includes('@'), cl);
  check('cartera: servicios entregados de Carla (7)', carla && carla.services === 7, carla);
  check('cartera: comisión viva de Carla = 12 €', carla && near(carla.commission, 12), carla);

  const nop = await rpc(U.c1, 'partner_dashboard');
  check('panel: quien no es comercial (not_partner)', nop.ok === false && nop.reason === 'not_partner', nop);
  const ncl = await rpc(U.c1, 'partner_clients');
  check('cartera: quien no es comercial recibe lista vacía', Array.isArray(ncl) && ncl.length === 0, ncl);

  // Periodo de espera: A y B pasan a disponibles
  await su(`update public.partner_commissions set available_at = now() - interval '1 minute' where request_id = any($1::uuid[])`, [[ORD.A, ORD.B]]);
  const list = await rpc(U.p1, 'partner_commission_list', [50]);
  check('lista: 2 comisiones aparecen como available (calculado)', list.filter((x) => x.status === 'available').length === 2, list.map((x) => x.status));
  check('lista: sin precio del pedido (base) ni ids', list.every((x) => !('base' in x)) && !JSON.stringify(list).includes(ORD.A) && !JSON.stringify(list).includes(U.c1), list[0]);
  check('lista: fechas sin hora (AAAA-MM-DD)', list.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && /^\d{4}-\d{2}-\d{2}$/.test(x.available_at)), list[0]);
  check('lista: claves exactas', JSON.stringify(Object.keys(list[0]).sort()) === JSON.stringify(['amount', 'available_at', 'client_first_name', 'date', 'kind', 'pct', 'status']), Object.keys(list[0]));
  check('lista: respeta el límite', (await rpc(U.p1, 'partner_commission_list', [2])).length === 2);
  const stored = (await su(`select count(*)::int as n from public.partner_commissions where status in ('available', 'awaiting_payment')`)).rows[0].n;
  check('"available"/"awaiting_payment" no se guardan nunca en la tabla', stored === 0, stored);
  const d2 = await rpc(U.p1, 'partner_dashboard');
  check('panel: disponible = 6,10 € tras la espera', near(d2.totals.available, 6.1), d2.totals);
}

// ---------- cobros ----------
let payout1;
{
  let r = await rpc(U.p2, 'partner_request_payout');
  check('cobro: sin IBAN (no_payout_data)', r.reason === 'no_payout_data', r);
  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: por debajo del mínimo (below_minimum)', r.reason === 'below_minimum' && near(r.available, 6.1), r);
  r = await rpc(U.c1, 'partner_request_payout');
  check('cobro: quien no es comercial (not_partner)', r.reason === 'not_partner', r);

  // F es un servicio grande a propósito: se sube el tope automático solo para
  // él (los topes se prueban en su propio bloque).
  await setSetting({ max_auto_base: 5000 });
  ORD.F = await newOrder(U.c1, { estimated: 1000 });
  await setStatus(ORD.F, 'delivered');
  await setSetting({ max_auto_base: 300 });
  ORD.G = await newOrder(U.c1, { estimated: 100 });
  await setStatus(ORD.G, 'delivered');
  // U: entregado, pasada la espera, pero sin pagar → no entra
  ORD.U = await newOrder(U.c1, { estimated: 100, paid: false });
  await setStatus(ORD.U, 'delivered');
  await su(`update public.partner_commissions set available_at = now() - interval '1 minute' where request_id = any($1::uuid[])`, [[ORD.F, ORD.U]]);

  await rpc(U.admin, 'partner_admin_set_status', [ANA, 'blocked']);
  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: comercial bloqueado (inactive)', r.reason === 'inactive', r);
  await rpc(U.admin, 'partner_admin_set_status', [ANA, 'active']);

  const d = await rpc(U.p1, 'partner_dashboard');
  check('panel: ya puede pedir cobro (can_request)', d.can_request === true, d);

  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: solicitud correcta por 26,10 € (A 5 + B 1,10 + F 20)', r.ok === true && near(r.amount, 26.1) && r.commissions === 3, r);
  payout1 = r.payout_id;
  const moved = (await su(`select request_id, status from public.partner_commissions where payout_id = $1`, [payout1])).rows;
  check('cobro: exactamente A, B y F pasan a requested',
    moved.length === 3 && moved.every((m) => m.status === 'requested') &&
    [ORD.A, ORD.B, ORD.F].every((id) => moved.some((m) => m.request_id === id)), moved);
  const g = await commissionOf(ORD.G);
  const e = await commissionOf(ORD.E);
  const u = await commissionOf(ORD.U);
  check('cobro: lo que está en espera, retenido o sin pagar no entra',
    g.status === 'pending' && g.payout_id === null && e.status === 'held' && u.status === 'pending' && u.payout_id === null,
    { g: g.status, e: e.status, u: u.status });
  const po = (await su(`select * from public.partner_payouts where id = $1`, [payout1])).rows[0];
  check('cobro: guarda copia de titular e IBAN', po.holder === 'Ana López' && po.iban === 'ES9121000418450200051332', po);

  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: segunda solicitud con una abierta (pending_request)', r.reason === 'pending_request', r);
  const dup = await errorOf(su(`insert into public.partner_payouts (partner_id, amount) values ($1, 1)`, [ANA]));
  check('cobro: el índice único impide una segunda solicitud abierta', dup !== null && /partner_payouts_one_requested_idx|duplicate key/i.test(dup), dup);

  const own = await as(U.p1, `select id from public.partner_payouts`);
  check('RLS: Ana ve su solicitud de cobro', own.rows.length === 1, own.rows);
  const other = await as(U.p2, `select id from public.partner_payouts`);
  check('RLS: Bea no ve la solicitud de Ana', other.rows.length === 0, other.rows);
  const st = await as(U.staff, `select id from public.partner_payouts`);
  check('RLS: un empleado (staff) no ve solicitudes (IBAN)', st.rows.length === 0, st.rows);
  const src = (await su(`select prosrc from pg_proc where proname = 'partner_request_payout'`)).rows[0].prosrc;
  check('cobro: bloquea la fila del comercial con FOR NO KEY UPDATE', /for no key update/i.test(src));
}

// ---------- admin ----------
{
  const adminFns = [
    ['partner_admin_list', []],
    ['partner_admin_payouts', [null]],
    ['partner_admin_resolve_payout', [payout1, 'paid', null]],
    ['partner_admin_set_status', [ANA, 'blocked']],
    ['partner_admin_release_commission', ['00000000-0000-0000-0000-000000000000', 'release']],
    ['partner_admin_commissions', [ANA]],
  ];
  for (const [fn, args] of adminFns) {
    const e = await errorOf(rpc(U.p1, fn, args));
    check(`admin: un no-admin no puede usar ${fn}`, e !== null && /Solo el administrador/.test(e), e);
  }
  const e2 = await errorOf(rpc(U.staff, 'partner_admin_list', []));
  check('admin: un empleado (staff) tampoco', e2 !== null && /Solo el administrador/.test(e2), e2);
  const still = (await su(`select status from public.partner_payouts where id = $1`, [payout1])).rows[0].status;
  check('admin: el intento del no-admin no cambió nada', still === 'requested', still);

  let r = await rpc(U.admin, 'partner_admin_resolve_payout', [payout1, null, null]);
  check('admin: acción nula al resolver (bad_action)', r.reason === 'bad_action', r);
  r = await rpc(U.admin, 'partner_admin_release_commission', [(await commissionOf(ORD.E)).id, null]);
  check('admin: acción nula al liberar (bad_action)', r.reason === 'bad_action', r);
  r = await rpc(U.admin, 'partner_admin_set_status', [ANA, null]);
  check('admin: estado nulo (bad_status)', r.reason === 'bad_status', r);

  const lst = await rpc(U.admin, 'partner_admin_list');
  const la = lst.find((x) => x.slug === 'ana-lopez');
  check('admin: lista de comerciales con email y avisos', lst.length === 2 && la.email === 'ana@x.test' && la.flags.same_driver >= 2 && la.flags.held === 2, la);
  check('admin: la lista incluye lo anulado en totales', 'reversed' in la.totals && 'awaiting_payment' in la.totals, la.totals);

  let pays = await rpc(U.admin, 'partner_admin_payouts', [null]);
  check('admin: solicitudes con IBAN completo para pagar', pays.length === 1 && pays[0].iban === 'ES9121000418450200051332', pays);
  check('admin: proporción en efectivo y nº same_driver de la solicitud', num(pays[0].cash_share_pct) === 0 && pays[0].same_driver === 0 && pays[0].commissions === 3, pays[0]);
  pays = await rpc(U.admin, 'partner_admin_payouts', ['paid']);
  check('admin: filtro por estado', pays.length === 0, pays);

  await setStatus(ORD.B, 'in_transit');
  let cb = await commissionOf(ORD.B);
  check('des-entregar con la comisión solicitada: se deja y se marca order_undelivered', cb.status === 'requested' && cb.flags.includes('order_undelivered'), cb);

  r = await rpc(U.admin, 'partner_admin_resolve_payout', [payout1, 'rejected', 'IBAN no coincide']);
  check('admin: rechazar solicitud', r.ok === true, r);
  const po = (await su(`select * from public.partner_payouts where id = $1`, [payout1])).rows[0];
  check('admin: solicitud rechazada con nota, fecha y quién', po.status === 'rejected' && po.note === 'IBAN no coincide' && po.resolved_by === U.admin && po.resolved_at, po);
  const back = (await su(`select request_id, status, payout_id, flags from public.partner_commissions where request_id = any($1::uuid[])`, [[ORD.A, ORD.F]])).rows;
  check('admin: al rechazar, las comisiones vuelven a pendiente sin payout_id ni avisos nuevos', back.every((b) => b.status === 'pending' && b.payout_id === null && !b.flags.includes('admin_reversed')), back);
  cb = await commissionOf(ORD.B);
  check('admin: al rechazar, la de un pedido ya no entregado se anula y queda admin_reversed', cb.status === 'reversed' && cb.payout_id === null && cb.flags.includes('admin_reversed'), cb);
  await setStatus(ORD.B, 'delivered');
  check('admin_reversed: re-entregar el pedido NO la revive', (await commissionOf(ORD.B)).status === 'reversed');
  r = await rpc(U.admin, 'partner_admin_resolve_payout', [payout1, 'paid', null]);
  check('admin: no se puede resolver dos veces (not_requested)', r.reason === 'not_requested', r);

  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: tras un rechazo puede volver a pedir enseguida', r.ok === true && near(r.amount, 25), r);
  const payout2 = r.payout_id;

  r = await rpc(U.admin, 'partner_admin_resolve_payout', [payout2, 'paid', 'Transferencia 15/11']);
  check('admin: marcar pagada', r.ok === true, r);
  const paid = (await su(`select status from public.partner_commissions where payout_id = $1`, [payout2])).rows;
  check('admin: al pagar, sus comisiones quedan paid', paid.length === 2 && paid.every((p) => p.status === 'paid'), paid);

  await su(`update public.partner_commissions set available_at = now() - interval '1 minute' where request_id = $1`, [ORD.G]);
  await su(`update public.partner_commissions set available_at = now() - interval '1 minute', status = 'pending' where request_id = $1`, [ORD.D]);
  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: segunda solicitud dentro de 30 días (too_soon)', r.reason === 'too_soon' && r.next_request_at, r);
  await setSetting({ payout_interval_days: 30.9 });
  const eInt = await errorOf(rpc(U.p1, 'partner_request_payout'));
  const dInt = await rpc(U.p1, 'partner_dashboard');
  check('D3: payout_interval_days 30.9 no rompe la solicitud ni el panel', eInt === null && dInt.ok === true && dInt.next_request_at, { eInt });
  await setSetting({ payout_interval_days: 30 });
  await su(`update public.partner_payouts set requested_at = now() - interval '31 days' where id = $1`, [payout2]);
  r = await rpc(U.p1, 'partner_request_payout');
  check('cobro: pasados 30 días el plazo se cumple (y vuelve a mirar el mínimo)', r.reason === 'below_minimum' && near(r.available, 4), r);

  await setStatus(ORD.F, 'cancelled');
  const cf = await commissionOf(ORD.F);
  check('des-entregar con la comisión pagada: sigue paid y marcada', cf.status === 'paid' && cf.flags.includes('order_undelivered'), cf);
  await setStatus(ORD.F, 'delivered');
  const cf2 = await commissionOf(ORD.F);
  check('re-entregar con la comisión pagada: no se recalcula', cf2.status === 'paid' && num(cf2.amount) === 20, cf2);

  const ce = await commissionOf(ORD.E);
  r = await rpc(U.admin, 'partner_admin_release_commission', [ce.id, 'release']);
  check('admin: liberar una retenida la deja pendiente', r.ok === true && (await commissionOf(ORD.E)).status === 'pending', r);
  r = await rpc(U.admin, 'partner_admin_release_commission', [ce.id, 'release']);
  check('admin: liberar una que no está retenida (bad_status)', r.reason === 'bad_status', r);
  r = await rpc(U.admin, 'partner_admin_release_commission', [ce.id, 'reverse']);
  const ce2 = await commissionOf(ORD.E);
  check('admin: anular una pendiente la marca admin_reversed', r.ok === true && ce2.status === 'reversed' && ce2.flags.includes('admin_reversed'), ce2);
  await setStatus(ORD.E, 'in_transit');
  await setStatus(ORD.E, 'delivered');
  check('admin_reversed: des-entregar y re-entregar NO la revive', (await commissionOf(ORD.E)).status === 'reversed');
  r = await rpc(U.admin, 'partner_admin_release_commission', [cf2.id, 'reverse']);
  check('admin: no se anula una pagada (bad_status)', r.reason === 'bad_status', r);
  r = await rpc(U.admin, 'partner_admin_release_commission', [ce.id, 'otra']);
  check('admin: acción desconocida (bad_action)', r.reason === 'bad_action', r);
  r = await rpc(U.admin, 'partner_admin_set_status', [ANA, 'vacaciones']);
  check('admin: estado desconocido (bad_status)', r.reason === 'bad_status', r);

  const all = await rpc(U.admin, 'partner_admin_commissions', [ANA]);
  check('admin: detalle de comisiones con avisos y pedido', all.length > 5 && all.some((x) => x.flags.includes('order_undelivered')) && all.every((x) => x.slug === 'ana-lopez'), all.length);
  check('admin: el detalle trae effective_status y delivered_at', all.some((x) => x.effective_status === 'awaiting_payment') && all.every((x) => x.delivered_at), all.map((x) => x.effective_status));
  const everything = await rpc(U.admin, 'partner_admin_commissions', [null]);
  check('admin: detalle de todas las comisiones si no se indica comercial', everything.length > all.length, everything.length);
}

// ---------- borrado de pedidos y de cuentas ----------
{
  const cg = await commissionOf(ORD.G);
  await su(`delete from public.transport_requests where id = $1`, [ORD.G]);
  const after = (await su(`select status, request_id from public.partner_commissions where id = $1`, [cg.id])).rows[0];
  check('borrar pedido: su comisión pendiente se anula y se conserva sin pedido', after.status === 'reversed' && after.request_id === null, after);
  const cf = await commissionOf(ORD.F);
  await su(`delete from public.transport_requests where id = $1`, [ORD.F]);
  const afterF = (await su(`select status, flags from public.partner_commissions where id = $1`, [cf.id])).rows[0];
  check('borrar pedido: la pagada se conserva y se marca order_deleted', afterF.status === 'paid' && afterF.flags.includes('order_deleted'), afterF);

  const before = (await su(`select count(*)::int as n from public.partner_commissions where client_user_id = $1`, [U.c1])).rows[0].n;
  await su(`delete from auth.users where id = $1`, [U.c1]);
  const ref = (await su(`select count(*)::int as n from public.partner_referrals where client_user_id = $1`, [U.c1])).rows[0].n;
  const orphan = (await su(`select count(*)::int as n from public.partner_commissions where client_user_id is null`)).rows[0].n;
  check('borrar cliente: sale de la cartera (cascade)', ref === 0, ref);
  check('borrar cliente: sus comisiones se conservan sin cliente', before > 0 && orphan >= before, { before, orphan });
  const cl = await rpc(U.p1, 'partner_clients');
  check('borrar cliente: la cartera de Ana ya no lo muestra', cl.length === 1, cl);
  const list = await rpc(U.p1, 'partner_commission_list');
  check('borrar cliente: sus comisiones salen como "Cliente"', list.some((x) => x.client_first_name === 'Cliente'), list.map((x) => x.client_first_name));

  const e1 = await errorOf(su(`delete from auth.users where id = $1`, [U.drv]));
  check('borrar conductor: no lo impide ninguna clave de comisiones', e1 === null, e1);

  const e2 = await errorOf(su(`delete from auth.users where id = $1`, [U.admin]));
  const rb = (await su(`select count(*)::int as n from public.partner_payouts where resolved_by is not null`)).rows[0].n;
  check('borrar admin: no lo impide y resolved_by queda vacío', e2 === null && rb === 0, { e2, rb });
  await addUser(U.admin, 'admin2@x.test', 'Admin Dos', 'admin');

  const e3 = await errorOf(su(`delete from auth.users where id = $1`, [U.p2]));
  const pb = (await su(`select user_id from public.partners where id = $1`, [BEA])).rows[0];
  check('borrar comercial: el comercial se conserva sin usuario', e3 === null && pb && pb.user_id === null, { e3, pb });
  const pub = await rpc(null, 'partner_public', ['bea']);
  check('borrar comercial: su enlace público responde como desconocido', pub.active === false && pub.first_name === null, pub);
  const cr = await rpc(U.c7, 'partner_claim_referral', ['bea']);
  check('borrar comercial: su enlace ya no atribuye (unknown_code)', cr.reason === 'unknown_code', cr);
  const ss = await rpc(U.admin, 'partner_admin_set_status', [BEA, 'active']);
  check('borrar comercial: el admin no puede reactivarlo sin usuario (no_user)', ss.reason === 'no_user', ss);
  const oc = await newOrder(U.c6, { driver: U.drv2 });
  await setStatus(oc, 'delivered');
  const coc = await commissionOf(oc);
  check('borrar comercial: sus clientes generan comisión RETENIDA (partner_blocked)', coc && coc.status === 'held' && coc.flags.includes('partner_blocked'), coc);
  const lst = await rpc(U.admin, 'partner_admin_list');
  check('borrar comercial: la lista del admin lo muestra sin usuario', lst.some((x) => x.slug === 'bea' && x.has_user === false && x.email === null), lst.map((x) => [x.slug, x.has_user]));
}

// ---------- solicitud con efectivo y mismo conductor: lo que ve el admin ----------
{
  // Quedan disponibles de Ana: D (2 €, tarjeta, conducida por Ana) y CASH (1 €, efectivo).
  await setSetting({ min_payout: 1 });
  await su(`update public.partner_commissions set available_at = now() - interval '1 minute' where request_id = $1`, [ORD.CASH]);
  const r = await rpc(U.p1, 'partner_request_payout');
  check('cobro con efectivo y mismo conductor: solicitud de 3 €', r.ok === true && near(r.amount, 3) && r.commissions === 2, r);
  const pays = await rpc(U.admin, 'partner_admin_payouts', ['requested']);
  check('admin: la solicitud muestra 33,3 % en efectivo y 1 same_driver',
    pays.length === 1 && num(pays[0].cash_share_pct) === 33.3 && num(pays[0].cash_amount) === 1 && pays[0].same_driver === 1, pays[0]);
  await setSetting({ min_payout: 20 });
}

// ---------- lanzamiento privado: encendido pero NO público ----------
// Usuarios propios de este bloque (no aparecen en ningún otro escenario).
{
  markWarnings();
  const P = {
    staff: '00000000-0000-0000-0000-0000000000a3', // empleada que prueba el programa
    user: '00000000-0000-0000-0000-0000000000e1', // usuario normal
    user2: '00000000-0000-0000-0000-0000000000e2', // otro usuario normal
    client: '00000000-0000-0000-0000-0000000000c9', // cliente de prueba, cuenta nueva
  };
  await addUser(P.staff, 'sara@x.test', 'Sara Staff', 'staff');
  await addUser(P.user, 'nora@x.test', 'Nora Normal');
  await addUser(P.user2, 'olga@x.test', 'Olga Otra', 'driver');
  await addUser(P.client, 'tina@x.test', 'Tina Test');

  await setSetting({ enabled: true, public: false });
  let r = await rpc(P.user, 'partner_activate', ['Nora Normal', 'nora']);
  check('privado: un usuario normal no puede darse de alta (disabled)', r.ok === false && r.reason === 'disabled', r);
  r = await rpc(P.user2, 'partner_activate', ['Olga Otra', 'olga']);
  check('privado: un conductor tampoco (disabled)', r.ok === false && r.reason === 'disabled', r);
  r = await rpc(P.staff, 'partner_activate', ['Sara Staff', 'sara-staff']);
  check('privado: el personal (staff) sí puede darse de alta', r.ok === true && r.slug === 'sara-staff', r);
  const pubSara = await rpc(null, 'partner_public', ['sara-staff']);
  check('privado: partner_public no cambia (el enlace de prueba funciona)', pubSara.active === true && pubSara.first_name === 'Sara', pubSara);

  r = await rpc(P.client, 'partner_claim_referral', ['sara-staff']);
  check('privado: la atribución funciona aunque no sea público', r.ok === true, r);
  const SARA = (await su(`select id from public.partners where slug = 'sara-staff'`)).rows[0].id;
  const ref = (await su(`select partner_id from public.partner_referrals where client_user_id = $1`, [P.client])).rows[0];
  check('privado: el cliente de prueba queda en la cartera de la empleada', ref && ref.partner_id === SARA, ref);

  const o = await newOrder(P.client, { estimated: 100 });
  await setStatus(o, 'delivered');
  const c = await commissionOf(o);
  check('privado: la comisión nace normal (5 %, pendiente, sin avisos de programa)',
    c && c.kind === 'first' && num(c.amount) === 5 && c.status === 'pending' && !c.flags.includes('program_disabled'), c);

  let d = await rpc(P.staff, 'partner_dashboard');
  check('privado: el panel dice programa encendido y no público',
    d.ok === true && d.program_enabled === true && d.program_public === false, { e: d.program_enabled, p: d.program_public });

  // Abrirlo a todo el mundo devuelve el comportamiento abierto.
  await setSetting({ public: true });
  r = await rpc(P.user, 'partner_activate', ['Nora Normal', 'nora']);
  check('público: con public = true un usuario normal ya puede darse de alta', r.ok === true && r.slug === 'nora', r);
  d = await rpc(P.staff, 'partner_dashboard');
  check('público: el panel dice program_public = true', d.program_public === true, d.program_public);

  // Con el programa apagado, ni el personal puede darse de alta.
  await setSetting({ enabled: false, public: false });
  r = await rpc(P.user2, 'partner_activate', ['Olga Otra', 'olga']);
  check('apagado: un usuario normal no puede darse de alta', r.reason === 'disabled', r);
  await su(`update public.profiles set role = 'staff' where id = $1`, [P.user2]);
  r = await rpc(P.user2, 'partner_activate', ['Olga Otra', 'olga']);
  check('apagado: el personal tampoco (disabled)', r.reason === 'disabled', r);
  await su(`update public.profiles set role = 'driver' where id = $1`, [P.user2]);

  // Saneado de "public": ausente o ilegible = no público.
  const settings = async () => (await su(`select public.partner_program_settings() as s`)).rows[0].s;
  await setSetting({ enabled: true, public: true });
  check('saneado: public = true se lee como público', (await settings()).public === true);
  await setSetting({ public: ' TRUE ' });
  check('saneado: public = " TRUE " (texto) se lee como público', (await settings()).public === true);
  await setSetting({ public: 'false' });
  check('saneado: public = "false" (texto) se lee como no público', (await settings()).public === false);
  await setSetting({ public: 'quizás' });
  check('saneado: un public ilegible cuenta como no público', (await settings()).public === false);
  await setSetting({ public: 1 });
  check('saneado: public = 1 (número) cuenta como no público', (await settings()).public === false);
  await dropSettingKeys(['public']);
  check('saneado: sin la clave public, no público', (await settings()).public === false);
  check('saneado: sin la clave public, el programa sigue encendido', (await settings()).enabled === true);
  const backup = (await su(`select value from public.app_settings where key = 'partner_program'`)).rows[0].value;
  await su(`delete from public.app_settings where key = 'partner_program'`);
  const none = await settings();
  check('saneado: sin la fila, apagado y no público', none.enabled === false && none.public === false, none);
  await su(`insert into public.app_settings (key, value) values ('partner_program', $1::jsonb)`, [JSON.stringify(backup)]);

  // Se deja como estaba para el resto de la prueba (abierto).
  await setSetting({ enabled: true, public: true });
  check('privado: sin advertencias', newWarnings().length === 0, newWarnings().map((w) => w.message));
}

// ---------- permisos de todas las funciones nuevas (catálogo) ----------
{
  const fns = (await su(`
    select p.proname, p.oid::regprocedure::text as sig, p.prosecdef,
           coalesce(array_to_string(p.proconfig, ','), '') as cfg,
           has_function_privilege('anon', p.oid, 'execute') as anon_x,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_x
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'partner%' or p.proname like 'zz_partner%')`)).rows;
  check('catálogo: 20 funciones nuevas de Partners', fns.length === 20, fns.map((f) => f.proname));
  const internal = ['partner_program_settings', 'partner_first_name', 'partner_totals', 'partner_effective_status', 'zz_partner_commission', 'zz_partner_commission_on_delete'];
  const badAnon = fns.filter((f) => f.anon_x !== (f.proname === 'partner_public'));
  check('catálogo: anon solo puede ejecutar partner_public', badAnon.length === 0, badAnon.map((f) => f.sig));
  const badAuth = fns.filter((f) => f.auth_x === internal.includes(f.proname));
  check('catálogo: authenticated ejecuta las RPC y ninguna auxiliar ni de trigger', badAuth.length === 0, badAuth.map((f) => f.sig));
  const badDef = fns.filter((f) => !['partner_program_settings', 'partner_first_name'].includes(f.proname) && !f.prosecdef);
  check('catálogo: RPC y triggers son security definer', badDef.length === 0, badDef.map((f) => f.sig));
  const badPath = fns.filter((f) => !/search_path=public/.test(f.cfg));
  check('catálogo: todas fijan search_path = public', badPath.length === 0, badPath.map((f) => [f.sig, f.cfg]));

  const f29 = (await su(`
    select p.proname, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as cfg,
           has_function_privilege('anon', p.oid, 'execute') as anon_x,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_x
      from pg_proc p where p.proname in ('protect_order_core_fields', 'order_actor_is_verified_driver')`)).rows;
  const core = f29.find((f) => f.proname === 'protect_order_core_fields');
  const ver = f29.find((f) => f.proname === 'order_actor_is_verified_driver');
  check('catálogo 0029: el trigger es security invoker y nadie lo ejecuta a mano', core && !core.prosecdef && !core.anon_x && !core.auth_x && /search_path=public/.test(core.cfg), core);
  check('catálogo 0029: el auxiliar de conductor verificado solo para authenticated', ver && ver.prosecdef && !ver.anon_x && ver.auth_x, ver);
}

// ---------- advertencias en toda la prueba ----------
check('en toda la prueba solo hay el WARNING provocado a propósito', warnings().length === 1, warnings().map((w) => w.message));

// ---------- aplicar las migraciones otra vez con datos ----------
{
  await setSetting({ min_payout: 25 });
  const snap = async () => (await su(`
    select (select count(*) from public.partners)::int as p,
           (select count(*) from public.partner_referrals)::int as r,
           (select count(*) from public.partner_commissions)::int as c,
           (select count(*) from public.partner_payouts)::int as y,
           (select coalesce(sum(amount), 0) from public.partner_commissions)::text as s,
           (select string_agg(status, ',' order by id) from public.partner_commissions) as st,
           (select count(*) from public.transport_requests)::int as o`)).rows[0];
  const before = await snap();
  const e1 = await errorOf(suExec(sql0029));
  const e2 = await errorOf(suExec(sql0028));
  const after = await snap();
  check('reaplicar 0029 y 0028 con datos: sin errores', e1 === null && e2 === null, { e1, e2 });
  check('reaplicar: datos intactos', JSON.stringify(before) === JSON.stringify(after), { before, after });
  const s = (await su(`select value from public.app_settings where key = 'partner_program'`)).rows[0].value;
  check('reaplicar: no pisa los ajustes editados', s.min_payout === 25, s);
  const trg = (await su(`select count(*)::int as n from pg_trigger where tgname like 'zz_partner_commission%' or tgname = 'trg_protect_order_core_fields'`)).rows[0].n;
  check('reaplicar: los triggers no se duplican', trg === 3, trg);
  const e3 = await errorOf(as(null, `select * from public.partners`));
  check('reaplicar: anónimo sigue sin leer partners', e3 !== null, e3);
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
