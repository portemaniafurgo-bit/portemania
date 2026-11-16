-- ============================================================
-- 0028 — ClicyVoy Partners (comerciales)
--
-- Cualquiera (cliente, conductor o nadie) puede hacerse comercial: comparte su
-- enlace y cobra una comisión por cada servicio ENTREGADO de los clientes que
-- trae, para siempre. 5 % del primer servicio de cada cliente y 2 % de los
-- siguientes (sin propina); porcentajes y reglas en app_settings.partner_program
-- (editables por el admin desde su política de escritura de siempre).
--
--   · La comisión nace al entregar (trigger zz_partner_commission) y espera
--     hold_days (15) antes de poder cobrarse. "Disponible" NO se guarda: es
--     status = 'pending', available_at <= now() y el pedido sigue entregado y
--     PAGADO (payment_status = 'paid').
--   · Si el pedido deja de estar entregado, la comisión se anula ('reversed');
--     si ya estaba solicitada o pagada, se deja y se marca para el admin.
--   · Antifraude: sin comisión si el conductor es el propio cliente; RETENIDA
--     ('held') para el admin si el conductor es el propio comercial, si el
--     precio final se dispara sobre el presupuesto, o si el comercial estaba
--     bloqueado / el programa apagado al entregar. Lo que el admin anula no
--     revive.
--   · Requiere la 0029 (campos clave del pedido protegidos): sin ella, un
--     cliente podía tocar el precio o darse el pedido por entregado.
--   · Cobro: el comercial pide (mínimo 20 €, una vez cada 30 días, con IBAN);
--     el admin paga por transferencia y lo marca, o lo rechaza.
--
-- Las cuatro tablas son de SOLO LECTURA por RLS. Toda escritura pasa por las
-- funciones de abajo (security definer) o por el trigger.
--
-- REGLA DE ESTA MIGRACIÓN: es puramente ADITIVA. No recrea ni borra ninguna
-- función, trigger ni política de la 0001–0027 (producción tiene versiones más
-- nuevas de algunas, p. ej. protect_order_payment_fields). Solo objetos nuevos
-- con nombre nuevo. Se puede aplicar dos veces sin romper nada.
--
-- APLICAR: todo el fichero va en UNA transacción con su propio
-- «set local lock_timeout = '3s'» dentro (los triggers nuevos toman un bloqueo
-- sobre transport_requests). Si la tabla está ocupada, falla a los 3 s en vez
-- de dejar en cola los accesos y los pedidos; el fallo deshace TODO (no queda
-- nada a medias) y basta con volver a lanzarlo.
-- ============================================================

begin;
set local lock_timeout = '3s';

-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------

-- El comercial. user_id queda NULL si borra su cuenta: un comercial sin usuario
-- se trata como INACTIVO en todas las funciones (no capta ni cobra).
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  user_id uuid unique references auth.users (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,30}$' and slug ~ '[a-z0-9]{3}'),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  payout_holder text,
  payout_iban text
);

comment on table public.partners is
  'Comerciales de ClicyVoy Partners. Lectura: el propio usuario o staff. Escritura solo por RPC (partner_activate, partner_update_payout_data, partner_admin_set_status).';
comment on column public.partners.slug is
  'Código del enlace /comercial/<slug>. Minúsculas, cifras y guiones, 3–30, con al menos 3 letras o cifras seguidas.';
comment on column public.partners.user_id is
  'Usuario dueño. NULL si borró su cuenta: entonces el comercial cuenta como inactivo.';

-- Un cliente = un comercial, para siempre. Se borra con la cuenta del cliente.
create table if not exists public.partner_referrals (
  client_user_id uuid primary key references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  source text not null default 'link' check (source in ('link', 'code')),
  created_date timestamptz not null default now()
);

comment on table public.partner_referrals is
  'Cartera: qué comercial trajo a cada cliente. Solo staff la lee directamente; el comercial la ve por partner_clients() sin datos personales.';

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  amount numeric not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  note text,
  holder text,
  iban text
);

comment on table public.partner_payouts is
  'Solicitudes de cobro del comercial. holder/iban son COPIA del momento de pedir (si luego cambia el IBAN, esta solicitud no cambia).';

-- Como mucho UNA solicitud abierta por comercial (también frena dos peticiones
-- simultáneas aunque fallara el bloqueo de la fila del comercial).
create unique index if not exists partner_payouts_one_requested_idx
  on public.partner_payouts (partner_id)
  where status = 'requested';

create index if not exists partner_payouts_partner_idx
  on public.partner_payouts (partner_id, requested_at desc);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  -- Momento (servidor) de la última entrega que la generó o la revivió.
  generated_at timestamptz not null default now(),
  -- Sello de entrega del SERVIDOR (delivered_stamped_at de la 0027: solo la
  -- primera entrega) o, si no existe, el momento de generarla. Decide qué
  -- servicio fue el primero del cliente.
  delivered_at timestamptz not null default now(),
  partner_id uuid not null references public.partners (id),
  -- Si el admin borra el pedido, la comisión se conserva (rastro contable) y el
  -- trigger zz_partner_commission_on_delete la anula o la marca antes.
  request_id uuid unique references public.transport_requests (id) on delete set null,
  client_user_id uuid references auth.users (id) on delete set null,
  driver_id uuid,
  payment_method text,
  kind text not null check (kind in ('first', 'repeat')),
  base_amount numeric not null,
  rate_pct numeric not null,
  amount numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'requested', 'paid', 'reversed', 'held')),
  available_at timestamptz not null,
  payout_id uuid references public.partner_payouts (id),
  flags text[] not null default '{}'
);

comment on table public.partner_commissions is
  'Una comisión por pedido entregado de un cliente atribuido. status: pending (disponible si available_at <= now() Y el pedido sigue entregado y pagado), held (retenida para revisión del admin), requested, paid, reversed.';
comment on column public.partner_commissions.flags is
  'Avisos para el admin: same_driver (el conductor era el propio comercial), cash, price_above_quote (precio muy por encima del presupuesto), high_amount (base por encima de max_auto_base), cash_high (efectivo/Bizum por encima de max_auto_cash_base), partner_blocked, program_disabled, order_undelivered (dejó de estar entregado con la comisión ya pedida o pagada), order_deleted, admin_reversed (anulada por el admin: no revive nunca).';
