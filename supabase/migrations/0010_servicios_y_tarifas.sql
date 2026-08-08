-- ============================================================
-- 0010 — Catálogo real de servicios y motor de precios en servidor
--
-- Problema que resuelve:
--   1) `service_type` solo distinguía 'transport' / 'package', así que mini
--      mudanza, porte y compra en tienda eran indistinguibles en BD.
--   2) Los precios vivían en cinco sitios que se contradecían (landing 99 €,
--      asistente 60 €, tarifas 40 €…). Ahora hay una sola fórmula, aquí.
--   3) El cliente autenticado mandaba su propio `estimated_price`; solo el
--      invitado lo recalculaba en servidor.
--
-- A partir de esta migración TODO pedido, venga de donde venga, sale con el
-- precio y el desglose que calcula `compute_quote`. El front (src/lib/pricing.js)
-- replica la fórmula solo para enseñarla en vivo; si cambias una regla, cámbiala
-- en los dos sitios.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas nuevas del pedido
-- ------------------------------------------------------------
alter table public.transport_requests
  -- Paradas intermedias de la mini mudanza: [{address, lat, lng}]
  add column if not exists stops jsonb not null default '[]'::jsonb,
  -- Accesos: null = no preguntado, true = hay ascensor, false = sin ascensor
  add column if not exists origin_has_lift boolean,
  add column if not exists origin_floors integer not null default 0,
  add column if not exists destination_has_lift boolean,
  add column if not exists destination_floors integer not null default 0,
  -- Nº de objetos declarados (porte: máximo 6)
  add column if not exists items_count integer,
  -- Zona de entrega: solo el envío de paquetes puede salir de la capital
  add column if not exists destination_zone text not null default 'albacete',
  -- Receptor en los servicios con entrega firmada
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists signature_required boolean not null default false,
  -- Prueba de entrega (la firma se captura en el panel del conductor)
  add column if not exists proof_signature_url text,
  add column if not exists proof_photo_url text,
  add column if not exists delivered_signature_at timestamptz,
  -- Desglose mostrado al cliente antes de confirmar
  add column if not exists price_breakdown jsonb not null default '[]'::jsonb;

comment on column public.transport_requests.price_breakdown is
  'Desglose línea a línea del precio: [{key,label,amount}]. Lo escribe el trigger set_request_price, nunca el cliente.';
comment on column public.transport_requests.stops is
  'Paradas intermedias [{address,lat,lng}]. 3 direcciones = 1 parada adicional.';

-- ------------------------------------------------------------
-- 2. Backfill del catálogo de servicios
--    'transport' + small -> porte · 'transport' + large -> mini_mudanza
--    'package' -> paquete
-- ------------------------------------------------------------
update public.transport_requests
set service_type = case
      when service_type = 'package' then 'paquete'
      when service_type = 'transport' and vehicle_type = 'large' then 'mini_mudanza'
      when service_type = 'transport' then 'porte'
      else service_type
    end
where service_type in ('transport', 'package');

-- Los envíos antiguos se hicieron todos dentro de la capital.
update public.transport_requests
set destination_zone = 'albacete'
where destination_zone is null;

alter table public.transport_requests
  drop constraint if exists transport_requests_service_type_check;
alter table public.transport_requests
  add constraint transport_requests_service_type_check
  check (service_type in ('porte', 'mini_mudanza', 'porte_tienda', 'paquete'));

alter table public.transport_requests
  drop constraint if exists transport_requests_destination_zone_check;
alter table public.transport_requests
  add constraint transport_requests_destination_zone_check
  check (destination_zone in ('albacete', 'villarrobledo'));

alter table public.transport_requests alter column service_type set default 'porte';

-- ------------------------------------------------------------
-- 3. Tarifario por servicio
--    Se añaden solo las claves que falten (las ya editadas por el admin ganan)
--    y se retiran las del modelo viejo por tamaño de furgoneta, que ya no
--    interviene en ningún precio.
-- ------------------------------------------------------------
insert into public.app_settings (key, value) values ('tariffs', '{}'::jsonb)
on conflict (key) do nothing;

