-- ============================================================
-- 0019 — Cancelación del cliente con penalización
--
-- Como Uber, Bolt y Cabify: cancelar se puede casi siempre, pero cuando ya hay
-- un conductor que ha dejado lo que estaba haciendo y ha arrancado, cuesta.
--
--   · Sin conductor todavía (pendiente o programado) → GRATIS, siempre.
--   · Con conductor y dentro de los 2 primeros minutos → GRATIS. Es el margen
--     para el "me he equivocado de dirección" o el "me lo pensé mejor".
--   · Con conductor y pasado ese margen → 5 €.
--   · Con la carga ya recogida → NO se cancela desde la app. La mercancía es
--     del cliente y soltarla a medias no es una opción: se llama a la empresa.
--
-- Importe y margen viven en tarifas (app_settings.tariffs) para cambiarlos
-- desde el panel sin tocar código.
--
-- IMPORTANTE: la penalización se REGISTRA, no se cobra sola. Cobrarla exige
-- tarjeta guardada (Stripe customer), que es una tarea aparte. Mientras tanto
-- queda anotada en el pedido y la empresa decide qué hacer con ella.
-- ============================================================

alter table public.transport_requests
  add column if not exists cancellation_fee numeric,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists client_cancel_reason text;

comment on column public.transport_requests.cancellation_fee is
  'Penalización por cancelar con conductor asignado, en euros. Se registra al cancelar; el cobro es decisión aparte.';

update public.app_settings
   set value = value
     || jsonb_build_object('cancel_fee', 5)
     || jsonb_build_object('cancel_grace_minutes', 2)
 where key = 'tariffs'
   and not (value ? 'cancel_fee');

/**
 * Cancelación del cliente. Devuelve el pedido ya cancelado, con la penalización
 * aplicada si tocaba, para que la app pueda enseñarla sin recalcular nada.
 *
 * El importe lo decide el SERVIDOR: si lo calculara la app, bastaría con
 * cambiar el reloj del móvil para cancelar gratis siempre.
 */
create or replace function public.cancel_order_as_client(
  p_request_id uuid,
  p_reason text default null
) returns transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  t jsonb;
  fee numeric := 0;
  grace_minutes numeric;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null then raise exception 'Pedido no encontrado'; end if;
  if req.created_by_id is distinct from auth.uid() then raise exception 'No es tu pedido'; end if;

  if req.status in ('delivered', 'cancelled') then
    raise exception 'Este pedido ya está cerrado';
  end if;
  if req.status = 'picked_up' then
    raise exception 'La carga ya está recogida: llama a la empresa para resolverlo';
  end if;

  select value into t from public.app_settings where key = 'tariffs';
  grace_minutes := coalesce((t->>'cancel_grace_minutes')::numeric, 2);

  -- Solo se penaliza si hay conductor que ya se puso en marcha y se pasó el
  -- margen de cortesía.
  if req.driver_id is not null and req.accepted_at is not null
     and now() > req.accepted_at + make_interval(mins => grace_minutes::int) then
    fee := coalesce((t->>'cancel_fee')::numeric, 5);
  end if;

  update transport_requests
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = 'client',
         client_cancel_reason = nullif(btrim(p_reason), ''),
         cancellation_fee = nullif(fee, 0)
   where id = p_request_id
  returning * into req;

  return req;
end;
$$;

revoke all on function public.cancel_order_as_client(uuid, text) from public, anon;
grant execute on function public.cancel_order_as_client(uuid, text) to authenticated;

/**
 * Lo que costaría cancelar AHORA MISMO. La app lo pregunta antes de enseñar la
 * confirmación: nadie debe descubrir la penalización después de aceptarla.
 */
create or replace function public.cancellation_fee_now(p_request_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req transport_requests%rowtype;
  t jsonb;
  grace_minutes numeric;
begin
  select * into req from transport_requests where id = p_request_id;
  if req.id is null or req.created_by_id is distinct from auth.uid() then return 0; end if;
  if req.driver_id is null or req.accepted_at is null then return 0; end if;

  select value into t from public.app_settings where key = 'tariffs';
  grace_minutes := coalesce((t->>'cancel_grace_minutes')::numeric, 2);

  if now() > req.accepted_at + make_interval(mins => grace_minutes::int) then
    return coalesce((t->>'cancel_fee')::numeric, 5);
  end if;
  return 0;
end;
$$;

grant execute on function public.cancellation_fee_now(uuid) to authenticated;
