-- ============================================================
-- 0024 — El efectivo queda PAGADO al entregar, y el porte gana la ayuda
--
-- 1. Un servicio en efectivo se cobra en mano al terminar. Nadie lo marcaba
--    como pagado, así que el recibo decía PENDIENTE para siempre (bug real,
--    27/08/2026). Ahora, al pasar a entregado, el efectivo queda pagado solo.
--    La tarjeta NO se toca: ahí quien manda es la confirmación de Stripe.
--
-- 2. El porte solo ofrecía «a pie de calle». El canvas (1e) siempre tuvo
--    «Porte con ayuda · 12 €» con sus plantas, como la mini mudanza: se añade
--    la tarifa porte_help y el cálculo correspondiente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Efectivo entregado = efectivo cobrado
-- ------------------------------------------------------------
create or replace function public.zz_settle_cash_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'delivered'
     and coalesce(old.status, '') <> 'delivered'
     and new.payment_method = 'cash'
     and coalesce(new.payment_status, 'pending') <> 'paid' then
    new.payment_status := 'paid';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_settle_cash_on_delivery on public.transport_requests;
create trigger zz_settle_cash_on_delivery
  before update of status on public.transport_requests
  for each row execute function public.zz_settle_cash_on_delivery();

-- Histórico: lo ya entregado en efectivo se cobró en su día. Sin esto, los
-- recibos antiguos seguirían diciendo PENDIENTE.
update public.transport_requests
   set payment_status = 'paid'
 where status = 'delivered'
   and payment_method = 'cash'
   and coalesce(payment_status, 'pending') <> 'paid';

-- ------------------------------------------------------------
-- 2. Ayuda del conductor en el PORTE (12 € según el canvas)
-- ------------------------------------------------------------
update public.app_settings
   set value = value || jsonb_build_object('porte_help', 12)
 where key = 'tariffs'
   and not (value ? 'porte_help');

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
  zone text;
  discount numeric;
begin
  select value into t from public.app_settings where key = 'tariffs';
  t := coalesce(t, '{}'::jsonb);

  svc := coalesce(payload->>'service_type', payload->>'service', 'porte');
  if svc not in ('porte', 'mini_mudanza', 'porte_tienda', 'paquete') then svc := 'porte'; end if;

  if svc = 'paquete' then
    zone := coalesce(payload->>'destination_zone', 'albacete');
    if zone = 'villarrobledo' then
      pkg_key := 'pkg_villarrobledo';
      pkg_label := 'Envío a Villarrobledo · hasta 10 kg';
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

      -- Objetos adicionales: el primero va en el precio base.
      n_items := greatest(0, coalesce((payload->>'items_count')::integer, 1) - 1);
      lines := public.quote_line(lines, 'items',
        n_items || ' objeto' || case when n_items = 1 then '' else 's' end || ' adicional' ||
        case when n_items = 1 then '' else 'es' end,
        n_items * coalesce((t->>'porte_item')::numeric, 3));
    end if;

    -- Ayuda del conductor: en la mini mudanza (39 €) y AHORA también en el
    -- porte (12 €, canvas 1e). Las plantas solo se cobran con ayuda: sin ella
    -- el servicio es a pie de calle y el conductor no sube.
    if svc in ('porte', 'mini_mudanza') and coalesce((payload->>'needs_help')::boolean, false) then
      help_price := case when svc = 'porte'
        then coalesce((t->>'porte_help')::numeric, 12)
        else coalesce((t->>'mudanza_help')::numeric, 39) end;
      lines := public.quote_line(lines, 'help', 'Ayuda del conductor', help_price);

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
  end if;

  select coalesce(sum((e->>'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) e;

  -- Descuento por pagar con tarjeta, como línea visible del desglose.
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
