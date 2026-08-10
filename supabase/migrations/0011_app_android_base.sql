-- ============================================================
-- 0011 — Base de backend para la app Android (Fase 1)
--
-- Aditiva y compartida con la web. Dos cosas:
--
--   1) `driver_profiles.location_updated_at` — marca de frescura del GPS.
--      Hoy la web escribe current_lat/current_lng mientras la pestaña está
--      abierta; al cerrarla la posición se congela en la BD y el cliente la ve
--      como si fuera actual. Con esta columna la UI puede decir "en vivo" o
--      "última posición hace 2 min". La app la escribirá desde el GPS en
--      segundo plano.
--
--   2) Tabla `push_tokens` — tokens de Expo Push (FCM por debajo) por usuario y
--      dispositivo. La Edge Function `send-push` los lee con service role (no
--      pasa por RLS). Ningún usuario puede leer tokens ajenos: sin política de
--      SELECT para otros, un token es un canal de escritura hacia el móvil.
--
-- Ver docs/PLAN-ACCION-APP-ANDROID.md (T0.1).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Frescura de la posición del conductor
-- ------------------------------------------------------------
alter table public.driver_profiles
  add column if not exists location_updated_at timestamptz;

comment on column public.driver_profiles.location_updated_at is
  'Momento en que se escribieron current_lat/current_lng. Si es viejo, la posición no es de fiar.';

-- Backfill conservador: las posiciones ya guardadas no tienen marca conocida,
-- así que se quedan en NULL y la UI las tratará como "sin datos de frescura"
-- (nunca como "en vivo"). No se inventa una fecha.

-- `protect_driver_profile_fields` (migración 0007) impide que el conductor se
-- auto-verifique o se cambie el rating; la posición sí puede escribirla él, que
-- es justo lo que hace la app. No hay que tocar ese trigger.

-- ------------------------------------------------------------
-- 2. Tokens de notificación push
-- ------------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  device_name text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

comment on table public.push_tokens is
  'Tokens de Expo Push por usuario y dispositivo. Los lee send-push con service role.';

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

drop trigger if exists set_updated_date on public.push_tokens;
create trigger set_updated_date before update on public.push_tokens
  for each row execute function public.set_updated_date();

alter table public.push_tokens enable row level security;

-- Cada usuario gestiona SOLO sus tokens. El staff no necesita verlos (y no
-- debería: un token permite empujar notificaciones a ese móvil).
drop policy if exists push_tokens_select on public.push_tokens;
create policy push_tokens_select on public.push_tokens for select
  using (user_id = auth.uid());

drop policy if exists push_tokens_insert on public.push_tokens;
create policy push_tokens_insert on public.push_tokens for insert
  with check (user_id = auth.uid());

drop policy if exists push_tokens_update on public.push_tokens;
create policy push_tokens_update on public.push_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Borrado propio: al cerrar sesión la app elimina su token.
drop policy if exists push_tokens_delete on public.push_tokens;
create policy push_tokens_delete on public.push_tokens for delete
  using (user_id = auth.uid());