comment on column public.partner_commissions.available_at is
  'Fecha desde la que se puede cobrar: hora del SERVIDOR al entregar + hold_days. Nunca delivery_time (lo escribe el conductor).';

create index if not exists partner_commissions_partner_status_idx
  on public.partner_commissions (partner_id, status);
create index if not exists partner_commissions_client_idx
  on public.partner_commissions (client_user_id);
create index if not exists partner_commissions_payout_idx
  on public.partner_commissions (payout_id);
create index if not exists partner_referrals_partner_idx
  on public.partner_referrals (partner_id);

-- ------------------------------------------------------------
-- 2. RLS: solo lectura. Ninguna política de insert/update/delete.
-- ------------------------------------------------------------
alter table public.partners enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts enable row level security;

-- partners y partner_payouts llevan IBAN y titular: solo el propio comercial o
-- el ADMIN (no los empleados 'staff').
drop policy if exists partners_select_own_or_admin on public.partners;
create policy partners_select_own_or_admin on public.partners for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists partner_referrals_select_staff on public.partner_referrals;
create policy partner_referrals_select_staff on public.partner_referrals for select
  using (public.is_staff());

drop policy if exists partner_commissions_select_staff on public.partner_commissions;
create policy partner_commissions_select_staff on public.partner_commissions for select
  using (public.is_staff());

drop policy if exists partner_payouts_select_own_or_admin on public.partner_payouts;
create policy partner_payouts_select_own_or_admin on public.partner_payouts for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.partners p
       where p.id = partner_id and p.user_id = auth.uid()
    )
  );

-- Además de RLS, sin permisos de escritura desde el navegador (defensa en
-- profundidad frente a una política futura mal puesta). anon no lee nada.
revoke all on table public.partners, public.partner_referrals,
  public.partner_commissions, public.partner_payouts from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.partners, public.partner_referrals,
  public.partner_commissions, public.partner_payouts from authenticated;
grant select on table public.partners, public.partner_referrals,
  public.partner_commissions, public.partner_payouts to authenticated;

-- ------------------------------------------------------------
-- 3. Ajustes del programa
-- ------------------------------------------------------------
-- Clave PROPIA (no dentro de 'tariffs': su formulario pisa las claves que no
-- conoce). app_settings se lee en público; estos valores pueden verse.
--
-- Lanzamiento PRIVADO: nace encendido ("enabled") pero NO abierto al público
-- ("public": false). Mientras no sea público solo el personal (is_staff) puede
-- darse de alta como comercial y la web y la app no enseñan el programa a
-- nadie más; la atribución de clientes, las comisiones y los cobros funcionan
-- igual, para poder probarlo de punta a punta con cuentas del equipo. El admin
-- lo abre a todo el mundo desde sus ajustes cuando el gestor y los textos
-- legales estén listos.
insert into public.app_settings (key, value) values ('partner_program', '{
  "enabled": true,
  "public": false,
  "first_pct": 5,
  "repeat_pct": 2,
  "hold_days": 15,
  "min_payout": 20,
  "payout_interval_days": 30,
  "claim_window_days": 30,
  "hold_same_driver": true,
  "max_price_quote_ratio": 2,
  "max_auto_base": 300,
  "max_auto_cash_base": 150
}'::jsonb)
on conflict (key) do nothing;

/**
 * Ajustes del programa, SANEADOS: cada valor que no sea un número dentro de su
 * rango (o un sí/no) se sustituye por el de por defecto, así un ajuste mal
 * escrito en el panel nunca rompe una entrega ni regala porcentajes absurdos.
 * Si la fila falta o no es un objeto, el programa cuenta como APAGADO; un
 * "enabled" ilegible, también. "public" (abierto a todo el mundo) ausente o
 * ilegible = NO público (solo el personal puede darse de alta).
 * hold_same_driver acepta el nombre antiguo hold_same_driver_cash.
 */
create or replace function public.partner_program_settings()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_defaults jsonb := '{"enabled": true, "public": false, "first_pct": 5, "repeat_pct": 2, "hold_days": 15,
    "min_payout": 20, "payout_interval_days": 30, "claim_window_days": 30,
    "hold_same_driver": true, "max_price_quote_ratio": 2,
    "max_auto_base": 300, "max_auto_cash_base": 150}'::jsonb;
  -- clave: [mínimo, máximo]
  v_ranges jsonb := '{"first_pct": [0, 50], "repeat_pct": [0, 50], "hold_days": [0, 365],
    "min_payout": [0, 100000], "payout_interval_days": [0, 365],
    "claim_window_days": [0, 3650], "max_price_quote_ratio": [1, 100],
    "max_auto_base": [0, 100000], "max_auto_cash_base": [0, 100000]}'::jsonb;
  v_value jsonb;
  v_out jsonb;
  v_key text;
  v_bounds jsonb;
  v_text text;
  v_num numeric;
  v_bool jsonb;
