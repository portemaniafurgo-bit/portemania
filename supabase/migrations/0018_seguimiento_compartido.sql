-- ============================================================
-- 0018 — Compartir el seguimiento, como Uber o Cabify
--
-- Quien espera la carga en el destino no tiene por qué tener cuenta: el cliente
-- le manda un enlace y ve llegar la furgoneta. Hasta ahora había que ir
-- contando por WhatsApp "ya sale", "está llegando".
--
-- Reglas:
--   · El enlace lleva un token imposible de adivinar (no el id del pedido).
--   · Devuelve SOLO lo justo para seguir la entrega: estado, nombre de pila del
--     conductor, su posición y a dónde va. Nada de teléfonos, precios,
--     direcciones completas de recogida ni datos del cliente.
--   · Deja de funcionar en cuanto el servicio termina.
-- ============================================================

alter table public.transport_requests
  add column if not exists share_token text;

create unique index if not exists transport_requests_share_token_idx
  on public.transport_requests(share_token)
  where share_token is not null;

comment on column public.transport_requests.share_token is
  'Token del enlace público de seguimiento. Lo genera el dueño del pedido al compartirlo; sirve para leer una vista MUY recortada mientras el servicio está vivo.';

/** Crea (o devuelve) el token del pedido. Solo su dueño. */
create or replace function public.get_share_token(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  token text;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;
  if req.created_by_id is distinct from auth.uid() then raise exception 'No es tu pedido'; end if;

  if req.share_token is not null then return req.share_token; end if;

  -- 40 caracteres aleatorios: ni se adivina ni se recorre por fuerza bruta.
  -- gen_random_uuid() es de PostgreSQL, no de pgcrypto: no depende de qué
  -- extensiones estén en el search_path.
  token := md5(gen_random_uuid()::text) || substr(md5(gen_random_uuid()::text), 1, 8);
  update transport_requests set share_token = token where id = p_request_id;
  return token;
end;
$$;

/**
 * Vista pública del seguimiento. La usa la página compartida SIN sesión, así
 * que devuelve lo mínimo y nada más.
 */
create or replace function public.track_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  prof driver_profiles%rowtype;
begin
  if p_token is null or length(p_token) < 12 then return null; end if;

  select * into req from transport_requests where share_token = p_token;
  if req.id is null then return null; end if;

  -- Terminado o cancelado: el enlace deja de enseñar posiciones.
  if req.status not in ('accepted', 'in_transit', 'picked_up') then
    return jsonb_build_object('status', req.status, 'finished', true);
  end if;

  select d.* into prof from driver_profiles d
   where d.created_by_id = req.driver_id
   order by d.created_date limit 1;

  return jsonb_build_object(
    'status', req.status,
    'finished', false,
    'service_type', req.service_type,
    -- Solo el nombre de pila: quien recibe no necesita el apellido del conductor.
    'driver_name', split_part(coalesce(req.driver_name, prof.full_name, 'Conductor'), ' ', 1),
    'driver_lat', prof.current_lat,
    'driver_lng', prof.current_lng,
    'location_updated_at', prof.location_updated_at,
    'destination_address', req.destination_address,
    'destination_lat', req.destination_lat,
    'destination_lng', req.destination_lng
  );
end;
$$;

revoke all on function public.get_share_token(uuid) from public, anon;
grant execute on function public.get_share_token(uuid) to authenticated;
-- track_by_token SÍ es para anónimos: ese es su motivo de existir.
grant execute on function public.track_by_token(text) to anon, authenticated;
