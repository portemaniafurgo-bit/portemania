-- ============================================================
-- 0022 — La valoración del conductor, que no existía
--
-- La app (y la web) llevaban tiempo pintando `driver_profiles.rating`… y esa
-- columna NUNCA se creó: por eso el conductor no veía su puntuación y el
-- cliente tampoco, aunque hubiera valoraciones de verdad en los pedidos.
--
-- Se añade la media y el número de valoraciones, se rellenan con el histórico
-- y se mantienen al día con un trigger: nadie tiene que acordarse de
-- recalcularlas.
-- ============================================================

alter table public.driver_profiles
  add column if not exists rating numeric,
  add column if not exists rating_count integer not null default 0;

comment on column public.driver_profiles.rating is
  'Media de las valoraciones del cliente (1-5). La recalcula el trigger zz_refresh_driver_rating; NADIE la escribe a mano.';

/** Recalcula media y número de valoraciones de un conductor. */
create or replace function public.refresh_driver_rating(p_driver_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.driver_profiles d
     set rating = sub.media,
         rating_count = sub.total
    from (
      select round(avg(client_rating)::numeric, 2) as media,
             count(*)::int as total
        from public.transport_requests
       where driver_id = p_driver_id
         and client_rating is not null
    ) sub
   where d.created_by_id = p_driver_id;
$$;

create or replace function public.zz_refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando cambia la valoración: no en cada cambio de estado del pedido.
  if new.driver_id is not null
     and new.client_rating is distinct from coalesce(old.client_rating, null) then
    perform public.refresh_driver_rating(new.driver_id);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_refresh_driver_rating on public.transport_requests;
create trigger zz_refresh_driver_rating
  after insert or update of client_rating on public.transport_requests
  for each row execute function public.zz_refresh_driver_rating();

-- Relleno con lo que ya había valorado.
update public.driver_profiles d
   set rating = sub.media, rating_count = sub.total
  from (
    select driver_id,
           round(avg(client_rating)::numeric, 2) as media,
           count(*)::int as total
      from public.transport_requests
     where client_rating is not null and driver_id is not null
     group by driver_id
  ) sub
 where d.created_by_id = sub.driver_id;
