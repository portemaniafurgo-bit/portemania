-- PorteManía — esquema completo (reconstrucción del proyecto original onivkquggfshyjqfpuuw)
-- Convenciones Base44: id, created_date, updated_date, created_by, created_by_id.

-- Las funciones SQL referencian tablas creadas más abajo en este mismo script.
set check_function_bodies = off;

-- ============ FUNCIONES BASE ============

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or p.email = 'renato.0550.calero@gmail.com')
  );
$$;

-- Empleados (rol 'staff'): pueden operar pedidos e incidencias pero NO tocar
-- tarifas, usuarios ni verificación de conductores (eso sigue siendo is_admin).
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('admin', 'staff') or p.email = 'renato.0550.calero@gmail.com')
  );
$$;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

-- Rellena created_by / created_by_id con el usuario autenticado (si lo hay).
-- En inserts anónimos (solicitud como invitado) quedan NULL.
create or replace function public.set_created_by()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.created_by_id := coalesce(new.created_by_id, auth.uid());
    new.created_by := coalesce(new.created_by, (auth.jwt() ->> 'email'));
  end if;
  return new;
end;
$$;

-- Crea el perfil automáticamente al registrarse un usuario.
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
      else coalesce(new.raw_user_meta_data ->> 'role', 'client')
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============ TABLAS ============

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'client',
  photo_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  email text,
  full_name text,
  phone text,
  city text,
  photo_url text,
  status text not null default 'pending_verification',
  is_available boolean not null default true,
  vehicle_type text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  license_types jsonb not null default '[]'::jsonb,
  license_number text,
  license_photo_url text,
  id_document_url text,
  insurance_doc_url text,
  insurance_url text,
  vehicle_photo_url text,
  vehicle_photo_left_url text,
  vehicle_photo_right_url text,
  vehicle_photo_front_url text,
  vehicle_photo_rear_url text,
  current_lat double precision,
  current_lng double precision,
  average_rating numeric not null default 5,
  total_trips integer not null default 0
);

create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  status text not null default 'pending',
  client_name text,
  client_phone text,
  origin_address text,
  destination_address text,
  origin_lat double precision,
  origin_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  cargo_description text,
  cargo_photos jsonb not null default '[]'::jsonb,
  vehicle_type text,
  distance_km numeric,
  helpers_count integer not null default 0,
  needs_help boolean not null default false,
  help_description text,
  extra_hours numeric not null default 0,
  insurance_selected boolean not null default false,
  estimated_price numeric,
  final_price numeric,
  payment_method text not null default 'card',
  payment_status text not null default 'pending',
  stripe_session_id text,
  driver_id uuid,
  driver_name text,
  accepted_at timestamptz,
  notes text,
  pickup_time timestamptz,
  delivery_time timestamptz,
  client_rating numeric,
  client_review text
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  request_id uuid not null references public.transport_requests (id) on delete cascade,
  sender_id uuid,
  sender_name text,
  sender_role text,
  message text not null
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  request_id uuid,
  reporter_id uuid,
  type text not null default 'other',
  priority text not null default 'normal',
  status text not null default 'open',
  description text,
  reporter_name text,
  resolution text
);

-- Nota: la entidad Worker del original de Base44 no se usa en ninguna página,
-- así que su tabla se eliminó del esquema a propósito.

-- Ajustes globales editables por el admin. La clave 'tariffs' guarda los precios
-- (base por furgoneta, hora extra, seguro, comisión). Lectura PÚBLICA a propósito:
-- el flujo de invitado calcula el precio sin sesión.
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  key text unique not null,
  value jsonb
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select using (true);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values ('tariffs', '{
  "l1h1": 50, "l1h2": 60, "l2h2": 85,
  "extra_hour": 15, "insurance": 12, "commission_pct": 15
}'::jsonb)
on conflict (key) do nothing;

-- ============ TRIGGERS ============

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
declare t text;
begin
  foreach t in array array['profiles','driver_profiles','transport_requests','chat_messages','incidents','app_settings']
  loop
    execute format('drop trigger if exists set_updated_date on public.%I', t);
    execute format('create trigger set_updated_date before update on public.%I for each row execute function public.set_updated_date()', t);
  end loop;
  foreach t in array array['driver_profiles','transport_requests','chat_messages','incidents','app_settings']
  loop
    execute format('drop trigger if exists set_created_by on public.%I', t);
    execute format('create trigger set_created_by before insert on public.%I for each row execute function public.set_created_by()', t);
  end loop;