begin
  select value into v_value from public.app_settings where key = 'partner_program';
  if v_value is null or jsonb_typeof(v_value) <> 'object' then
    return v_defaults || '{"enabled": false}'::jsonb;
  end if;

  v_out := v_defaults;

  -- enabled: ilegible = apagado (lo prudente).
  if v_value ? 'enabled' then
    v_bool := v_value->'enabled';
    v_out := v_out || jsonb_build_object('enabled',
      case when jsonb_typeof(v_bool) = 'boolean' then v_bool
           when lower(btrim(v_value->>'enabled')) in ('true', 'false') then to_jsonb(lower(btrim(v_value->>'enabled'))::boolean)
           else 'false'::jsonb end);
  end if;

  -- public: ausente o ilegible = no público (lo prudente). Los textos se leen
  -- sin espacios alrededor (" true " = sí), como en la web y la app.
  if v_value ? 'public' then
    v_bool := v_value->'public';
    v_out := v_out || jsonb_build_object('public',
      case when jsonb_typeof(v_bool) = 'boolean' then v_bool
           when lower(btrim(v_value->>'public')) in ('true', 'false') then to_jsonb(lower(btrim(v_value->>'public'))::boolean)
           else 'false'::jsonb end);
  end if;

  -- hold_same_driver (o el nombre antiguo): un null cuenta como ausente (se
  -- mira el nombre antiguo); ilegible = retener (lo prudente). Igual que el
  -- `??` de normalizeProgram en la web y la app.
  v_bool := coalesce(nullif(v_value->'hold_same_driver', 'null'::jsonb),
                     nullif(v_value->'hold_same_driver_cash', 'null'::jsonb));
  if v_bool is not null then
    v_out := v_out || jsonb_build_object('hold_same_driver',
      case when jsonb_typeof(v_bool) = 'boolean' then v_bool
           when lower(btrim(v_bool #>> '{}')) in ('true', 'false') then to_jsonb(lower(btrim(v_bool #>> '{}'))::boolean)
           else 'true'::jsonb end);
  end if;

  for v_key, v_bounds in select key, value from jsonb_each(v_ranges) loop
    v_text := btrim(coalesce(v_value->>v_key, ''));
    if v_text ~ '^-?[0-9]+(\.[0-9]+)?$' then
      v_num := v_text::numeric;
      -- Los días son enteros: 15.5 se queda en 15 (nunca un error).
      if v_key in ('hold_days', 'payout_interval_days', 'claim_window_days') then
        v_num := trunc(v_num);
      end if;
      if v_num between (v_bounds->>0)::numeric and (v_bounds->>1)::numeric then
        v_out := v_out || jsonb_build_object(v_key, v_num);
      end if;
    end if;
  end loop;

  return v_out;
end;
$$;

revoke all on function public.partner_program_settings() from public, anon, authenticated;

/** Nombre de pila: primera palabra; 'Cliente' si no hay nada. */
create or replace function public.partner_first_name(p_full_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(split_part(btrim(coalesce(p_full_name, '')), ' ', 1), ''), 'Cliente');
$$;

revoke all on function public.partner_first_name(text) from public, anon, authenticated;

/**
 * Estado EFECTIVO de una comisión. Solo 'pending' se desdobla:
 *   · 'awaiting_payment' si su pedido ya no existe, no está entregado o no
 *     está pagado (un efectivo sin confirmar, una tarjeta sin cobrar);
 *   · 'available' si además ya pasó el periodo de espera;
 *   · 'pending' mientras dura la espera.
 * Es la ÚNICA definición de "disponible": la usan el panel, la lista y la
 * solicitud de cobro.
 */
create or replace function public.partner_effective_status(
  p_status text, p_available_at timestamptz, p_request_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_status <> 'pending' then return p_status; end if;
  if p_request_id is null or not exists (
    select 1 from public.transport_requests t
     where t.id = p_request_id and t.status = 'delivered' and t.payment_status = 'paid'
  ) then
    return 'awaiting_payment';
  end if;
  if p_available_at <= now() then return 'available'; end if;
  return 'pending';
end;
$$;

revoke all on function public.partner_effective_status(text, timestamptz, uuid) from public, anon, authenticated;

/** Totales de un comercial. Lo anulado no suma en ningún total salvo 'reversed'. */
create or replace function public.partner_totals(p_partner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated',        coalesce(sum(s.amount) filter (where s.eff <> 'reversed'), 0),
    'available',        coalesce(sum(s.amount) filter (where s.eff = 'available'), 0),
    'pending_hold',     coalesce(sum(s.amount) filter (where s.eff = 'pending'), 0),
    'awaiting_payment', coalesce(sum(s.amount) filter (where s.eff = 'awaiting_payment'), 0),
    'held',             coalesce(sum(s.amount) filter (where s.eff = 'held'), 0),
    'requested',        coalesce(sum(s.amount) filter (where s.eff = 'requested'), 0),
    'paid',             coalesce(sum(s.amount) filter (where s.eff = 'paid'), 0),
    'reversed',         coalesce(sum(s.amount) filter (where s.eff = 'reversed'), 0),
    'services',         count(*) filter (where s.eff <> 'reversed')
  )
  from (
    select c.amount,
           public.partner_effective_status(c.status, c.available_at, c.request_id) as eff
      from public.partner_commissions c
     where c.partner_id = p_partner_id
  ) s;
$$;

revoke all on function public.partner_totals(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Trigger: la comisión nace al entregar y se anula al "desentregar"
-- ------------------------------------------------------------
/**
 * AFTER UPDATE OF status en transport_requests.
 *
 * TODO el cuerpo va dentro de un bloque con exception: un fallo aquí (un
 * ajuste roto, un desglose raro) deja un WARNING en el log y la entrega sigue
 * adelante. Nunca puede bloquear que un conductor marque un servicio como
 * entregado.
 */
create or replace function public.zz_partner_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_ref public.partner_referrals%rowtype;
  v_partner public.partners%rowtype;
  v_existing public.partner_commissions%rowtype;
  v_base numeric;
  v_penalty numeric;
  v_quote numeric;
  v_ratio numeric;
  v_delivered_at timestamptz;
  v_kind text;
  v_pct numeric;
  v_amount numeric;
  v_flags text[];
  v_status text;
  v_available_at timestamptz;
begin
  begin
    if new.status = 'delivered' and old.status is distinct from 'delivered' then
      if new.created_by_id is null then return new; end if;
      -- Sin conductor, o el conductor es el propio cliente: no hay comisión.
      if new.driver_id is null or new.driver_id = new.created_by_id then return new; end if;

      -- Bloquea la fila de la cartera: dos entregas simultáneas del mismo
      -- cliente se ordenan (no pueden ser las dos 'first').
      select * into v_ref from public.partner_referrals
       where client_user_id = new.created_by_id
       for update;
      if v_ref.client_user_id is null then return new; end if;

      select * into v_partner from public.partners where id = v_ref.partner_id;
      if v_partner.id is null then return new; end if;

      select * into v_existing from public.partner_commissions
       where request_id = new.id
       for update;
      -- Ya existe y no está anulada (pendiente, retenida, pedida o pagada): no se toca.
      if v_existing.id is not null and v_existing.status <> 'reversed' then
        return new;
      end if;
      -- Lo que anuló el admin no revive nunca.
      if v_existing.id is not null and 'admin_reversed' = any (v_existing.flags) then
        return new;
      end if;

      v_settings := public.partner_program_settings();

      -- Base: precio final (o estimado). La propina va aparte (tip_amount): no
      -- se suma. Defensa que no estorba: si el desglose trae una línea
      -- 'pending_cancellation' (la 0020 la escribía; el set_request_price
      -- vigente en producción, el de la 0026, ya NO), se resta: esa
      -- penalización es de ClicyVoy, no del servicio.
      v_penalty := 0;
      if jsonb_typeof(new.price_breakdown) = 'array' then
        select greatest(coalesce(sum((l->>'amount')::numeric), 0), 0) into v_penalty
          from jsonb_array_elements(new.price_breakdown) l
         where l->>'key' = 'pending_cancellation';
      end if;
      v_base := greatest(coalesce(new.final_price, new.estimated_price, 0) - v_penalty, 0);

      -- Sello de entrega del servidor (0027). to_jsonb para no depender de que
      -- la columna exista; si no, ahora.
      v_delivered_at := coalesce((to_jsonb(new)->>'delivered_stamped_at')::timestamptz, now());

      -- 'first' si este es el servicio entregado MÁS ANTIGUO de los vivos del
      -- cliente (por sello del servidor) y no hay ya otro 'first' vivo.
      if exists (
        select 1 from public.partner_commissions c
         where c.client_user_id = new.created_by_id
           and c.status <> 'reversed'
           and c.request_id is distinct from new.id
           and (c.kind = 'first' or c.delivered_at < v_delivered_at)
      ) then
        v_kind := 'repeat';
        v_pct := (v_settings->>'repeat_pct')::numeric;
      else
        v_kind := 'first';
        v_pct := (v_settings->>'first_pct')::numeric;
      end if;

      v_amount := round(v_base * coalesce(v_pct, 0) / 100, 2);
      if v_amount is null or v_amount <= 0 then return new; end if;

      -- Avisos y retención. Al revivir se conservan los avisos anteriores.
      v_flags := coalesce(v_existing.flags, '{}');
      v_status := 'pending';

      -- El conductor del servicio es el propio comercial: SIEMPRE retenida.
      if new.driver_id = v_partner.user_id then
        v_flags := v_flags || array['same_driver'];
        if new.payment_method = 'cash' then v_flags := v_flags || array['cash']; end if;
        if coalesce((v_settings->>'hold_same_driver')::boolean, true) then v_status := 'held'; end if;
      end if;

      -- Precio final muy por encima del presupuesto: retenida para el admin.
      -- Si compute_quote no existe o falla, se sigue sin esta comprobación.
      begin
        v_quote := (public.compute_quote(to_jsonb(new))->>'total')::numeric;
      exception when others then
        v_quote := null;
      end;
      v_ratio := coalesce((v_settings->>'max_price_quote_ratio')::numeric, 2);
      if v_quote is not null and v_quote > 0 and v_base > v_quote * v_ratio then
        v_flags := v_flags || array['price_above_quote'];
        v_status := 'held';
      end if;

      -- Importes altos en absoluto (el presupuesto no detecta un pedido que ya
      -- nació inflado: horas extra, paradas…): retenida para el admin.
      if v_base > coalesce((v_settings->>'max_auto_base')::numeric, 300) then
        v_flags := v_flags || array['high_amount'];
        v_status := 'held';
      end if;
      if new.payment_method in ('cash', 'bizum')
         and v_base > coalesce((v_settings->>'max_auto_cash_base')::numeric, 150) then
        v_flags := v_flags || array['cash_high'];
        v_status := 'held';
      end if;

      -- Comercial bloqueado (o sin usuario) o programa apagado: se crea igual,
      -- retenida, para que el siguiente servicio del cliente no cuente como
      -- 'first' por error. El admin decide.
      if v_partner.status <> 'active' or v_partner.user_id is null then
        v_flags := v_flags || array['partner_blocked'];
        v_status := 'held';
      end if;
      if not coalesce((v_settings->>'enabled')::boolean, false) then
        v_flags := v_flags || array['program_disabled'];
        v_status := 'held';
      end if;

      select coalesce(array_agg(distinct f order by f), '{}') into v_flags from unnest(v_flags) f;

      -- Hora del servidor, nunca delivery_time.
      v_available_at := now() + make_interval(days => coalesce(trunc((v_settings->>'hold_days')::numeric)::int, 15));

      if v_existing.id is null then
        insert into public.partner_commissions (
          partner_id, request_id, client_user_id, driver_id, payment_method,
          kind, base_amount, rate_pct, amount, status, available_at, flags,
          generated_at, delivered_at
        ) values (
          v_partner.id, new.id, new.created_by_id, new.driver_id, new.payment_method,
          v_kind, v_base, v_pct, v_amount, v_status, v_available_at, v_flags,
          now(), v_delivered_at
        )
        on conflict (request_id) do nothing;
      else
        -- Estaba anulada (no por el admin) y el pedido vuelve a entregarse:
        -- se revive recalculada.
        update public.partner_commissions
           set partner_id = v_partner.id,
               client_user_id = new.created_by_id,
               driver_id = new.driver_id,
               payment_method = new.payment_method,
               kind = v_kind,
               base_amount = v_base,
               rate_pct = v_pct,
               amount = v_amount,
               status = v_status,
               available_at = v_available_at,
               flags = v_flags,
               payout_id = null,
               generated_at = now(),
               delivered_at = v_delivered_at,
               updated_date = now()
         where id = v_existing.id;
      end if;

    elsif old.status = 'delivered' and new.status is distinct from 'delivered' then
      -- Ya no está entregado: lo no cobrado se anula; lo pedido o pagado se
      -- deja y se avisa al admin. Esto corre aunque el programa esté apagado.
      update public.partner_commissions
         set status = 'reversed', updated_date = now()
       where request_id = new.id
         and status in ('pending', 'held');

      update public.partner_commissions
         set flags = array_append(flags, 'order_undelivered'), updated_date = now()
       where request_id = new.id
         and status in ('requested', 'paid')
         and not ('order_undelivered' = any (flags));
    end if;
  exception when others then
    raise warning 'zz_partner_commission: pedido % no generó/actualizó comisión: % (%)',
      new.id, sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

revoke all on function public.zz_partner_commission() from public, anon, authenticated;

drop trigger if exists zz_partner_commission on public.transport_requests;
create trigger zz_partner_commission
  after update of status on public.transport_requests
  for each row execute function public.zz_partner_commission();

/**
 * El admin puede borrar pedidos (política de la 0001). Antes de que la clave
 * foránea deje request_id en NULL, la comisión de ese pedido se anula (si no
 * estaba pedida ni pagada) o se marca 'order_deleted' para el admin. BEFORE
 * para que corra antes que la acción de la clave foránea; nunca impide el
 * borrado.
 */
create or replace function public.zz_partner_commission_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.partner_commissions
       set status = 'reversed', updated_date = now()
     where request_id = old.id
       and status in ('pending', 'held');

    update public.partner_commissions
       set flags = array_append(flags, 'order_deleted'), updated_date = now()
     where request_id = old.id
       and status in ('requested', 'paid')
       and not ('order_deleted' = any (flags));
  exception when others then
    raise warning 'zz_partner_commission_on_delete: pedido %: % (%)', old.id, sqlerrm, sqlstate;
  end;
  return old;
end;
$$;

revoke all on function public.zz_partner_commission_on_delete() from public, anon, authenticated;

drop trigger if exists zz_partner_commission_on_delete on public.transport_requests;
create trigger zz_partner_commission_on_delete
  before delete on public.transport_requests
  for each row execute function public.zz_partner_commission_on_delete();

-- ------------------------------------------------------------
-- 5. RPC del comercial
-- ------------------------------------------------------------

/**
 * Alta como comercial: uno por usuario, slug único y no reservado. Con el
 * programa encendido pero NO público (lanzamiento privado), solo el personal
 * (is_staff) puede darse de alta; el resto recibe 'disabled', igual que con el
 * programa apagado.
 */
create or replace function public.partner_activate(p_display_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_existing public.partners%rowtype;
  v_settings jsonb := public.partner_program_settings();
  v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;

  select * into v_existing from public.partners where user_id = v_uid;
  if v_existing.id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_partner', 'slug', v_existing.slug);
  end if;

  if not coalesce((v_settings->>'enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  -- Lanzamiento privado: encendido pero no público = solo el personal.
  if not coalesce((v_settings->>'public')::boolean, false)
     and not coalesce(public.is_staff(), false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'reason', 'bad_name');
  end if;
  if v_slug !~ '^[a-z0-9-]{3,30}$' or v_slug !~ '[a-z0-9]{3}' then
    return jsonb_build_object('ok', false, 'reason', 'bad_slug');
  end if;
  if v_slug = any (array[
    'admin', 'administrador', 'clicyvoy', 'clicyvoy-partners', 'pontemania', 'portemania',
    'soporte', 'support', 'ayuda', 'help', 'comercial', 'comerciales', 'partner', 'partners',
    'api', 'app', 'www', 'web', 'staff', 'root', 'sistema', 'system', 'null', 'undefined',
    'login', 'registro', 'signup', 'cuenta', 'conductor', 'conductores', 'cliente', 'clientes',
    'contacto', 'info', 'oficial', 'empresa', 'equipo', 'test'
  ]) then
    return jsonb_build_object('ok', false, 'reason', 'reserved_slug');
  end if;
  if exists (select 1 from public.partners where slug = v_slug) then
    return jsonb_build_object('ok', false, 'reason', 'slug_taken');
  end if;

  begin
    insert into public.partners (user_id, slug, display_name)
    values (v_uid, v_slug, v_name)
    returning id into v_id;
  exception when unique_violation then
    -- Carrera: otro alta con el mismo slug, o el mismo usuario dos veces a la vez.
    if exists (select 1 from public.partners where user_id = v_uid) then
      return jsonb_build_object('ok', false, 'reason', 'already_partner');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'slug_taken');
  end;

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end;
$$;

revoke all on function public.partner_activate(text, text) from public, anon;
grant execute on function public.partner_activate(text, text) to authenticated;

/** Titular e IBAN para cobrar. Comprobación de forma, no de dígito de control. */
create or replace function public.partner_update_payout_data(p_holder text, p_iban text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_holder text := btrim(coalesce(p_holder, ''));
  v_iban text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  v_ok boolean;
  v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select id into v_id from public.partners where user_id = v_uid;
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_partner'); end if;

  if char_length(v_holder) < 3 or char_length(v_holder) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'bad_holder');
  end if;

  if v_iban like 'ES%' then
    v_ok := v_iban ~ '^ES[0-9]{22}$';
  else
    v_ok := v_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$';
  end if;
  if not v_ok then return jsonb_build_object('ok', false, 'reason', 'bad_iban'); end if;

  update public.partners
     set payout_holder = v_holder, payout_iban = v_iban, updated_date = now()
   where id = v_id;

  return jsonb_build_object('ok', true, 'iban_last4', right(v_iban, 4));
end;
$$;

revoke all on function public.partner_update_payout_data(text, text) from public, anon;
grant execute on function public.partner_update_payout_data(text, text) to authenticated;

/**
 * Atribuye el usuario que acaba de entrar al comercial del enlace (p_code = slug).
 * Solo para usuarios NUEVOS: sin comercial, sin pedidos y con perfil reciente.
 * Idempotente: repetir con el mismo comercial devuelve ok. Un comercial
 * bloqueado o sin usuario responde como código desconocido.
 */
create or replace function public.partner_claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings jsonb := public.partner_program_settings();
  v_partner public.partners%rowtype;
  v_current uuid;
  v_profile_created timestamptz;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  if not coalesce((v_settings->>'enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  select * into v_partner from public.partners
   where slug = lower(btrim(coalesce(p_code, '')));
  if v_partner.id is null or v_partner.status <> 'active' or v_partner.user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_code');
  end if;

  select partner_id into v_current from public.partner_referrals where client_user_id = v_uid;
  if v_current is not null then
    if v_current = v_partner.id then
      return jsonb_build_object('ok', true, 'already', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'already_referred');
  end if;

  if v_partner.user_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_link');
  end if;

  if exists (select 1 from public.transport_requests where created_by_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'has_orders');
  end if;

  -- Antigüedad de la CUENTA (auth.users), no del perfil: el perfil se puede
  -- recrear, la cuenta no.
  select created_at into v_profile_created from auth.users where id = v_uid;
  if v_profile_created is null
     or v_profile_created < now() - make_interval(days => coalesce(trunc((v_settings->>'claim_window_days')::numeric)::int, 30)) then
    return jsonb_build_object('ok', false, 'reason', 'not_new');
  end if;

  insert into public.partner_referrals (client_user_id, partner_id, source)
  values (v_uid, v_partner.id, 'link')
  on conflict (client_user_id) do nothing;

  -- Si otra llamada simultánea ganó, se responde según lo que quedó guardado.
  select partner_id into v_current from public.partner_referrals where client_user_id = v_uid;
  if v_current = v_partner.id then
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'already_referred');
end;
$$;

revoke all on function public.partner_claim_referral(text) from public, anon;
grant execute on function public.partner_claim_referral(text) to authenticated;

/** Para la página pública del enlace: solo el nombre de pila y si está activo. */
create or replace function public.partner_public(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_partner public.partners%rowtype;
  v_enabled boolean := coalesce((public.partner_program_settings()->>'enabled')::boolean, false);
begin
  select * into v_partner from public.partners where slug = lower(btrim(coalesce(p_slug, '')));
  -- Desconocido, bloqueado, sin usuario o programa apagado: la MISMA
  -- respuesta (no se distingue un código que existe de uno que no).
  if v_partner.id is null or not v_enabled
     or v_partner.status <> 'active' or v_partner.user_id is null then
    return jsonb_build_object('first_name', null, 'active', false);
  end if;
  return jsonb_build_object(
    'first_name', public.partner_first_name(v_partner.display_name),
    'active', true
  );
end;
$$;

revoke all on function public.partner_public(text) from public;
grant execute on function public.partner_public(text) to anon, authenticated;

/** Panel del comercial: totales, cartera, serie de 6 meses, ajustes y cobro. */
create or replace function public.partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_settings jsonb := public.partner_program_settings();
  v_partner public.partners%rowtype;
  v_totals jsonb;
  v_series jsonb;
  v_last jsonb;
  v_last_counted timestamptz;
  v_next timestamptz;
  v_open boolean;
  v_clients int;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;
  select * into v_partner from public.partners where user_id = v_uid;
  if v_partner.id is null then return jsonb_build_object('ok', false, 'reason', 'not_partner'); end if;

  -- Al comercial no se le enseña lo anulado (el admin sí lo ve en su lista).
  v_totals := public.partner_totals(v_partner.id) - 'reversed';
  select count(*) into v_clients from public.partner_referrals where partner_id = v_partner.id;

  -- Últimos 6 meses (hora de Madrid), con los meses vacíos a cero.
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', to_char(m.month_start, 'YYYY-MM'),
           'amount', coalesce(x.amount, 0),
           'services', coalesce(x.services, 0)) order by m.month_start), '[]'::jsonb)
    into v_series
    from generate_series(
           date_trunc('month', now() at time zone 'Europe/Madrid') - interval '5 months',
           date_trunc('month', now() at time zone 'Europe/Madrid'),
           interval '1 month') as m(month_start)
    left join lateral (
      select sum(c.amount) as amount, count(*) as services
        from public.partner_commissions c
       where c.partner_id = v_partner.id
         and c.status <> 'reversed'
         and date_trunc('month', c.generated_at at time zone 'Europe/Madrid') = m.month_start
    ) x on true;

  select jsonb_build_object('amount', amount, 'status', status,
                            'requested_at', requested_at, 'resolved_at', resolved_at)
    into v_last
    from public.partner_payouts
   where partner_id = v_partner.id
   order by requested_at desc
   limit 1;

  select max(requested_at) into v_last_counted
    from public.partner_payouts
   where partner_id = v_partner.id and status in ('requested', 'paid');
  if v_last_counted is not null then
    v_next := v_last_counted + make_interval(days => coalesce(trunc((v_settings->>'payout_interval_days')::numeric)::int, 30));
  end if;

  select exists (select 1 from public.partner_payouts
                  where partner_id = v_partner.id and status = 'requested')
    into v_open;

  return jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'slug', v_partner.slug,
      'display_name', v_partner.display_name,
      'status', case when v_partner.status = 'active' then 'active' else 'blocked' end,
      'created_date', v_partner.created_date),
    'program_enabled', coalesce((v_settings->>'enabled')::boolean, false),
    'program_public', coalesce((v_settings->>'public')::boolean, false),
    'totals', v_totals,
    'clients', v_clients,
    'services', (v_totals->>'services')::int,
    'monthly', v_series,
    'settings', jsonb_build_object(
      'first_pct', v_settings->'first_pct',
      'repeat_pct', v_settings->'repeat_pct',
      'min_payout', v_settings->'min_payout',
      'hold_days', v_settings->'hold_days',
      'payout_interval_days', v_settings->'payout_interval_days'),
    'last_payout', v_last,
    'has_open_payout', v_open,
    'next_request_at', v_next,
    'payout_data', jsonb_build_object(
      'present', v_partner.payout_holder is not null and v_partner.payout_iban is not null,
      'holder', v_partner.payout_holder,
      'iban_last4', case when v_partner.payout_iban is not null then right(v_partner.payout_iban, 4) end),
    'can_request', v_partner.status = 'active'
      and v_partner.payout_holder is not null and v_partner.payout_iban is not null
      and not v_open
      and (v_next is null or v_next <= now())
      and (v_totals->>'available')::numeric >= coalesce((v_settings->>'min_payout')::numeric, 20)
  );
end;
$$;

revoke all on function public.partner_dashboard() from public, anon;
grant execute on function public.partner_dashboard() to authenticated;

/**
 * Cartera del comercial. Sin emails, teléfonos ni ids: nombre de pila, fecha
 * de alta, servicios entregados y comisión viva. 'n' es un número de fila.
 */
create or replace function public.partner_clients()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_rows jsonb;
begin
  select id into v_pid from public.partners where user_id = auth.uid();
  if v_pid is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'n', base.n,
           'first_name', public.partner_first_name(pr.full_name),
           'referred_at', to_char(base.created_date at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
           'services', (select count(*) from public.transport_requests t
                         where t.created_by_id = base.client_user_id
                           and t.status = 'delivered'),
           'commission', (select coalesce(sum(c.amount), 0) from public.partner_commissions c
                           where c.client_user_id = base.client_user_id
                             and c.partner_id = v_pid
                             and c.status <> 'reversed')
         ) order by base.n desc), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (order by r.created_date, r.client_user_id) as n,
             r.created_date,
             r.client_user_id
        from public.partner_referrals r
       where r.partner_id = v_pid
    ) base
    left join public.profiles pr on pr.id = base.client_user_id;

  return v_rows;
end;
$$;

revoke all on function public.partner_clients() from public, anon;
grant execute on function public.partner_clients() to authenticated;

/**
 * Comisiones del comercial con su estado efectivo ('available' /
 * 'awaiting_payment' calculados). Sin el precio del pedido y con fechas sin
 * hora: el comercial no necesita (ni debe) poder reconstruir el servicio.
 */
create or replace function public.partner_commission_list(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid;
  v_rows jsonb;
begin
  select id into v_pid from public.partners where user_id = auth.uid();
  if v_pid is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(x.obj order by x.delivered_at desc, x.id), '[]'::jsonb) into v_rows
    from (
      select c.delivered_at, c.id,
             jsonb_build_object(
               'date', to_char(c.delivered_at at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
               'kind', c.kind,
               'pct', c.rate_pct,
               'amount', c.amount,
               'status', public.partner_effective_status(c.status, c.available_at, c.request_id),
               'available_at', to_char(c.available_at at time zone 'Europe/Madrid', 'YYYY-MM-DD'),
               'client_first_name', public.partner_first_name(pr.full_name)
             ) as obj
        from public.partner_commissions c
        left join public.profiles pr on pr.id = c.client_user_id
       where c.partner_id = v_pid
       order by c.delivered_at desc, c.id
       limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) x;

  return v_rows;
end;
$$;

revoke all on function public.partner_commission_list(int) from public, anon;
grant execute on function public.partner_commission_list(int) to authenticated;

/**
 * Solicitud de cobro. Bloquea la fila del comercial (dos peticiones a la vez
 * se ordenan) y mueve a 'requested' EXACTAMENTE las comisiones sumadas.
 */
create or replace function public.partner_request_payout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb := public.partner_program_settings();
  v_partner public.partners%rowtype;
  v_last timestamptz;
  v_next timestamptz;
  v_ids uuid[];
  v_sum numeric;
  v_min numeric;
  v_payout uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'reason', 'not_authenticated'); end if;

  -- for no key update: ordena dos peticiones simultáneas del mismo comercial
  -- sin bloquear las claves foráneas que apuntan a su fila.
  select * into v_partner from public.partners where user_id = auth.uid() for no key update;
  if v_partner.id is null then return jsonb_build_object('ok', false, 'reason', 'not_partner'); end if;
  if v_partner.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
  if v_partner.payout_holder is null or v_partner.payout_iban is null then
    return jsonb_build_object('ok', false, 'reason', 'no_payout_data');
  end if;
  if exists (select 1 from public.partner_payouts
              where partner_id = v_partner.id and status = 'requested') then
    return jsonb_build_object('ok', false, 'reason', 'pending_request');
  end if;

  select max(requested_at) into v_last
    from public.partner_payouts
   where partner_id = v_partner.id and status in ('requested', 'paid');
  if v_last is not null then
    v_next := v_last + make_interval(days => coalesce(trunc((v_settings->>'payout_interval_days')::numeric)::int, 30));
    if v_next > now() then
      return jsonb_build_object('ok', false, 'reason', 'too_soon', 'next_request_at', v_next);
    end if;
  end if;

  select array_agg(s.id), coalesce(sum(s.amount), 0) into v_ids, v_sum
    from (
      select c.id, c.amount from public.partner_commissions c
       where c.partner_id = v_partner.id
         and c.status = 'pending'
         and public.partner_effective_status(c.status, c.available_at, c.request_id) = 'available'
       for update of c
    ) s;

  v_min := coalesce((v_settings->>'min_payout')::numeric, 20);
  if v_sum < v_min or v_ids is null then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum', 'available', v_sum, 'min_payout', v_min);
  end if;

  begin
    insert into public.partner_payouts (partner_id, amount, holder, iban)
    values (v_partner.id, v_sum, v_partner.payout_holder, v_partner.payout_iban)
    returning id into v_payout;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'pending_request');
  end;

  update public.partner_commissions
     set status = 'requested', payout_id = v_payout, updated_date = now()
   where id = any (v_ids);

  return jsonb_build_object('ok', true, 'payout_id', v_payout, 'amount', v_sum,
                            'commissions', coalesce(array_length(v_ids, 1), 0));
