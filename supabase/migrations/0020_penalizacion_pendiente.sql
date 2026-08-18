-- ============================================================
-- 0020 — La penalización pendiente se cobra en el siguiente servicio
--
-- Decisión tomada (19/08/2026): NO se cobra sola con tarjeta guardada. Cobrar
-- fuera de sesión en Europa exige mandato SCA, falla a menudo y convierte una
-- deuda de 5 € en una discusión con el banco. Uber hace exactamente esto: te
-- deja un saldo pendiente y te lo aplica al siguiente viaje.
--
-- Así que la penalización:
--   · Se anota al cancelar (migración 0019).
--   · Se suma como una línea al SIGUIENTE pedido de ese cliente.
--   · Queda saldada, apuntando al pedido donde se cobró (rastro para Finanzas).
--
-- El cliente la ve antes de publicar: el asistente pregunta cuánto debe.
-- ============================================================

alter table public.transport_requests
  add column if not exists cancellation_fee_settled_by uuid references public.transport_requests(id);

comment on column public.transport_requests.cancellation_fee_settled_by is
  'Pedido en el que se cobró esta penalización. NULL = todavía pendiente.';

create index if not exists transport_requests_pending_fee_idx
  on public.transport_requests(created_by_id)
  where cancellation_fee is not null and cancellation_fee_settled_by is null;

/** Lo que este cliente debe de cancelaciones anteriores. Lo consulta la app. */
create or replace function public.pending_cancellation_fee()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cancellation_fee), 0)
    from public.transport_requests
   where created_by_id = auth.uid()
     and cancellation_fee is not null
     and cancellation_fee_settled_by is null;
$$;

grant execute on function public.pending_cancellation_fee() to authenticated;

-- El precio del pedido, ahora con la deuda pendiente incluida.
create or replace function public.set_request_price()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  q jsonb;
  pending numeric := 0;
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

  -- Penalizaciones sin saldar de este cliente: se suman a ESTE pedido y se dan
  -- por cobradas apuntando a él. Se hace aquí y no en compute_quote porque
  -- compute_quote también sirve para presupuestar sin sesión.
  if new.created_by_id is not null then
    select coalesce(sum(cancellation_fee), 0) into pending
      from public.transport_requests
     where created_by_id = new.created_by_id
       and cancellation_fee is not null
       and cancellation_fee_settled_by is null;

    if pending > 0 then
      new.estimated_price := new.estimated_price + pending;
      new.price_breakdown := new.price_breakdown || jsonb_build_array(
        jsonb_build_object('key', 'pending_cancellation',
                           'label', 'Penalización por cancelación anterior',
                           'amount', pending)
      );
    end if;
  end if;

  return new;
end;
$$;

/**
 * Saldar la deuda va DESPUÉS de insertar, no antes: `cancellation_fee_settled_by`
 * apunta al pedido nuevo y esa fila todavía no existe en el trigger BEFORE
 * (la clave foránea lo rechazaba).
 */
create or replace function public.zz_settle_cancellation_fees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_id is null then return new; end if;

  update public.transport_requests
     set cancellation_fee_settled_by = new.id
   where created_by_id = new.created_by_id
     and cancellation_fee is not null
     and cancellation_fee_settled_by is null
     and id <> new.id;

  return new;
end;
$$;

drop trigger if exists zz_settle_cancellation_fees on public.transport_requests;
create trigger zz_settle_cancellation_fees
  after insert on public.transport_requests
  for each row execute function public.zz_settle_cancellation_fees();
