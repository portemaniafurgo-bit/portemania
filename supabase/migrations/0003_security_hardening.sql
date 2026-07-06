-- ============================================================
-- 0003 — Endurecimiento de seguridad (revisión pre-entrega 2026-07-06)
-- Corrige: escalada a admin por signup/update, PII de conductores
-- legible por cualquier usuario, bucket de documentos público,
-- insert/update de pedidos demasiado abiertos, rating de perfiles
-- creados por admin, y validación de CP en servidor.
-- ============================================================

-- ---------- 1) Signup: el rol viene de metadatos del CLIENTE → whitelist ----------
-- Antes: coalesce(raw_user_meta_data->>'role','client') permitía registrarse
-- como 'admin' llamando a signUp con options.data.role='admin'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.email = 'renato.0550.calero@gmail.com' then 'admin'
      when new.raw_user_meta_data ->> 'role' in ('client', 'driver')
        then new.raw_user_meta_data ->> 'role'
      else 'client'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------- 2) profiles.role congelado para no-admins ----------
-- Antes: la policy de update de profiles permitía a cualquier usuario cambiar
-- SU PROPIA fila entera, incluido role='admin' → escalada total.
-- Se permite: service_role/postgres (backoffice, Edge Functions), admins,
-- y transiciones client<->driver (la app usa updateMe({role:'driver'})
-- cuando alguien completa su perfil de conductor).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
       or coalesce(auth.role(), '') = 'service_role'
       or public.is_admin() then
      return new;
    end if;
    if new.role in ('client', 'driver') and old.role in ('client', 'driver') then
      return new;
    end if;
    -- Cambio no autorizado: se conserva el rol anterior sin romper el update.
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- 3) driver_profiles: PII solo para quien corresponde ----------
-- Antes: select para CUALQUIER autenticado → teléfono, email, nº de carnet y
-- URLs de DNI/seguro/recibo autónomo/censal de toda la flota.
-- Ahora: staff/admin, el propio conductor, o el cliente que tiene un pedido
-- asignado a ese conductor (para ver nombre/foto/valoración en su pedido).
-- Helper security definer para evitar recursión de policies
-- (transport_requests ya referencia driver_profiles en las suyas).
create or replace function public.is_my_assigned_driver(dp_uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transport_requests tr
    where tr.created_by_id = auth.uid()
      and tr.driver_id = dp_uid
  );
$$;

drop policy if exists driver_profiles_select on public.driver_profiles;
create policy driver_profiles_select on public.driver_profiles for select
  using (
    public.is_staff()
    or created_by_id = auth.uid()
    or lower(email) = lower(auth.jwt() ->> 'email')
    or public.is_my_assigned_driver(created_by_id)
  );

-- ---------- 4) Storage: documentos de identidad en bucket PRIVADO ----------
-- Antes: driver-docs era público (DNI/seguros accesibles por URL sin sesión).
-- Ahora: privado; lectura solo dueño del fichero o staff (vía signed URLs).
update storage.buckets set public = false where id = 'driver-docs';

drop policy if exists "public read" on storage.objects;
create policy "public read" on storage.objects for select
  using (bucket_id in ('cargo-photos', 'avatars', 'blog-images'));

drop policy if exists "driver docs read" on storage.objects;
create policy "driver docs read" on storage.objects for select to authenticated
  using (
    bucket_id = 'driver-docs'
    and (owner_id = auth.uid()::text or public.is_staff())
  );

-- ---------- 5) transport_requests: insert/update acotados ----------
-- Antes: insert with check(true) (cualquiera podía insertar filas ya 'paid',
-- con driver_id arbitrario o a nombre de otro usuario) y update sin WITH CHECK.
-- El flujo de invitado NO se ve afectado: usa la RPC create_guest_request
-- (security definer). El insert directo queda solo para autenticados.
drop policy if exists transport_requests_insert on public.transport_requests;
create policy transport_requests_insert on public.transport_requests for insert
  to authenticated
  with check (
    public.is_staff()
    or (
      created_by_id = auth.uid()
      and driver_id is null
      and status = 'pending'
      and coalesce(payment_status, 'pending') <> 'paid'
    )
  );

drop policy if exists transport_requests_update on public.transport_requests;
create policy transport_requests_update on public.transport_requests for update
  using (
    public.is_staff()
    or created_by_id = auth.uid()
    or driver_id = auth.uid()
    or (
      status = 'pending'
      and exists (
        select 1 from public.driver_profiles dp
        where (dp.created_by_id = auth.uid() or lower(dp.email) = lower(auth.jwt() ->> 'email'))
          and dp.status = 'verified'
      )
    )
  )
  with check (
    public.is_staff()
    or created_by_id = auth.uid()
    -- el conductor solo puede dejar el pedido asignado a SÍ MISMO…
    or driver_id = auth.uid()
    -- …o devolverlo a pendiente sin asignar (cancelación del conductor)
    or (status = 'pending' and driver_id is null)
  );

-- ---------- 6) Rating: también para perfiles creados por el admin ----------
-- Antes: el trigger buscaba el perfil solo por created_by_id (en perfiles de
-- alta por admin apunta al admin) → la valoración nunca se actualizaba.
create or replace function public.sync_driver_rating()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.driver_id is not null and (
    (old.status is distinct from new.status and new.status = 'delivered')
    or (old.client_rating is distinct from new.client_rating)
  ) then
    update public.driver_profiles dp
    set average_rating = coalesce(sub.avg_rating, dp.average_rating),
        total_trips = sub.trips
    from (
      select
        round(avg(client_rating) filter (where client_rating is not null)::numeric, 2) as avg_rating,
        count(*) as trips
      from public.transport_requests
      where driver_id = new.driver_id and status = 'delivered'
    ) sub
    where dp.created_by_id = new.driver_id
       or lower(dp.email) = (select lower(p.email) from public.profiles p where p.id = new.driver_id);
  end if;
  return new;
end;
$$;

-- ---------- 7) CP validado también en servidor (flujo invitado) ----------
-- Antes: la RPC aceptaba cualquier dirección; la validación 02001-02008 solo
-- existía en el navegador.
create or replace function public.create_guest_request(payload jsonb)
returns public.transport_requests
language plpgsql security definer
set search_path = public
as $$
declare r public.transport_requests;
begin
  if (payload->>'origin_address') !~ '0200[1-8]'
     or (payload->>'destination_address') !~ '0200[1-8]' then
    raise exception 'invalid_postal_code';
  end if;

  -- Aviso de duplicado: si ya hay un pedido PENDIENTE con el mismo teléfono en
  -- los últimos 30 min, se rechaza salvo que el cliente confirme (force=true).
  if not coalesce((payload->>'force')::boolean, false) then
    if exists (
      select 1 from public.transport_requests tr
      where tr.client_phone = payload->>'client_phone'
        and tr.status = 'pending'
        and tr.created_date > now() - interval '30 minutes'
    ) then
      raise exception 'duplicate_pending';
    end if;
  end if;

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
    (payload->>'estimated_price')::numeric,
    coalesce(payload->>'payment_method', 'cash'),
    payload->>'notes'
  ) returning * into r;
  return r;
end;
$$;
