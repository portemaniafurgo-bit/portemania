-- ============================================================
-- 0029 — Los campos clave del pedido solo los cambia quien debe
--
-- Agujero que venía de atrás (independiente de Partners): la política de
-- UPDATE de transport_requests (0003) deja al cliente dueño, al conductor
-- asignado y a CUALQUIER conductor verificado (sobre un pedido pendiente)
-- cambiar cualquier columna de la fila salvo las de cobro que ya protegen la
-- 0007/0027. Así, un cliente podía mandar {estimated_price: 1, status:
-- 'delivered'} sobre su propio pedido (trg_stamp_final_price copiaba ese precio
-- a final_price), cambiar created_by_id, o un conductor ajeno podía subir el
-- proposed_price de un pedido pendiente y aceptarlo con accept_at_client_price
-- (que copia proposed_price a final_price; el validador de la 0014 solo mira
-- los INSERT).
--
-- Este trigger NUEVO (no sustituye a ninguno) corre ANTES de
-- trg_protect_order_payment_fields y trg_stamp_final_price (orden alfabético:
-- set_updated_date < trg_protect_order_core… < trg_protect_order_payment… <
-- trg_stamp… < zz_stamp…). Para quien no es servidor ni staff:
--
--   · Un TERCERO (conductor verificado que no es ni el dueño ni el conductor
--     asignado) solo puede ACEPTAR: de su update se aplican status,
--     driver_id, driver_name y accepted_at; todo lo demás vuelve a como estaba,
--     incluidas las columnas que se añadan en el futuro.
--   · Dueño y precio congelados: created_by_id, created_by, estimated_price,
--     price_breakdown y las entradas con las que se calculó el precio al crear
--     el pedido (set_request_price / compute_quote, 0026).
--   · Precio ofrecido (proposed_price): solo el dueño, solo con el pedido
--     pendiente y sin conductor, y dentro de los límites de la 0014 (mínimo
--     5 € y el 60 % del precio calculado) con un máximo de 5 veces el precio
--     calculado (al menos 500 €). Fuera de límites → error. Aceptado el
--     pedido, queda fijo.
--   · Forma de pago: libre mientras el pedido está abierto; congelada al
--     entregarse o cancelarse.
--   · Conductor: solo de nadie a uno mismo (aceptar, siendo conductor
--     verificado y con el pedido pendiente) o de uno mismo a nadie (el
--     conductor cancela y el pedido vuelve a pendientes).
--   · Estado: a 'delivered' solo el conductor asignado y desde 'picked_up'
--     (lo único que hacen la web y la app, en todas sus versiones); salir de
--     'delivered' no se puede. El resto de transiciones, como estaban.
--
-- Un cambio prohibido se deshace en silencio (como la 0007), salvo el estado,
-- el precio ofrecido fuera de límites y un cambio de conductor rechazado junto
-- con un cambio de estado: ahí se lanza un error claro (guardar a medias haría
-- creer a la app algo que no pasó, p. ej. un pedido 'accepted' sin conductor).
--
-- Las RPC security definer (aceptar oferta, cancelar como cliente, fases del
-- conductor, confirmar cobro…) corren como postgres y no pasan por aquí; las
-- Edge Functions usan service_role y tampoco.
--
-- APLICAR: en la misma sesión, antes del fichero:
--     set lock_timeout = '3s';
--   (crear el trigger toma un bloqueo sobre transport_requests: si hay
--   actividad, mejor fallar a los 3 s y reintentar que dejar la app esperando).
--
-- MARCHA ATRÁS (solo si hiciera falta):
--     drop trigger if exists trg_protect_order_core_fields on public.transport_requests;
--     drop function if exists public.protect_order_core_fields();
--     drop function if exists public.order_actor_is_verified_driver();
--   ¡NO deshacer la 0029 mientras la 0028 (Partners) esté en producción! Sin
--   ella, un cliente o un conductor ajeno pueden inflar el precio de un pedido
--   y con él la comisión de un comercial.
-- ============================================================

/**
 * ¿El usuario actual es conductor verificado? Mismo criterio que la política
 * de UPDATE de la 0003 (perfil propio por created_by_id o por email del JWT).
 * security definer para no depender de la RLS de driver_profiles.
 */
create or replace function public.order_actor_is_verified_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.driver_profiles dp
     where (dp.created_by_id = auth.uid() or lower(dp.email) = lower(auth.jwt() ->> 'email'))
       and dp.status = 'verified'
  );
$$;

revoke all on function public.order_actor_is_verified_driver() from public, anon;
grant execute on function public.order_actor_is_verified_driver() to authenticated;

create or replace function public.protect_order_core_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_is_driver boolean;
  v_keep jsonb;
  v_accepting boolean;
  v_max numeric;
