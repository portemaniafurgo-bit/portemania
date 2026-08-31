-- ============================================================
-- 0025 — La tanda de ajustes de Renato (31/08/2026)
--
-- 1. El cobro en mano (efectivo y ahora Bizum) deja de marcarse pagado solo:
--    lo CONFIRMA el conductor al terminar. Un trigger que da por cobrado lo
--    que nadie cobró es dinero fantasma en la contabilidad.
-- 2. El conductor pone la fecha y hora REAL del servicio al aceptar, y un
--    cron avisa a las dos partes cuando se acerca.
-- 3. Un conductor puede DESCARTAR un pedido para que no le aparezca más.
-- 4. Cada conductor elige qué TIPOS de servicio quiere recibir.
-- 5. El pedido de invitado se cierra: hacer un pedido exige cuenta (Google).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cobro en mano confirmado por el conductor (efectivo / Bizum)
-- ------------------------------------------------------------
-- Fuera el automático de la 0024: existió tres días y daba por cobrado lo que
-- nadie había confirmado. El histórico que saneó se queda como está.
drop trigger if exists zz_settle_cash_on_delivery on public.transport_requests;
drop function if exists public.zz_settle_cash_on_delivery();

/**
 * El conductor confirma que ha cobrado en mano (efectivo o Bizum).
 *
 * Solo el conductor del servicio, solo métodos que se cobran en mano (la
 * tarjeta la confirma Stripe) y solo con el trabajo en la entrega o ya
 * entregado: confirmar un cobro antes de llegar no tiene sentido.
 */
create or replace function public.confirm_payment_collected(p_request_id uuid)
returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Servicio no encontrado'; end if;
  if req.driver_id is distinct from auth.uid() then raise exception 'Este servicio no es tuyo'; end if;
  if coalesce(req.payment_method, 'card') not in ('cash', 'bizum') then
    raise exception 'El pago con tarjeta lo confirma la pasarela, no el conductor';
  end if;
  if req.status <> 'delivered' and (req.status <> 'picked_up' or req.arrived_dropoff_at is null) then
    raise exception 'Confirma el cobro al llegar a la entrega o al terminar';
  end if;

  update transport_requests
     set payment_status = 'paid'
   where id = p_request_id
  returning * into req;
  return req;
end;
$$;

revoke all on function public.confirm_payment_collected(uuid) from public, anon;
grant execute on function public.confirm_payment_collected(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Fecha y hora real del servicio, puesta por el conductor
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists agreed_start_at timestamptz,
  add column if not exists agreed_notice_sent_at timestamptz;

comment on column public.transport_requests.agreed_start_at is
  'Cuándo dice el CONDUCTOR que hará el servicio (fecha real y hora aproximada). Distinto de scheduled_at, que es lo que pidió el cliente.';

/**
 * El conductor fija (o corrige) cuándo hará el servicio. Cambiarla vuelve a
 * armar el aviso de "queda poco": una hora nueva merece su propio recordatorio.
 */
create or replace function public.set_agreed_start(
  p_request_id uuid,
  p_when timestamptz
) returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Servicio no encontrado'; end if;
  if req.driver_id is distinct from auth.uid() then raise exception 'Este servicio no es tuyo'; end if;
  if req.status <> 'accepted' then
    raise exception 'La fecha se fija con el servicio aceptado, antes de salir';
  end if;
  if p_when < now() - interval '10 minutes' then
    raise exception 'Esa hora ya ha pasado';
  end if;
  if p_when > now() + interval '60 days' then
    raise exception 'Más de 60 días vista parece un error de tecleo';
  end if;

  update transport_requests
     set agreed_start_at = p_when,
         agreed_notice_sent_at = null
   where id = p_request_id
  returning * into req;
  return req;
end;
$$;

revoke all on function public.set_agreed_start(uuid, timestamptz) from public, anon;
grant execute on function public.set_agreed_start(uuid, timestamptz) to authenticated;

/** Avisa a cliente y conductor cuando el servicio acordado está al caer. */
create or replace function public.remind_upcoming_services()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  sent integer := 0;
begin
  for r in
    select id from public.transport_requests
    where status = 'accepted'
      and agreed_start_at is not null
      and agreed_notice_sent_at is null
      -- Ventana: dentro de la próxima media hora (o acaba de pasar por poco,
      -- si el cron justo no pilló el minuto exacto).
      and agreed_start_at between now() - interval '5 minutes' and now() + interval '30 minutes'
  loop
    perform public.notify_push('service_reminder', r.id);
    update public.transport_requests set agreed_notice_sent_at = now() where id = r.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke all on function public.remind_upcoming_services() from public, anon, authenticated;

select cron.schedule(
  'remind-upcoming-services',
  '*/5 * * * *',
  $$ select public.remind_upcoming_services() $$
);

-- ------------------------------------------------------------
-- 3. Pedidos descartados por el conductor
-- ------------------------------------------------------------
-- Descartar es PERSONAL: el pedido sigue vivo para los demás conductores.
create table if not exists public.driver_dismissals (
  driver_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references public.transport_requests(id) on delete cascade,
  created_date timestamptz not null default now(),
  primary key (driver_id, request_id)
);

alter table public.driver_dismissals enable row level security;

drop policy if exists driver_dismissals_select on public.driver_dismissals;
create policy driver_dismissals_select on public.driver_dismissals
  for select using (driver_id = auth.uid());

drop policy if exists driver_dismissals_insert on public.driver_dismissals;
create policy driver_dismissals_insert on public.driver_dismissals
  for insert with check (driver_id = auth.uid());

-- Por si se arrepiente: borrar el descarte lo devuelve a su lista.
drop policy if exists driver_dismissals_delete on public.driver_dismissals;
create policy driver_dismissals_delete on public.driver_dismissals
  for delete using (driver_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Filtro de servicios por conductor
-- ------------------------------------------------------------
-- null = los recibe todos (lo de siempre). Con lista, solo esos tipos, tanto
-- en la pantalla de ofertas como en los avisos push.
alter table public.driver_profiles
  add column if not exists service_keys text[];

comment on column public.driver_profiles.service_keys is
  'Tipos de servicio que este conductor quiere recibir (porte, mini_mudanza, porte_tienda, paquete). null = todos.';

-- ------------------------------------------------------------
-- 5. Hacer un pedido exige cuenta
-- ------------------------------------------------------------
-- La web deja de ofrecer el pedido de invitado; esto lo hace efectivo aunque
-- alguien llame a la RPC a mano. La función se queda (por si el negocio
-- cambia de idea), pero sin puerta anónima.
revoke execute on function public.create_guest_request(jsonb) from anon;