end;
$$;

revoke all on function public.partner_request_payout() from public, anon;
grant execute on function public.partner_request_payout() to authenticated;

-- ------------------------------------------------------------
-- 6. RPC del admin (comprueban is_admin() dentro)
-- ------------------------------------------------------------
-- Los ajustes del programa se editan directamente en app_settings
-- ('partner_program'), con la política de escritura de admin de la 0001.

create or replace function public.partner_admin_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'slug', p.slug,
           'display_name', p.display_name,
           'status', p.status,
           'has_user', p.user_id is not null,
           'email', u.email,
           'created_date', p.created_date,
           'payout_data', p.payout_holder is not null and p.payout_iban is not null,
           'clients', (select count(*) from public.partner_referrals r where r.partner_id = p.id),
           'totals', public.partner_totals(p.id),
           'flags', jsonb_build_object(
             'same_driver', (select count(*) from public.partner_commissions c
                              where c.partner_id = p.id and 'same_driver' = any (c.flags)),
             'held', (select count(*) from public.partner_commissions c
                       where c.partner_id = p.id and c.status = 'held'),
             'order_undelivered', (select count(*) from public.partner_commissions c
                                    where c.partner_id = p.id and 'order_undelivered' = any (c.flags)),
             'order_deleted', (select count(*) from public.partner_commissions c
                                where c.partner_id = p.id and 'order_deleted' = any (c.flags)),
             'high_amount', (select count(*) from public.partner_commissions c
                              where c.partner_id = p.id and ('high_amount' = any (c.flags) or 'cash_high' = any (c.flags))),
             'price_above_quote', (select count(*) from public.partner_commissions c
                                    where c.partner_id = p.id and 'price_above_quote' = any (c.flags)),
             'admin_reversed', (select count(*) from public.partner_commissions c
                                 where c.partner_id = p.id and 'admin_reversed' = any (c.flags)))
         ) order by p.created_date desc), '[]'::jsonb)
    into v_rows
    from public.partners p
    left join auth.users u on u.id = p.user_id;

  return v_rows;