end;
$$;

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.transport_requests enable row level security;
alter table public.chat_messages enable row level security;
alter table public.incidents enable row level security;

-- profiles: cada uno el suyo; admin todo
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete
  using (public.is_admin());

-- driver_profiles: visibles para autenticados (tracking/asignación);
-- crea cualquiera autenticado; edita el dueño (por id o por email aún sin vincular) o admin
drop policy if exists driver_profiles_select on public.driver_profiles;
create policy driver_profiles_select on public.driver_profiles for select
  using (auth.uid() is not null);
drop policy if exists driver_profiles_insert on public.driver_profiles;
create policy driver_profiles_insert on public.driver_profiles for insert
  with check (auth.uid() is not null);
drop policy if exists driver_profiles_update on public.driver_profiles;
create policy driver_profiles_update on public.driver_profiles for update
  using (
    created_by_id = auth.uid()
    or email = (auth.jwt() ->> 'email')
    or public.is_admin()
  );
drop policy if exists driver_profiles_delete on public.driver_profiles;
create policy driver_profiles_delete on public.driver_profiles for delete
  using (public.is_admin());

-- transport_requests:
--  · insert abierto (flujo de invitado sin cuenta)
--  · select: dueño, conductor asignado, conductores verificados ven pendientes, admin
--  · update: dueño, conductor asignado, conductor verificado aceptando un pendiente, admin
drop policy if exists transport_requests_insert on public.transport_requests;
create policy transport_requests_insert on public.transport_requests for insert
  with check (true);
drop policy if exists transport_requests_select on public.transport_requests;
create policy transport_requests_select on public.transport_requests for select
  using (
    public.is_staff()
    or created_by_id = auth.uid()
    or driver_id = auth.uid()
    or (
      status = 'pending'
      and exists (
        select 1 from public.driver_profiles dp
        where dp.created_by_id = auth.uid() and dp.status = 'verified'
      )
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
        where dp.created_by_id = auth.uid() and dp.status = 'verified'
      )
    )
  );
drop policy if exists transport_requests_delete on public.transport_requests;
create policy transport_requests_delete on public.transport_requests for delete
  using (public.is_admin());

-- chat_messages: solo participantes del pedido (cliente/conductor) y admin
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages for select
  using (
    public.is_staff()
    or exists (
      select 1 from public.transport_requests tr
      where tr.id = request_id
        and (tr.created_by_id = auth.uid() or tr.driver_id = auth.uid())
    )
  );
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages for insert
  with check (
    public.is_admin()
    or exists (
      select 1 from public.transport_requests tr
      where tr.id = request_id
        and (tr.created_by_id = auth.uid() or tr.driver_id = auth.uid())
    )
  );
drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages for delete
  using (public.is_admin());

-- incidents: crea cualquiera autenticado; ve el suyo o admin; gestiona admin
drop policy if exists incidents_insert on public.incidents;
create policy incidents_insert on public.incidents for insert
  with check (auth.uid() is not null);
drop policy if exists incidents_select on public.incidents;
create policy incidents_select on public.incidents for select
  using (created_by_id = auth.uid() or reporter_id = auth.uid() or public.is_staff());
drop policy if exists incidents_update on public.incidents;
create policy incidents_update on public.incidents for update
  using (public.is_staff());
drop policy if exists incidents_delete on public.incidents;
create policy incidents_delete on public.incidents for delete
  using (public.is_admin());

-- Candidaturas de conductores (botón "Quiero ser conductor" de la landing).
-- Las crea cualquiera (anónimo) vía RPC; solo el admin las ve y gestiona.
create table if not exists public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id uuid,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  vehicle_type text,
  is_autonomo boolean,
  availability text,
  notes text,
  status text not null default 'new'
);

alter table public.driver_applications enable row level security;

drop policy if exists driver_applications_admin on public.driver_applications;
create policy driver_applications_admin on public.driver_applications for all
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_updated_date on public.driver_applications;
create trigger set_updated_date before update on public.driver_applications
  for each row execute function public.set_updated_date();