update public.app_settings
set value = (
      '{
        "porte_base": 40,
        "mudanza_base": 99,
        "mudanza_extra_hour": 25,
        "mudanza_help": 39,
        "mudanza_floor": 15,
        "mudanza_stop": 20,
        "tienda_base": 30,
        "pkg_light": 4.99,
        "pkg_medium": 7.99,
        "pkg_heavy": 9.99,
        "pkg_villarrobledo": 19.99,
        "insurance": 12,
        "commission_pct": 15
      }'::jsonb || value
    ) - 'small' - 'large' - 'extra_hour' - 'help_price'
where key = 'tariffs';

-- ------------------------------------------------------------
-- 4. Motor de precios
-- ------------------------------------------------------------

-- Añade una línea al desglose solo si tiene importe.
create or replace function public.quote_line(lines jsonb, k text, l text, amount numeric)
returns jsonb
language sql immutable
as $$
  select case
    when coalesce(amount, 0) = 0 then lines
    else lines || jsonb_build_array(
      jsonb_build_object('key', k, 'label', l, 'amount', round(amount, 2))
    )
  end;
$$;

-- Clave de servicio normalizada, tolerando el vocabulario anterior.
create or replace function public.resolve_service_type(payload jsonb)
returns text
language sql immutable
as $$
  select case
    when payload->>'service_type' in ('porte','mini_mudanza','porte_tienda','paquete')
      then payload->>'service_type'
    when payload->>'service_type' = 'package' then 'paquete'
    when payload->>'service_type' = 'transport' and payload->>'vehicle_type' = 'large'
      then 'mini_mudanza'
    else 'porte'
  end;
$$;

-- Furgoneta que corresponde al servicio (la usa el conductor para filtrar).
create or replace function public.vehicle_for_service(svc text)
returns text
language sql immutable
as $$
  select case svc
    when 'mini_mudanza' then 'large'
    when 'paquete' then null
    else 'small'
  end;
$$;