end;
$$;

revoke all on function public.partner_admin_list() from public, anon;
grant execute on function public.partner_admin_list() to authenticated;

create or replace function public.partner_admin_payouts(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', po.id,
           'partner_id', po.partner_id,
           'slug', p.slug,
           'display_name', p.display_name,
           'email', u.email,
           'amount', po.amount,
           'status', po.status,
           'requested_at', po.requested_at,
           'resolved_at', po.resolved_at,
           'note', po.note,
           'holder', po.holder,
           'iban', po.iban,
           'commissions', coalesce(agg.n, 0),
           'cash_amount', coalesce(agg.cash_amount, 0),
           'cash_share_pct', case when po.amount > 0
                                  then round(coalesce(agg.cash_amount, 0) * 100 / po.amount, 1)
                                  else 0 end,
           'same_driver', coalesce(agg.same_driver, 0),
           'order_undelivered', coalesce(agg.undelivered, 0)
         ) order by po.requested_at desc), '[]'::jsonb)
    into v_rows
    from public.partner_payouts po
    join public.partners p on p.id = po.partner_id
    left join auth.users u on u.id = p.user_id
    left join lateral (
      select count(*) as n,
             sum(c.amount) filter (where c.payment_method = 'cash') as cash_amount,
             count(*) filter (where 'same_driver' = any (c.flags)) as same_driver,
             count(*) filter (where 'order_undelivered' = any (c.flags)
                                 or 'order_deleted' = any (c.flags)) as undelivered
        from public.partner_commissions c
       where c.payout_id = po.id
    ) agg on true
   where p_status is null or po.status = p_status;

  return v_rows;