drop trigger if exists set_created_by on public.driver_applications;
create trigger set_created_by before insert on public.driver_applications
  for each row execute function public.set_created_by();

create or replace function public.create_driver_application(payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if coalesce(trim(payload->>'full_name'), '') = '' or coalesce(trim(payload->>'phone'), '') = '' then
    raise exception 'Nombre y teléfono son obligatorios';
  end if;
  insert into public.driver_applications (
    full_name, phone, email, address, vehicle_type, is_autonomo, availability, notes
  ) values (
    payload->>'full_name', payload->>'phone', payload->>'email', payload->>'address',
    payload->>'vehicle_type', (payload->>'is_autonomo')::boolean,
    payload->>'availability', payload->>'notes'
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_driver_application(jsonb) from public;
grant execute on function public.create_driver_application(jsonb) to anon, authenticated;

-- Flujo de invitado: el insert directo con RETURNING falla porque anon no tiene
-- select sobre la fila creada. Esta RPC (security definer) hace el alta y devuelve
-- la fila, admitiendo SOLO los campos del formulario (un invitado no puede fijar
-- driver_id, status, payment_status, etc.).
create or replace function public.create_guest_request(payload jsonb)
returns public.transport_requests
language plpgsql security definer
set search_path = public
as $$
declare r public.transport_requests;
begin
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

revoke all on function public.create_guest_request(jsonb) from public;
grant execute on function public.create_guest_request(jsonb) to anon, authenticated;

-- Mapa público de la landing: conductores verificados y disponibles, SIEMPRE
-- dentro de la zona de Albacete capital (CP 02001–02008). Por privacidad no se
-- expone la posición exacta: si el GPS real está dentro de la zona se redondea
-- (~100 m); si está fuera o vacío, se asigna una posición estable derivada del
-- id dentro de la zona. Solo devuelve nombre de pila y tipo de furgoneta.
create or replace function public.get_public_drivers()
returns table (id uuid, name text, vehicle_type text, lat double precision, lng double precision)
language sql stable security definer
set search_path = public
as $$
  select
    dp.id,
    split_part(coalesce(nullif(trim(dp.full_name), ''), 'Conductor'), ' ', 1) as name,
    dp.vehicle_type,
    case
      when dp.current_lat between 38.955 and 39.020 and dp.current_lng between -1.895 and -1.820
        then round(dp.current_lat::numeric, 3)::double precision
      else 38.975 + ((('x' || substr(md5(dp.id::text), 1, 8))::bit(32)::bigint & 2147483647) % 40)::double precision / 1000.0
    end as lat,
    case
      when dp.current_lat between 38.955 and 39.020 and dp.current_lng between -1.895 and -1.820
        then round(dp.current_lng::numeric, 3)::double precision
      else -1.882 + ((('x' || substr(md5(dp.id::text), 9, 8))::bit(32)::bigint & 2147483647) % 55)::double precision / 1000.0
    end as lng
  from public.driver_profiles dp
  where dp.status = 'verified'
    and coalesce(dp.is_available, true)
$$;

revoke all on function public.get_public_drivers() from public;
grant execute on function public.get_public_drivers() to anon, authenticated;

-- ============ REALTIME ============

do $$
begin
  begin
    alter publication supabase_realtime add table public.transport_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.driver_profiles;
  exception when duplicate_object then null;
  end;
end;
$$;

-- ============ STORAGE ============

insert into storage.buckets (id, name, public)
values ('cargo-photos', 'cargo-photos', true),
       ('avatars', 'avatars', true),
       ('driver-docs', 'driver-docs', true)
on conflict (id) do nothing;

-- Subida: invitados solo a cargo-photos (fotos de la mercancía del flujo sin cuenta);
-- autenticados a los tres buckets.
drop policy if exists "cargo photos anon upload" on storage.objects;
create policy "cargo photos anon upload" on storage.objects for insert to anon
  with check (bucket_id = 'cargo-photos');
drop policy if exists "authenticated uploads" on storage.objects;
create policy "authenticated uploads" on storage.objects for insert to authenticated
  with check (bucket_id in ('cargo-photos', 'avatars', 'driver-docs'));
drop policy if exists "public read" on storage.objects;
create policy "public read" on storage.objects for select
  using (bucket_id in ('cargo-photos', 'avatars', 'driver-docs'));
