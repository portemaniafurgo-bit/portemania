-- ============================================================
-- 0026 — Tanda de septiembre (Renato, 01/09/2026)
--
-- 1. Planta sin ascensor del PORTE a 7 € (la mini mudanza sigue a 15 €).
-- 2. Envío de paquetes también Villarrobledo → Albacete (columna origin_zone).
-- 3. Subir o sustituir un documento deja al conductor PENDIENTE de revisión.
-- 4. La fecha que propone el conductor la AUTORIZA el cliente; y no se puede
--    salir antes de la hora acordada/programada sin esa autorización.
-- 5. Los pedidos programados se publican 24 h antes, para que los conductores
--    puedan aceptarlos con tiempo (y se avisen de la fecha).
-- 6. Cuando el admin responde a una incidencia, el cliente se entera (email y
--    push).
-- ============================================================

-- ------------------------------------------------------------
-- 1 + 2. Tarifa de planta del porte y zona de origen
-- ------------------------------------------------------------
update public.app_settings
   set value = value || jsonb_build_object('porte_floor', 7)
 where key = 'tariffs'
   and not (value ? 'porte_floor');

alter table public.transport_requests
  add column if not exists origin_zone text not null default 'albacete';

comment on column public.transport_requests.origin_zone is
  'Zona de recogida (albacete | villarrobledo). Solo el envío de paquetes puede recoger fuera de la capital; el precio de Villarrobledo aplica en cualquiera de los dos sentidos.';

