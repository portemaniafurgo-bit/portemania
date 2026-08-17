-- ============================================================
-- 0014 — Negociación de precio (modelo inDrive)
--
-- Ver docs/NEGOCIACION-PRECIO.md. Resumen de decisiones:
--  - Ofertar es OPCIONAL: proposed_price NULL = flujo actual intacto.
--  - price_offers no admite escrituras directas: todo pasa por RPCs security
--    definer que validan autoría y estado. Es dinero.
--  - El precio pactado se escribe en final_price (el trigger de 0007 lo
--    permite a postgres, que es como corren las RPCs) y desde ahí fluye solo
--    a cobro con tarjeta, ganancias, recibo y finanzas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La oferta del cliente en el pedido
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists proposed_price numeric;

comment on column public.transport_requests.proposed_price is
  'Precio ofrecido por el cliente (modelo inDrive). NULL = sin negociación: flujo clásico a precio calculado.';

-- Suelo de la oferta: 60% del precio calculado. Corre DESPUÉS de
-- set_request_price (orden alfabético de triggers before-insert) para que
-- estimated_price ya esté fijado por el servidor.
create or replace function public.zz_validate_proposed_price()
returns trigger
language plpgsql
as $$
begin
  if new.proposed_price is not null then
    if new.proposed_price < 5 then
      raise exception 'La oferta mínima es 5 €';
    end if;
    if new.estimated_price is not null and new.proposed_price < new.estimated_price * 0.6 then
      raise exception 'Tu oferta es demasiado baja: el mínimo para este servicio es % €',
        ceil(new.estimated_price * 0.6);
    end if;
    if new.proposed_price > 500 then
      raise exception 'La oferta máxima es 500 €';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_validate_proposed_price on public.transport_requests;
create trigger zz_validate_proposed_price
  before insert on public.transport_requests
  for each row execute function public.zz_validate_proposed_price();

-- ------------------------------------------------------------
-- 2. Contraofertas de los conductores
-- ------------------------------------------------------------
create table if not exists public.price_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  driver_name text,
  amount numeric not null check (amount >= 5 and amount <= 500),
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'superseded')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

comment on table public.price_offers is
  'Contraofertas de conductores a pedidos pendientes. Escrituras SOLO vía RPCs.';

create index if not exists price_offers_request_idx on public.price_offers(request_id, status);
create index if not exists price_offers_driver_idx on public.price_offers(driver_id);

drop trigger if exists set_updated_date on public.price_offers;
create trigger set_updated_date before update on public.price_offers
  for each row execute function public.set_updated_date();

alter table public.price_offers enable row level security;

-- Lectura: el conductor ve las suyas; el dueño del pedido, todas las de su
-- pedido; el staff, todo. Escritura directa: NADIE (solo RPCs).
drop policy if exists price_offers_select on public.price_offers;
create policy price_offers_select on public.price_offers for select
  using (
    driver_id = auth.uid()
    or is_staff()
    or exists (
      select 1 from public.transport_requests r
       where r.id = price_offers.request_id and r.created_by_id = auth.uid()
    )
  );

-- Realtime: el cliente ve llegar contraofertas en vivo.
do $$
begin
  alter publication supabase_realtime add table public.price_offers;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 3. RPCs de la negociación
-- ------------------------------------------------------------

-- El conductor contraoferta (o cambia su contraoferta: la anterior queda
-- superseded). Exige conductor verificado, sin docs caducados y pedido vivo.
create or replace function public.make_price_offer(
  p_request_id uuid,
  p_amount numeric,
  p_message text default null
) returns public.price_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof driver_profiles%rowtype;
  req transport_requests%rowtype;
  result price_offers%rowtype;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  if p_amount is null or p_amount < 5 or p_amount > 500 then
    raise exception 'La contraoferta debe estar entre 5 y 500 €';
  end if;

  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;
  if req.status <> 'pending' then raise exception 'El pedido ya no está disponible'; end if;

  -- Perfil por email de login (created_by_id no es de fiar, bug histórico).
  select d.* into prof
    from driver_profiles d
    join auth.users u on u.id = uid
   where lower(d.email) = lower(u.email)
   order by d.created_date
   limit 1;
  if prof.id is null or prof.status <> 'verified' then
    raise exception 'Solo conductores verificados pueden contraofertar';
  end if;
  if coalesce(prof.docs_expired, false) then
    raise exception 'Tienes documentación caducada: renuévala antes de trabajar';
  end if;
  -- Reparto por furgoneta, misma regla que aceptar:
  if req.vehicle_type = 'large' and prof.vehicle_type <> 'large' then
    raise exception 'Este pedido requiere furgoneta grande';
  end if;

  update price_offers set status = 'superseded'
   where request_id = p_request_id and driver_id = uid and status = 'pending';

  insert into price_offers (request_id, driver_id, driver_name, amount, message)
  values (p_request_id, uid, coalesce(prof.full_name, 'Conductor'), round(p_amount, 2), nullif(trim(p_message), ''))
  returning * into result;
  return result;