end;
$$;

revoke all on function public.partner_admin_payouts(text) from public, anon;
grant execute on function public.partner_admin_payouts(text) to authenticated;

/**
 * El admin marca una solicitud como pagada (ya hizo la transferencia) o la
 * rechaza. Al rechazar, las comisiones vuelven a pendientes, salvo las de
 * pedidos que ya no están entregados: esas se anulan (no deben volver a poder
 * cobrarse).
 */
create or replace function public.partner_admin_resolve_payout(p_id uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.partner_payouts%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if p_action is null or p_action not in ('paid', 'rejected') then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;

  select * into v_payout from public.partner_payouts where id = p_id for update;
  if v_payout.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_payout.status <> 'requested' then
    return jsonb_build_object('ok', false, 'reason', 'not_requested', 'status', v_payout.status);
  end if;

  update public.partner_payouts
     set status = p_action, resolved_at = now(), resolved_by = auth.uid(), note = v_note
   where id = p_id;

  if p_action = 'paid' then
    update public.partner_commissions
       set status = 'paid', updated_date = now()
     where payout_id = p_id and status = 'requested';
  else
    -- Se bloquean (en lectura) los pedidos para que nadie los "desentregue"
    -- mientras se decide qué vuelve a pendiente y qué se anula.
    perform 1 from public.transport_requests t
     where t.id in (select c.request_id from public.partner_commissions c
                     where c.payout_id = p_id and c.request_id is not null)
       for share;

    update public.partner_commissions c
       set status = case
             when c.request_id is not null and exists (
               select 1 from public.transport_requests t
                where t.id = c.request_id and t.status = 'delivered') then 'pending'
             else 'reversed' end,
           -- Anulada por decisión del admin: no revive aunque se re-entregue.
           flags = case
             when c.request_id is not null and exists (
               select 1 from public.transport_requests t
                where t.id = c.request_id and t.status = 'delivered') then c.flags
             when 'admin_reversed' = any (c.flags) then c.flags
             else array_append(c.flags, 'admin_reversed') end,
           payout_id = null,
           updated_date = now()
     where c.payout_id = p_id and c.status = 'requested';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.partner_admin_resolve_payout(uuid, text, text) from public, anon;
grant execute on function public.partner_admin_resolve_payout(uuid, text, text) to authenticated;

create or replace function public.partner_admin_set_status(p_partner uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_found boolean;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if p_status is null or p_status not in ('active', 'blocked') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  select true, user_id into v_found, v_user from public.partners where id = p_partner;
  if v_found is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_status = 'active' and v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  update public.partners set status = p_status, updated_date = now() where id = p_partner;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.partner_admin_set_status(uuid, text) from public, anon;
grant execute on function public.partner_admin_set_status(uuid, text) to authenticated;

/** Liberar una comisión retenida ('release') o anularla ('reverse'). */
create or replace function public.partner_admin_release_commission(p_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;
  if p_action is null or p_action not in ('release', 'reverse') then
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;

  select status into v_status from public.partner_commissions where id = p_id for update;
  if v_status is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  if p_action = 'release' then
    if v_status <> 'held' then
      return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', v_status);
    end if;
    update public.partner_commissions set status = 'pending', updated_date = now() where id = p_id;
  else
    -- Solo lo no pedido: una comisión dentro de una solicitud se resuelve
    -- rechazando la solicitud.
    if v_status not in ('pending', 'held') then
      return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', v_status);
    end if;
    -- Marca 'admin_reversed': el trigger no la revive aunque se re-entregue.
    update public.partner_commissions
       set status = 'reversed',
           flags = case when 'admin_reversed' = any (flags) then flags
                        else array_append(flags, 'admin_reversed') end,
           updated_date = now()
     where id = p_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.partner_admin_release_commission(uuid, text) from public, anon;
grant execute on function public.partner_admin_release_commission(uuid, text) to authenticated;

/** Comisiones con todo el detalle para el admin (de un comercial, o todas si NULL). */
create or replace function public.partner_admin_commissions(p_partner uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_admin() then raise exception 'Solo el administrador'; end if;

  select coalesce(jsonb_agg(x.obj order by x.generated_at desc), '[]'::jsonb) into v_rows
    from (
      select c.generated_at,
             jsonb_build_object(
               'id', c.id,
               'partner_id', c.partner_id,
               'slug', p.slug,
               'request_id', c.request_id,
               'client_name', pr.full_name,
               'client_email', pr.email,
               'driver_id', c.driver_id,
               'payment_method', c.payment_method,
               'kind', c.kind,
               'base', c.base_amount,
               'pct', c.rate_pct,
               'amount', c.amount,
               'status', c.status,
               'effective_status', public.partner_effective_status(c.status, c.available_at, c.request_id),
               'available_at', c.available_at,
               'generated_at', c.generated_at,
               'delivered_at', c.delivered_at,
               'payout_id', c.payout_id,
               'flags', to_jsonb(c.flags)
             ) as obj
        from public.partner_commissions c
        join public.partners p on p.id = c.partner_id
        left join public.profiles pr on pr.id = c.client_user_id
       where p_partner is null or c.partner_id = p_partner
       order by c.generated_at desc
       limit 1000
    ) x;

  return v_rows;
end;
$$;

revoke all on function public.partner_admin_commissions(uuid) from public, anon;
grant execute on function public.partner_admin_commissions(uuid) to authenticated;

-- Refresca el caché de esquema de PostgREST (dentro de la transacción: el
-- aviso sale al confirmar, y solo si todo lo anterior se ha aplicado).
notify pgrst, 'reload schema';

commit;