create or replace function public.compute_quote(payload jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  t jsonb;
  svc text;
  lines jsonb := '[]'::jsonb;
  total numeric;
  hours numeric;
  floor_price numeric;
  help_price numeric;
  n_origin int;
  n_dest int;
  n_stops int;
  n_items int;
  pkg_key text;
  pkg_label text;
  intercity boolean;
  discount numeric;
begin
  select value into t from public.app_settings where key = 'tariffs';
  t := coalesce(t, '{}'::jsonb);

  svc := coalesce(payload->>'service_type', payload->>'service', 'porte');
  if svc not in ('porte', 'mini_mudanza', 'porte_tienda', 'paquete') then svc := 'porte'; end if;

  if svc = 'paquete' then
    -- Villarrobledo en CUALQUIER sentido: recogida o entrega fuera de la capital.
    intercity := coalesce(payload->>'destination_zone', 'albacete') = 'villarrobledo'
              or coalesce(payload->>'origin_zone', 'albacete') = 'villarrobledo';
    if intercity then
      pkg_key := 'pkg_villarrobledo';
      pkg_label := 'Envío Albacete ↔ Villarrobledo · hasta 10 kg';
    else
      pkg_key := case coalesce(payload->>'package_weight', 'light')
        when 'light' then 'pkg_light' when 'medium' then 'pkg_medium' else 'pkg_heavy' end;
      pkg_label := 'Envío de paquete · ' || case coalesce(payload->>'package_weight', 'light')
        when 'light' then '0 – 9 kg' when 'medium' then '10 – 19 kg' else '20 – 30 kg' end;
    end if;
    lines := public.quote_line(
      lines, 'base', pkg_label,
      coalesce((t->>pkg_key)::numeric,
        case pkg_key when 'pkg_light' then 4.99 when 'pkg_medium' then 7.99
                     when 'pkg_heavy' then 9.99 else 19.99 end));

  else
    if svc = 'mini_mudanza' then
      lines := public.quote_line(lines, 'base', 'Mini mudanza · 2 h incluidas',
                                 coalesce((t->>'mudanza_base')::numeric, 99));

      hours := greatest(0, coalesce((payload->>'extra_hours')::numeric, 0));
      lines := public.quote_line(lines, 'extra_hours', hours::int || ' h extra',
                                 hours * coalesce((t->>'mudanza_extra_hour')::numeric, 25));

      select count(*) into n_stops
      from jsonb_array_elements(coalesce(payload->'stops', '[]'::jsonb)) as e(item)
      where coalesce(btrim(e.item->>'address'), '') <> '';

      lines := public.quote_line(lines, 'stops',
        n_stops || ' parada' || case when n_stops = 1 then '' else 's' end ||
        ' adicional' || case when n_stops = 1 then '' else 'es' end,
        n_stops * coalesce((t->>'mudanza_stop')::numeric, 20));

    elsif svc = 'porte_tienda' then
      lines := public.quote_line(lines, 'base', 'Compra en tienda · entrega con firma',
                                 coalesce((t->>'tienda_base')::numeric, 30));
    else
      lines := public.quote_line(lines, 'base', 'Porte · precio cerrado',
                                 coalesce((t->>'porte_base')::numeric, 40));

      n_items := greatest(0, coalesce((payload->>'items_count')::integer, 1) - 1);
      lines := public.quote_line(lines, 'items',
        n_items || ' objeto' || case when n_items = 1 then '' else 's' end || ' adicional' ||
        case when n_items = 1 then '' else 'es' end,
        n_items * coalesce((t->>'porte_item')::numeric, 3));
    end if;

    -- Ayuda del conductor: 12 € en porte, 39 € en mini mudanza. Las plantas
    -- solo con ayuda, y cada servicio con SU precio de planta (7 € / 15 €).
    if svc in ('porte', 'mini_mudanza') and coalesce((payload->>'needs_help')::boolean, false) then
      help_price := case when svc = 'porte'
        then coalesce((t->>'porte_help')::numeric, 12)
        else coalesce((t->>'mudanza_help')::numeric, 39) end;
      lines := public.quote_line(lines, 'help', 'Ayuda del conductor', help_price);

      floor_price := case when svc = 'porte'
        then coalesce((t->>'porte_floor')::numeric, 7)
        else coalesce((t->>'mudanza_floor')::numeric, 15) end;
      n_origin := case when (payload->>'origin_has_lift')::boolean is false
        then least(greatest(coalesce((payload->>'origin_floors')::integer, 0), 0), 20) else 0 end;
      n_dest := case when (payload->>'destination_has_lift')::boolean is false
        then least(greatest(coalesce((payload->>'destination_floors')::integer, 0), 0), 20) else 0 end;

      lines := public.quote_line(lines, 'origin_floors',
        'Recogida sin ascensor · ' || n_origin || ' planta' || case when n_origin = 1 then '' else 's' end,
        n_origin * floor_price);
      lines := public.quote_line(lines, 'destination_floors',
        'Entrega sin ascensor · ' || n_dest || ' planta' || case when n_dest = 1 then '' else 's' end,
        n_dest * floor_price);
    end if;
  end if;

  select coalesce(sum((e->>'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) e;

  if coalesce(payload->>'payment_method', 'cash') = 'card' and total > 0 then
    if svc = 'mini_mudanza' then
      discount := round(total * coalesce((t->>'card_discount_mudanza_pct')::numeric, 3) / 100, 2);
    elsif svc = 'porte' then
      discount := least(coalesce((t->>'card_discount_porte')::numeric, 2), total);
    else
      discount := 0;
    end if;

    if discount > 0 then
      lines := public.quote_line(lines, 'card_discount', 'Descuento por pago con tarjeta', -discount);
      total := total - discount;
    end if;
  end if;

  return jsonb_build_object('total', round(total, 2), 'lines', lines, 'service_type', svc);
end;
$$;

grant execute on function public.compute_quote(jsonb) to anon, authenticated, service_role;

create or replace function public.set_request_price()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  q jsonb;
begin
  new.service_type := public.resolve_service_type(to_jsonb(new));
  new.vehicle_type := public.vehicle_for_service(new.service_type);
  new.signature_required := new.service_type in ('porte_tienda', 'paquete');

  -- Solo el envío de paquetes sale de la capital, en cualquiera de los dos
  -- sentidos; y nunca de Villarrobledo a Villarrobledo.
  if new.service_type <> 'paquete' then
    new.destination_zone := 'albacete';
    new.origin_zone := 'albacete';
  elsif coalesce(new.origin_zone, 'albacete') = 'villarrobledo'
        and coalesce(new.destination_zone, 'albacete') = 'villarrobledo' then
    raise exception 'El envío tiene que unir Albacete y Villarrobledo: no se hacen envíos dentro de Villarrobledo';
  end if;

  if not coalesce(new.needs_help, false) then
    new.origin_floors := 0;
    new.destination_floors := 0;
  end if;

  q := public.compute_quote(to_jsonb(new));
  new.estimated_price := (q->>'total')::numeric;
  new.price_breakdown := q->'lines';
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3. Documento nuevo o sustituido → pendiente de revisión
-- ------------------------------------------------------------
-- Solo cuando lo cambia el PROPIO conductor (el admin edita sin pasar por
-- revisión, y los jobs del servidor no tienen auth.uid()). Va con prefijo zz_
-- para correr DESPUÉS de protect_driver_profile_fields, que impide que un
-- conductor se cambie el estado a mano: aquí el estado lo cambia el servidor.
create or replace function public.zz_docs_review_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;

  if new.status = 'verified' and (
       new.license_photo_url    is distinct from old.license_photo_url
    or new.id_document_url      is distinct from old.id_document_url
    or new.insurance_url        is distinct from old.insurance_url
    or new.autonomo_receipt_url is distinct from old.autonomo_receipt_url
    or new.censal_document_url  is distinct from old.censal_document_url
  ) then
    new.status := 'pending_verification';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_docs_review_on_change on public.driver_profiles;
create trigger zz_docs_review_on_change
  before update on public.driver_profiles
  for each row execute function public.zz_docs_review_on_change();

-- ------------------------------------------------------------
-- 4. Fecha propuesta por el conductor, autorizada por el cliente
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists agreed_start_status text;

comment on column public.transport_requests.agreed_start_status is
  'proposed (la propuso el conductor) | confirmed (la aceptó el cliente) | rejected. Solo una fecha CONFIRMADA autoriza a salir antes de lo programado.';

/** El conductor PROPONE cuándo hará el servicio; queda a la espera del cliente. */
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
    raise exception 'La fecha se propone con el servicio aceptado, antes de salir';
  end if;
  if p_when < now() - interval '10 minutes' then raise exception 'Esa hora ya ha pasado'; end if;
  if p_when > now() + interval '60 days' then raise exception 'Más de 60 días vista parece un error de tecleo'; end if;

  update transport_requests
     set agreed_start_at = p_when,
         agreed_start_status = 'proposed',
         agreed_notice_sent_at = null
   where id = p_request_id
  returning * into req;
  return req;
end;
$$;

/** El cliente acepta o rechaza la fecha propuesta. */
create or replace function public.respond_agreed_start(
  p_request_id uuid,
  p_accept boolean
) returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;
  if req.created_by_id is distinct from auth.uid() then raise exception 'No es tu pedido'; end if;
  if req.agreed_start_status is distinct from 'proposed' then
    raise exception 'No hay ninguna fecha pendiente de respuesta';
  end if;

  update transport_requests
     set agreed_start_status = case when p_accept then 'confirmed' else 'rejected' end,
         agreed_notice_sent_at = null
   where id = p_request_id
  returning * into req;
  return req;
end;
$$;

revoke all on function public.respond_agreed_start(uuid, boolean) from public, anon;
grant execute on function public.respond_agreed_start(uuid, boolean) to authenticated;

/** El recordatorio de "queda media hora" solo para fechas CONFIRMADAS. */
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
      and agreed_start_status = 'confirmed'
      and agreed_notice_sent_at is null
      and agreed_start_at between now() - interval '5 minutes' and now() + interval '30 minutes'
  loop
    perform public.notify_push('service_reminder', r.id);
    update public.transport_requests set agreed_notice_sent_at = now() where id = r.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

/**
 * Avanza de fase. Igual que en 0021, más la regla de la fecha: no se sale
 * hacia la recogida antes de la hora ACORDADA (confirmada por el cliente) o
 * PROGRAMADA por el cliente. Adelantarla exige su autorización.
 */
create or replace function public.advance_job_phase(
  p_request_id uuid,
  p_phase text
) returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  gap_minutes numeric;
  last_change timestamptz;
  seconds_left numeric;
  planned timestamptz;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Servicio no encontrado'; end if;
  if req.driver_id is distinct from auth.uid() then raise exception 'Este servicio no es tuyo'; end if;
  if req.status in ('delivered', 'cancelled') then raise exception 'El servicio ya está cerrado'; end if;

  select coalesce((value->>'phase_gap_minutes')::numeric, 2) into gap_minutes
    from public.app_settings where key = 'tariffs';

  last_change := coalesce(req.phase_changed_at, req.accepted_at);
  if last_change is not null then
    seconds_left := gap_minutes * 60 - extract(epoch from (now() - last_change));
    if seconds_left > 0 then
      raise exception 'Espera % segundos antes de cambiar de fase', ceil(seconds_left);
    end if;
  end if;

  if p_phase = 'start_to_pickup' then
    if req.status <> 'accepted' then raise exception 'El viaje ya estaba iniciado'; end if;

    -- La hora que manda: la confirmada por el cliente; si no, la programada.
    planned := case when req.agreed_start_status = 'confirmed' then req.agreed_start_at
                    else req.scheduled_at end;
    if planned is not null and planned > now() + interval '30 minutes' then
      raise exception 'Este servicio es para el %. Para hacerlo antes necesitas la autorización del cliente: propón la nueva hora desde la app.',
        to_char(planned at time zone 'Europe/Madrid', 'DD/MM "a las" HH24:MI');
    end if;

    update transport_requests set status = 'in_transit', phase_changed_at = now()
     where id = p_request_id returning * into req;

  elsif p_phase = 'arrived_pickup' then
    if req.status <> 'in_transit' then raise exception 'Primero inicia el viaje'; end if;
    update transport_requests set arrived_pickup_at = now(), phase_changed_at = now()
     where id = p_request_id returning * into req;

  elsif p_phase = 'picked_up' then
    if req.status <> 'in_transit' or req.arrived_pickup_at is null then
      raise exception 'Marca antes que has llegado a la recogida';
    end if;
    update transport_requests
       set status = 'picked_up', pickup_time = now(), phase_changed_at = now()
     where id = p_request_id returning * into req;

  elsif p_phase = 'start_to_destination' then
    if req.status <> 'picked_up' then raise exception 'Primero recoge la carga'; end if;
    update transport_requests set to_destination_at = now(), phase_changed_at = now()
     where id = p_request_id returning * into req;

  elsif p_phase = 'arrived_dropoff' then
    if req.to_destination_at is null then raise exception 'Primero inicia el viaje al destino'; end if;
    update transport_requests set arrived_dropoff_at = now(), phase_changed_at = now()
     where id = p_request_id returning * into req;

  else
    raise exception 'Fase desconocida: %', p_phase;
  end if;

  return req;
end;
$$;

-- ------------------------------------------------------------
-- 5. Programados: se publican 24 h antes
-- ------------------------------------------------------------
-- Antes salían a su hora exacta, y ningún conductor podía planificarse. Ahora
-- entran en la bolsa un día antes; la app enseña la fecha en la oferta y el
-- servidor (advance_job_phase) impide salir antes sin permiso del cliente.
do $$
begin
  perform cron.unschedule('publish-scheduled-orders');
exception when others then null;
end $$;

select cron.schedule(
  'publish-scheduled-orders',
  '* * * * *',
  $$
  update public.transport_requests
     set status = 'pending'
   where status = 'scheduled'
     and scheduled_at <= now() + interval '24 hours'
  $$
);

-- ------------------------------------------------------------
-- 6. Respuesta del admin a una incidencia → el cliente se entera
-- ------------------------------------------------------------
/** Como notify_push, pero contra send-email (el canal que hoy llega seguro). */
create or replace function public.notify_email(p_mode text, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then return; end if;

  perform net.http_post(
    url := base_url || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_strip_nulls(jsonb_build_object('mode', p_mode, 'order_id', p_order_id))
  );
end;
$$;

revoke all on function public.notify_email(text, uuid) from public, anon, authenticated;

create or replace function public.zz_notify_incident_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando APARECE o cambia la respuesta: reabrir, reclasificar o
  -- cerrar sin texto no avisa de nada.
  if new.resolution is not null
     and btrim(new.resolution) <> ''
     and new.resolution is distinct from old.resolution
     and new.request_id is not null then
    perform public.notify_push('incident_resolved', new.request_id);
    perform public.notify_email('incident_resolved', new.request_id);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_notify_incident_resolved on public.incidents;
create trigger zz_notify_incident_resolved
  after update on public.incidents
  for each row execute function public.zz_notify_incident_resolved();
