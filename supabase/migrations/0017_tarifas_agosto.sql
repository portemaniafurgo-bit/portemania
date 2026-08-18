-- ============================================================
-- 0017 — Cambios de tarifa de agosto 2026
--
--   · Fuera el seguro de mercancía (de momento).
--   · Porte: +3 € por cada objeto a partir del primero.
--   · Descuento por pagar con tarjeta: 2 € en el porte y 3 % en la mini
--     mudanza. Empuja el pago por app, que es el que deja rastro.
--   · La oferta del cliente no puede bajar de 30 € en ningún caso.
--
-- El precio que se cobra lo fija SIEMPRE esta función: la app y la web solo
-- enseñan. Si cambias una regla aquí, cámbiala también en lib/pricing.js
-- (móvil y web).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tarifas nuevas
-- ------------------------------------------------------------
update public.app_settings
   set value = value
     || jsonb_build_object('porte_item', 3)
     || jsonb_build_object('card_discount_porte', 2)
     || jsonb_build_object('card_discount_mudanza_pct', 3)
 where key = 'tariffs';

-- ------------------------------------------------------------
-- 2. Precio del pedido, con las reglas nuevas
-- ------------------------------------------------------------
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

      -- Objetos adicionales: el primero va en el precio base.
      n_items := greatest(0, coalesce((payload->>'items_count')::integer, 1) - 1);
      lines := public.quote_line(lines, 'items',
        n_items || ' objeto' || case when n_items = 1 then '' else 's' end || ' adicional' ||
        case when n_items = 1 then '' else 'es' end,
        n_items * coalesce((t->>'porte_item')::numeric, 3));
    end if;
  end if;

  select coalesce(sum((e->>'amount')::numeric), 0) into total
  from jsonb_array_elements(lines) e;

  -- Descuento por pagar con tarjeta. Va al final, sobre el total ya sumado, y
  -- entra como línea negativa para que el cliente lo VEA en el desglose.
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

-- ------------------------------------------------------------
-- 3. Suelo de la oferta del cliente: 30 € y nunca menos
-- ------------------------------------------------------------
create or replace function public.zz_validate_proposed_price()
returns trigger
language plpgsql
as $$
declare
  suelo numeric;
begin
  if new.proposed_price is not null then
    -- El mayor de los dos: 30 € o el 60 % de la tarifa. Por debajo de 30 € no
    -- le sale a cuenta a nadie coger el servicio.
    suelo := greatest(30, ceil(coalesce(new.estimated_price, 0) * 0.6));

    if new.proposed_price < suelo then
      raise exception 'Tu oferta es demasiado baja: el mínimo para este servicio es % €', suelo;
    end if;
    if new.proposed_price > 500 then
      raise exception 'La oferta máxima es 500 €';
    end if;
  end if;
  return new;
end;
$$;