-- Precio + desglose de un pedido. Réplica exacta de src/lib/pricing.js.
create or replace function public.compute_quote(payload jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  t            jsonb;
  svc          text;
  dest_zone    text;
  lines        jsonb := '[]'::jsonb;
  total        numeric := 0;
  hours        numeric;
  floor_price  numeric;
  n_origin     integer;
  n_dest       integer;
  n_stops      integer;
  pkg_key      text;
  pkg_label    text;
begin
  select coalesce(value, '{}'::jsonb) into t from public.app_settings where key = 'tariffs';
  t := coalesce(t, '{}'::jsonb);

  svc := public.resolve_service_type(payload);

  -- Envío de paquetes: precio cerrado por tramo, según la zona de entrega.
  if svc = 'paquete' then
    dest_zone := case when payload->>'destination_zone' = 'villarrobledo'
                      then 'villarrobledo' else 'albacete' end;
    if dest_zone = 'villarrobledo' then
      if payload->>'package_weight' is distinct from 'vr_light' then
        raise exception 'invalid_weight';
      end if;
      pkg_key := 'pkg_villarrobledo';
      pkg_label := 'Envío a Villarrobledo · Hasta 10 kg';
    else
      pkg_key := case payload->>'package_weight'
        when 'light'  then 'pkg_light'
        when 'medium' then 'pkg_medium'
        when 'heavy'  then 'pkg_heavy'
        else null end;
      if pkg_key is null then raise exception 'invalid_weight'; end if;
      pkg_label := 'Envío de paquete · ' || case payload->>'package_weight'
        when 'light'  then '0 – 9 kg'
        when 'medium' then '10 – 19 kg'
        else '20 – 30 kg' end;
    end if;
    lines := public.quote_line(
      lines, 'base', pkg_label,
      coalesce((t->>pkg_key)::numeric,
        case pkg_key when 'pkg_light' then 4.99 when 'pkg_medium' then 7.99
                     when 'pkg_heavy' then 9.99 else 19.99 end));

  else
    -- Base del servicio
    if svc = 'mini_mudanza' then
      lines := public.quote_line(lines, 'base', 'Mini mudanza · 2 h incluidas',
                                 coalesce((t->>'mudanza_base')::numeric, 99));

      hours := greatest(0, coalesce((payload->>'extra_hours')::numeric, 0));
      lines := public.quote_line(lines, 'extra_hours', hours::int || ' h extra',
                                 hours * coalesce((t->>'mudanza_extra_hour')::numeric, 25));

      if coalesce((payload->>'needs_help')::boolean, false) then
        lines := public.quote_line(lines, 'help', 'Ayuda del conductor',
                                   coalesce((t->>'mudanza_help')::numeric, 39));

        -- Las plantas solo se cobran con ayuda contratada: sin ayuda el
        -- servicio es a pie de calle y el conductor no sube.
        floor_price := coalesce((t->>'mudanza_floor')::numeric, 15);
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
    end if;

    if coalesce((payload->>'insurance_selected')::boolean, false) then
      lines := public.quote_line(lines, 'insurance', 'Seguro de mercancía',
                                 coalesce((t->>'insurance')::numeric, 12));
    end if;
  end if;

  select coalesce(sum((e->>'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) e;

  return jsonb_build_object('total', round(total, 2), 'lines', lines, 'service_type', svc);
end;
$$;

grant execute on function public.compute_quote(jsonb) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 5. El precio lo pone SIEMPRE el servidor
--    Antes solo se recalculaba en la RPC de invitado; el cliente autenticado
--    mandaba su propio estimated_price.
-- ------------------------------------------------------------
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

  -- La firma la impone el servicio, no el formulario.
  new.signature_required := new.service_type in ('porte_tienda', 'paquete');

  -- Solo el envío de paquetes puede entregar fuera de la capital.
  if new.service_type <> 'paquete' then
    new.destination_zone := 'albacete';
  end if;

  -- Sin ayuda contratada no hay subida a pisos: no se cobran plantas.
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

drop trigger if exists trg_set_request_price on public.transport_requests;
create trigger trg_set_request_price
  before insert on public.transport_requests
  for each row execute function public.set_request_price();

-- ------------------------------------------------------------
-- 6. Solicitud como invitado
--    Ya no calcula el precio (lo hace el trigger); valida zona, duplicados y
--    persiste los campos nuevos del formulario.
-- ------------------------------------------------------------
create or replace function public.create_guest_request(payload jsonb)
returns public.transport_requests
language plpgsql security definer
set search_path = public
as $$
declare
  r    public.transport_requests;
  svc  text;
  dest_zone text;
  stop jsonb;
begin
  svc := public.resolve_service_type(payload);
  dest_zone := case when svc = 'paquete' and payload->>'destination_zone' = 'villarrobledo'
                    then 'villarrobledo' else 'albacete' end;

  -- La recogida es siempre en Albacete capital.
  if (payload->>'origin_address') !~ '0200[1-8]' then
    raise exception 'invalid_postal_code';
  end if;

  if dest_zone = 'villarrobledo' then
    if (payload->>'destination_address') !~ '02600' then
      raise exception 'invalid_postal_code';
    end if;
  elsif (payload->>'destination_address') !~ '0200[1-8]' then
    raise exception 'invalid_postal_code';
  end if;

  -- Las paradas intermedias también tienen que estar dentro de la capital.
  for stop in select * from jsonb_array_elements(coalesce(payload->'stops', '[]'::jsonb))
  loop
    if coalesce(btrim(stop->>'address'), '') <> '' and (stop->>'address') !~ '0200[1-8]' then
      raise exception 'invalid_postal_code';
    end if;
  end loop;

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

  insert into public.transport_requests (
    client_name, client_phone, origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    cargo_description, cargo_photos, distance_km,
    helpers_count, needs_help, help_description,
    extra_hours, insurance_selected,
    payment_method, notes, service_type, package_weight,
    stops, origin_has_lift, origin_floors, destination_has_lift, destination_floors,
    items_count, destination_zone, recipient_name, recipient_phone
  ) values (
    payload->>'client_name', payload->>'client_phone',
    payload->>'origin_address', payload->>'destination_address',
    (payload->>'origin_lat')::double precision, (payload->>'origin_lng')::double precision,
    (payload->>'destination_lat')::double precision, (payload->>'destination_lng')::double precision,
    payload->>'cargo_description', coalesce(payload->'cargo_photos', '[]'::jsonb),
    (payload->>'distance_km')::numeric,
    0,
    coalesce((payload->>'needs_help')::boolean, false),
    payload->>'help_description',
    coalesce((payload->>'extra_hours')::numeric, 0),
    coalesce((payload->>'insurance_selected')::boolean, false),
    coalesce(payload->>'payment_method', 'cash'),
    payload->>'notes', svc, payload->>'package_weight',
    coalesce(payload->'stops', '[]'::jsonb),
    (payload->>'origin_has_lift')::boolean,
    coalesce((payload->>'origin_floors')::integer, 0),
    (payload->>'destination_has_lift')::boolean,
    coalesce((payload->>'destination_floors')::integer, 0),
    (payload->>'items_count')::integer,
    dest_zone,
    payload->>'recipient_name', payload->>'recipient_phone'
  ) returning * into r;

  return r;
end;
$$;

-- ------------------------------------------------------------
-- 7. Pruebas de entrega (firma del receptor)
--    Bucket PRIVADO: una firma manuscrita es un dato personal y no debe quedar
--    en una URL pública adivinable. Se guarda como 'delivery-proofs://<path>'
--    con el id del pedido como primera carpeta, que es lo que usa la policy
--    para decidir quién puede verla: su cliente, su conductor o el staff.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

drop policy if exists "delivery proofs upload" on storage.objects;
create policy "delivery proofs upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-proofs'
    and exists (
      select 1 from public.transport_requests tr
      -- Comparación en texto a propósito: castear la carpeta a uuid haría
      -- fallar la policy entera si algún objeto tuviera un nombre inesperado.
      where tr.id::text = (storage.foldername(name))[1]
        and (tr.driver_id = auth.uid() or public.is_staff())
    )
  );

drop policy if exists "delivery proofs read" on storage.objects;
create policy "delivery proofs read" on storage.objects for select to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and exists (
      select 1 from public.transport_requests tr
      -- Comparación en texto a propósito: castear la carpeta a uuid haría
      -- fallar la policy entera si algún objeto tuviera un nombre inesperado.
      where tr.id::text = (storage.foldername(name))[1]
        and (tr.created_by_id = auth.uid() or tr.driver_id = auth.uid() or public.is_staff())
    )
  );

-- ------------------------------------------------------------
-- 8. Índice para el listado del conductor por servicio
-- ------------------------------------------------------------
create index if not exists transport_requests_service_status_idx
  on public.transport_requests (service_type, status);

-- ------------------------------------------------------------
-- 9. `final_price` se estampa al cerrar el servicio
--    Hasta ahora nadie lo escribía y toda la app lee
--    `final_price || estimated_price`; los extras de la app del conductor
--    (horas excedidas, ayuda añadida) necesitan partir del precio real de
--    cierre. Corre después de trg_protect_order_payment_fields (orden
--    alfabético: …protect… < …stamp…), que ya ha descartado cualquier
--    final_price que intentara colar el cliente; aquí lo fija el servidor.
-- ------------------------------------------------------------
create or replace function public.stamp_final_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and old.status is distinct from 'delivered'
     and new.final_price is null then
    new.final_price := new.estimated_price;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_final_price on public.transport_requests;
create trigger trg_stamp_final_price
  before update on public.transport_requests
  for each row execute function public.stamp_final_price();

-- Los pedidos ya entregados quedan con su precio de cierre consolidado.
update public.transport_requests
set final_price = estimated_price
where status = 'delivered' and final_price is null;