begin
  -- Servidor (backoffice, RPC security definer, Edge Functions) y staff: libre.
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if public.is_staff() then
    return new;
  end if;

  -- "is not distinct from" y no "=": con un NULL (pedido sin conductor) el
  -- "=" daría NULL y el tercero se colaría por la rama de dueño/conductor.
  v_is_owner := v_uid is not null and old.created_by_id is not distinct from v_uid;
  v_is_driver := v_uid is not null and old.driver_id is not distinct from v_uid;

  -- 0) Un tercero solo puede aceptar: se reconstruye la fila desde OLD y se
  --    reaplican únicamente las cuatro columnas de la aceptación (y la marca
  --    updated_date que puso set_updated_date, si existe). Hecho con jsonb para
  --    que las columnas que se añadan en el futuro queden protegidas solas.
  if not v_is_owner and not v_is_driver then
    v_keep := jsonb_build_object(
      'status', new.status,
      'driver_id', new.driver_id,
      'driver_name', new.driver_name,
      'accepted_at', new.accepted_at);
    if to_jsonb(new) ? 'updated_date' then
      v_keep := v_keep || jsonb_build_object('updated_date', to_jsonb(new) -> 'updated_date');
    end if;
    new := jsonb_populate_record(old, v_keep);
  end if;

  -- 1) Dueño y precio: nunca desde el navegador.
  new.created_by_id := old.created_by_id;
  new.created_by := old.created_by;
  new.estimated_price := old.estimated_price;
  new.price_breakdown := old.price_breakdown;
  -- Entradas del precio (las que lee compute_quote). Cambiarlas después no
  -- recalcula nada, pero sí falsearía cualquier comparación con el presupuesto.
  new.service_type := old.service_type;
  new.vehicle_type := old.vehicle_type;
  new.needs_help := old.needs_help;
  new.origin_floors := old.origin_floors;
  new.destination_floors := old.destination_floors;
  new.origin_has_lift := old.origin_has_lift;
  new.destination_has_lift := old.destination_has_lift;
  new.origin_zone := old.origin_zone;
  new.destination_zone := old.destination_zone;
  new.extra_hours := old.extra_hours;
  new.items_count := old.items_count;
  new.package_weight := old.package_weight;
  new.stops := old.stops;

  -- 2) Precio ofrecido: solo el dueño, con el pedido pendiente y sin
  --    conductor, y dentro de límites (los de la 0014 al crear, con techo de
  --    5 veces el precio calculado y al menos 500 €).
  if new.proposed_price is distinct from old.proposed_price then
    if v_is_owner and old.status = 'pending' and old.driver_id is null then
      if new.proposed_price is not null then
        if new.proposed_price < 5 then
          raise exception 'La oferta mínima es 5 €';
        end if;
        if old.estimated_price is not null and new.proposed_price < old.estimated_price * 0.6 then
          raise exception 'Tu oferta es demasiado baja: el mínimo para este servicio es % €',
            ceil(old.estimated_price * 0.6);
        end if;
        v_max := greatest(500, coalesce(old.estimated_price, 0) * 5);
        if new.proposed_price > v_max then
          raise exception 'Tu oferta es demasiado alta: el máximo para este servicio es % €', v_max;
        end if;
      end if;
    else
      new.proposed_price := old.proposed_price;
    end if;
  end if;

  -- 3) Forma de pago: se puede cambiar mientras el pedido está abierto.
  if old.status in ('delivered', 'cancelled') then
    new.payment_method := old.payment_method;
  end if;

  -- 4) Conductor: aceptar (nadie → yo) o soltar (yo → nadie). Nada más.
  v_accepting := coalesce(old.driver_id is null and v_uid is not null
                          and new.driver_id is not distinct from v_uid
                          and old.status = 'pending' and public.order_actor_is_verified_driver(), false);
  if new.driver_id is distinct from old.driver_id then
    if not (v_accepting or (v_is_driver and new.driver_id is null)) then
      -- Con cambio de estado, deshacer solo el conductor dejaría p. ej. un
      -- pedido 'accepted' sin conductor: mejor un error claro.
      if new.status is distinct from old.status then
        raise exception 'No puedes cambiar el conductor de este servicio.';
      end if;
      new.driver_id := old.driver_id;
    end if;
  end if;
  -- Un tercero que no está aceptando no toca nada de la aceptación.
  if not v_is_owner and not v_is_driver and not v_accepting then
    new.driver_name := old.driver_name;
    new.accepted_at := old.accepted_at;
  end if;

  -- 5) Estado.
  if new.status is distinct from old.status then
    if old.status = 'delivered' then
      raise exception 'Este servicio ya está entregado y no se puede cambiar desde la app. Si hay un problema, contacta con ClicyVoy.';
    end if;
    if new.status = 'delivered' then
      if v_uid is null
         or old.driver_id is distinct from v_uid
         or new.driver_id is distinct from v_uid
         or old.status <> 'picked_up' then
        raise exception 'Solo el conductor del servicio puede darlo por entregado, y después de recoger la carga.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.protect_order_core_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_order_core_fields on public.transport_requests;
create trigger trg_protect_order_core_fields
  before update on public.transport_requests
  for each row execute function public.protect_order_core_fields();
