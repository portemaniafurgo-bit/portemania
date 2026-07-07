-- ============================================================
-- 0007 — Endurecimiento tras la auditoría integral (2026-07-07)
--
-- 1) driver_profiles: la policy UPDATE no tenía WITH CHECK → un conductor
--    podía auto-verificarse (status='verified') y ver los pedidos pendientes
--    con PII de clientes, o inflar su rating. Trigger BEFORE UPDATE que
--    congela los campos operativos para no-staff (una policy no puede
--    comparar con OLD).
-- 2) transport_requests: cualquier dueño podía marcar su pedido como pagado
--    sin pagar (payment_status en el WITH CHECK sin restricción de columnas).
--    Ahora payment_status/final_price/stripe_session_id solo los cambia
--    staff o service_role (la Edge Function confirm-payment, que verifica el
--    cargo REAL en Stripe antes de escribir).
-- 3) profiles: el staff no podía resolver el uid de un conductor por email al
--    reasignar pedidos (la policy solo dejaba is_admin) → fallaba en silencio
--    y podía asignar el uid equivocado.
-- 4) create_guest_request: el invitado fijaba su propio precio (estimated_price
--    del payload sin recalcular) y el aviso de duplicado comparaba el teléfono
--    como texto exacto ("612 345 678" ≠ "612345678").
-- ============================================================

-- ---------- 1) driver_profiles: campos operativos solo staff ----------
create or replace function public.protect_driver_profile_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- postgres/service_role: backoffice, Edge Functions y el trigger
  -- sync_driver_rating (SECURITY DEFINER) siguen funcionando.
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
     or coalesce(auth.role(), '') = 'service_role'
     or public.is_staff() then
    return new;
  end if;
  new.status := old.status;
  new.average_rating := old.average_rating;
  new.total_trips := old.total_trips;
  return new;
end;
$$;

drop trigger if exists trg_protect_driver_profile_fields on public.driver_profiles;
create trigger trg_protect_driver_profile_fields
  before update on public.driver_profiles
  for each row execute function public.protect_driver_profile_fields();

-- ---------- 2) transport_requests: campos de pago solo staff/servidor ----------
create or replace function public.protect_order_payment_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
     or coalesce(auth.role(), '') = 'service_role'
     or public.is_staff() then
    return new;
  end if;
  new.payment_status := old.payment_status;
  new.final_price := old.final_price;
  new.stripe_session_id := old.stripe_session_id;
  return new;
end;
$$;

drop trigger if exists trg_protect_order_payment_fields on public.transport_requests;
create trigger trg_protect_order_payment_fields
  before update on public.transport_requests
  for each row execute function public.protect_order_payment_fields();

-- ---------- 3) profiles legibles por staff (reasignación de pedidos) ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());

-- ---------- 4) create_guest_request: precio de servidor + teléfono normalizado ----------
create or replace function public.create_guest_request(payload jsonb)
returns public.transport_requests
language plpgsql security definer
set search_path = public
as $$
declare
  r public.transport_requests;
  t jsonb;
  vt text;
  price numeric;
begin
  if (payload->>'origin_address') !~ '0200[1-8]'
     or (payload->>'destination_address') !~ '0200[1-8]' then
    raise exception 'invalid_postal_code';
  end if;

  -- Aviso de duplicado: mismo teléfono NORMALIZADO (solo dígitos) con un
  -- pedido pendiente en los últimos 30 min, salvo confirmación (force=true).
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

  -- Precio recalculado EN SERVIDOR desde las tarifas vigentes: el payload del
  -- invitado no decide cuánto cuesta (misma fórmula que create-payment-intent).
  select coalesce(value, '{}'::jsonb) into t
  from public.app_settings where key = 'tariffs';
  vt := case when payload->>'vehicle_type' = 'large' then 'large' else 'small' end;
  price :=
      coalesce((t->>vt)::numeric, case vt when 'large' then 60 else 40 end)
    + coalesce((payload->>'extra_hours')::numeric, 0)
      * coalesce((t->>'extra_hour')::numeric, 15)
    + case when coalesce((payload->>'insurance_selected')::boolean, false)
        then coalesce((t->>'insurance')::numeric, 12) else 0 end
    + case when coalesce((payload->>'needs_help')::boolean, false)
        then coalesce((t->>'help_price')::numeric, 30) else 0 end;

  insert into public.transport_requests (
    client_name, client_phone, origin_address, destination_address,
    origin_lat, origin_lng, destination_lat, destination_lng,
    cargo_description, cargo_photos, vehicle_type, distance_km,
    helpers_count, needs_help, help_description,
    extra_hours, insurance_selected, estimated_price,
    payment_method, notes
  ) values (
    payload->>'client_name', payload->>'client_phone',
    payload->>'origin_address', payload->>'destination_address',
    (payload->>'origin_lat')::double precision, (payload->>'origin_lng')::double precision,
    (payload->>'destination_lat')::double precision, (payload->>'destination_lng')::double precision,
    payload->>'cargo_description', coalesce(payload->'cargo_photos', '[]'::jsonb),
    payload->>'vehicle_type', (payload->>'distance_km')::numeric,
    coalesce((payload->>'helpers_count')::integer, 0),
    coalesce((payload->>'needs_help')::boolean, false),
    payload->>'help_description',
    coalesce((payload->>'extra_hours')::numeric, 0),
    coalesce((payload->>'insurance_selected')::boolean, false),
    price,
    coalesce(payload->>'payment_method', 'cash'),
    payload->>'notes'
  ) returning * into r;
  return r;
end;
$$;

-- Refresca el caché de esquema de PostgREST
notify pgrst, 'reload schema';
