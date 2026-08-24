-- ============================================================
-- 0021 — Las seis fases del conductor, con 2 minutos entre cada una
--
-- El flujo pasa de cuatro pasos a seis, que es como se trabaja de verdad:
--
--   1. Iniciar viaje            → va hacia la recogida      (in_transit)
--   2. He llegado               → está en el portal          (arrived_pickup_at)
--   3. Carga recogida           → ya la tiene                (picked_up)
--   4. Iniciar viaje a destino  → sale hacia la entrega      (to_destination_at)
--   5. He llegado               → está en la entrega         (arrived_dropoff_at)
--   6. Trabajo finalizado       → entregado                  (delivered)
--
-- Las fases intermedias son marcas de tiempo, no estados nuevos: el cliente, el
-- panel y las finanzas siguen viendo el mismo ciclo de siempre, y nada de lo
-- que ya funciona se entera del cambio.
--
-- Entre fase y fase deben pasar 2 minutos. Es lo que impide el "pulsar todo
-- seguido al llegar" que deja un historial que no se sostiene ante una
-- reclamación. El margen es configurable en tarifas.
-- ============================================================

alter table public.transport_requests
  add column if not exists arrived_pickup_at timestamptz,
  add column if not exists to_destination_at timestamptz,
  add column if not exists arrived_dropoff_at timestamptz,
  -- Momento del último cambio de fase, para medir los 2 minutos sin depender
  -- del reloj del móvil.
  add column if not exists phase_changed_at timestamptz;

comment on column public.transport_requests.arrived_pickup_at is
  'Cuándo el conductor dijo "he llegado" a la recogida. Fase intermedia: no cambia el estado del pedido.';

update public.app_settings
   set value = value || jsonb_build_object('phase_gap_minutes', 2)
 where key = 'tariffs'
   and not (value ? 'phase_gap_minutes');

/**
 * Avanza el servicio a la siguiente fase. Devuelve el pedido actualizado.
 *
 * Quien decide si se puede avanzar es el SERVIDOR: con el reloj del móvil
 * bastaría cambiar la hora para saltarse la espera.
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
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Servicio no encontrado'; end if;
  if req.driver_id is distinct from auth.uid() then raise exception 'Este servicio no es tuyo'; end if;
  if req.status in ('delivered', 'cancelled') then raise exception 'El servicio ya está cerrado'; end if;

  select coalesce((value->>'phase_gap_minutes')::numeric, 2) into gap_minutes
    from public.app_settings where key = 'tariffs';

  -- Desde el último cambio de fase (o desde que aceptó, para la primera).
  last_change := coalesce(req.phase_changed_at, req.accepted_at);
  if last_change is not null then
    seconds_left := gap_minutes * 60 - extract(epoch from (now() - last_change));
    if seconds_left > 0 then
      raise exception 'Espera % segundos antes de cambiar de fase', ceil(seconds_left);
    end if;
  end if;

  -- Cada fase exige venir de la anterior: no se puede entregar sin recoger.
  if p_phase = 'start_to_pickup' then
    if req.status <> 'accepted' then raise exception 'El viaje ya estaba iniciado'; end if;
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

revoke all on function public.advance_job_phase(uuid, text) from public, anon;
grant execute on function public.advance_job_phase(uuid, text) to authenticated;

/** Segundos que faltan para poder cambiar de fase. 0 = ya se puede. */
create or replace function public.phase_wait_seconds(p_request_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  gap_minutes numeric;
  last_change timestamptz;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null or req.driver_id is distinct from auth.uid() then return 0; end if;

  select coalesce((value->>'phase_gap_minutes')::numeric, 2) into gap_minutes
    from public.app_settings where key = 'tariffs';

  last_change := coalesce(req.phase_changed_at, req.accepted_at);
  if last_change is null then return 0; end if;

  return greatest(0, ceil(gap_minutes * 60 - extract(epoch from (now() - last_change))))::int;
end;
$$;

grant execute on function public.phase_wait_seconds(uuid) to authenticated;