end;
$$;

-- El CLIENTE acepta una contraoferta: pedido asignado al conductor con el
-- precio pactado en final_price. Anti-carrera: condicionado a pending.
create or replace function public.accept_price_offer(p_offer_id uuid)
returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  offer price_offers%rowtype;
  req transport_requests%rowtype;
begin
  if uid is null then raise exception 'No autenticado'; end if;

  select * into offer from price_offers where id = p_offer_id;
  if offer.id is null then raise exception 'Contraoferta no encontrada'; end if;
  if offer.status <> 'pending' then raise exception 'Esta contraoferta ya no está activa'; end if;

  select * into req from transport_requests where id = offer.request_id;
  if req.created_by_id is distinct from uid then raise exception 'No es tu pedido'; end if;

  update transport_requests
     set status = 'accepted',
         driver_id = offer.driver_id,
         driver_name = offer.driver_name,
         accepted_at = now(),
         final_price = offer.amount
   where id = offer.request_id
     and status = 'pending'
  returning * into req;
  if req.id is null then raise exception 'El pedido ya fue aceptado por otra vía'; end if;

  update price_offers set status = 'accepted' where id = offer.id;
  update price_offers set status = 'rejected'
   where request_id = offer.request_id and status = 'pending' and id <> offer.id;

  return req;
end;
$$;

-- El CONDUCTOR acepta el precio propuesto por el cliente tal cual. Necesita
-- RPC porque el trigger de 0007 no deja a un conductor escribir final_price.
create or replace function public.accept_at_client_price(p_request_id uuid)
returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof driver_profiles%rowtype;
  req transport_requests%rowtype;
begin
  if uid is null then raise exception 'No autenticado'; end if;

  select d.* into prof
    from driver_profiles d
    join auth.users u on u.id = uid
   where lower(d.email) = lower(u.email)
   order by d.created_date
   limit 1;
  if prof.id is null or prof.status <> 'verified' then
    raise exception 'Solo conductores verificados pueden aceptar';
  end if;
  if coalesce(prof.docs_expired, false) then
    raise exception 'Tienes documentación caducada: renuévala antes de trabajar';
  end if;

  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;
  if req.proposed_price is null then raise exception 'Este pedido no tiene precio propuesto'; end if;
  if req.vehicle_type = 'large' and prof.vehicle_type <> 'large' then
    raise exception 'Este pedido requiere furgoneta grande';
  end if;

  update transport_requests
     set status = 'accepted',
         driver_id = uid,
         driver_name = coalesce(prof.full_name, 'Conductor'),
         accepted_at = now(),
         final_price = req.proposed_price
   where id = p_request_id
     and status = 'pending'
  returning * into req;
  if req.id is null then raise exception 'Otro conductor aceptó este servicio antes que tú'; end if;

  update price_offers set status = 'rejected'
   where request_id = p_request_id and status = 'pending';

  return req;
end;
$$;

-- El cliente descarta una contraoferta que no le interesa.
create or replace function public.reject_price_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  offer price_offers%rowtype;
begin
  if uid is null then raise exception 'No autenticado'; end if;
  select * into offer from price_offers where id = p_offer_id;
  if offer.id is null then raise exception 'Contraoferta no encontrada'; end if;
  if not exists (
    select 1 from transport_requests r
     where r.id = offer.request_id and r.created_by_id = uid
  ) then
    raise exception 'No es tu pedido';
  end if;
  update price_offers set status = 'rejected' where id = p_offer_id and status = 'pending';
end;
$$;

revoke all on function public.make_price_offer(uuid, numeric, text) from public;
revoke all on function public.accept_price_offer(uuid) from public;
revoke all on function public.accept_at_client_price(uuid) from public;
revoke all on function public.reject_price_offer(uuid) from public;
grant execute on function public.make_price_offer(uuid, numeric, text) to authenticated;
grant execute on function public.accept_price_offer(uuid) to authenticated;
grant execute on function public.accept_at_client_price(uuid) to authenticated;
grant execute on function public.reject_price_offer(uuid) to authenticated;
