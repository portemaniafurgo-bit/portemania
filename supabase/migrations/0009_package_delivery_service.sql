-- Servicio nuevo: envío de paquetes mismo día (máx. 30 kg) dentro de la capital.
--   service_type   : 'transport' (porte de furgoneta, por defecto) | 'package' (envío)
--   package_weight : tramo elegido — 'light' (0-9kg) | 'medium' (10-19kg) | 'heavy' (20-30kg)
alter table public.transport_requests
  add column if not exists service_type   text not null default 'transport',
  add column if not exists package_weight text;

-- Precios de paquete por tramo, editables por el admin en app_settings.tariffs.
-- 1) Si la fila de tarifas no existiera, se crea con los valores por defecto.
insert into public.app_settings (key, value)
values (
  'tariffs',
  '{"small":45,"large":60,"extra_hour":15,"insurance":12,"help_price":30,"commission_pct":15,"pkg_light":4.99,"pkg_medium":7.99,"pkg_heavy":9.99}'::jsonb
)
on conflict (key) do nothing;

-- 2) Añade solo los precios de paquete que falten, SIN pisar tarifas ya editadas
--    (en "defaults || value", las claves de `value` ganan sobre las de la izquierda).
update public.app_settings
set value = '{"pkg_light":4.99,"pkg_medium":7.99,"pkg_heavy":9.99}'::jsonb || value
where key = 'tariffs';

-- Creación de solicitud como invitado (security definer): el precio se recalcula
-- SIEMPRE en servidor. Ahora ramifica por service_type: 'package' cobra el precio
-- fijo del tramo de peso; 'transport' mantiene la fórmula de furgoneta. La zona
-- (CP 02001-08 en recogida y entrega) se exige igual para ambos servicios.
create or replace function public.create_guest_request(payload jsonb)
returns public.transport_requests
language plpgsql security definer
set search_path = public
as $$
declare
  r public.transport_requests;
  t jsonb;
  vt text;
  st text;
  pw text;
  price numeric;
begin
  if (payload->>'origin_address') !~ '0200[1-8]'
     or (payload->>'destination_address') !~ '0200[1-8]' then
    raise exception 'invalid_postal_code';
  end if;

  -- Aviso de duplicado: mismo teléfono NORMALIZADO con un pedido pendiente en
  -- los últimos 30 min, salvo confirmación (force=true).
  if not coalesce((payload->>'force')::boolean, false) then
    if exists (
      select 1 from public.transport_requests tr
      where regexp_replace(coalesce(tr.client_phone, ''), '\D', '', 'g')
            = regexp_replace(coalesce(payload->>'client_phone', ''), '\D', '', 'g')
        and tr.status = 'pending'
        and tr.created_date > now() - interval '30 minutes'
    ) then
      raise exception 'duplicate_pending';
    end if;
  end if;

  select coalesce(value, '{}'::jsonb) into t
  from public.app_settings where key = 'tariffs';

  st := case when payload->>'service_type' = 'package' then 'package' else 'transport' end;

  if st = 'package' then
    pw := payload->>'package_weight';
    price := case pw
      when 'light'  then coalesce((t->>'pkg_light')::numeric, 4.99)
      when 'medium' then coalesce((t->>'pkg_medium')::numeric, 7.99)
      when 'heavy'  then coalesce((t->>'pkg_heavy')::numeric, 9.99)
      else null end;
    if price is null then raise exception 'invalid_weight'; end if;
    vt := null;
  else
    pw := null;
    vt := case when payload->>'vehicle_type' = 'large' then 'large' else 'small' end;
    price :=
        coalesce((t->>vt)::numeric, case vt when 'large' then 60 else 40 end)
      + coalesce((payload->>'extra_hours')::numeric, 0)
        * coalesce((t->>'extra_hour')::numeric, 15)
      + case when coalesce((payload->>'insurance_selected')::boolean, false)
          then coalesce((t->>'insurance')::numeric, 12) else 0 end
      + case when coalesce((payload->>'needs_help')::boolean, false)
          then coalesce((t->>'help_price')::numeric, 30) else 0 end;
  end if;

  insert into public.transport_requests (
    client_name, client_phone, origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    cargo_description, cargo_photos, vehicle_type, distance_km,
    helpers_count, needs_help, help_description,
    extra_hours, insurance_selected, estimated_price,
    payment_method, notes, service_type, package_weight
  ) values (
    payload->>'client_name', payload->>'client_phone',
    payload->>'origin_address', payload->>'destination_address',
    (payload->>'origin_lat')::double precision, (payload->>'origin_lng')::double precision,
    (payload->>'destination_lat')::double precision, (payload->>'destination_lng')::double precision,
    payload->>'cargo_description', coalesce(payload->'cargo_photos', '[]'::jsonb),
    vt, (payload->>'distance_km')::numeric,
    0,
    case when st = 'package' then false else coalesce((payload->>'needs_help')::boolean, false) end,
    case when st = 'package' then null else payload->>'help_description' end,
    case when st = 'package' then 0 else coalesce((payload->>'extra_hours')::numeric, 0) end,
    case when st = 'package' then false else coalesce((payload->>'insurance_selected')::boolean, false) end,
    price,
    coalesce(payload->>'payment_method', 'cash'),
    payload->>'notes', st, pw
  ) returning * into r;
  return r;
end;
$$;
