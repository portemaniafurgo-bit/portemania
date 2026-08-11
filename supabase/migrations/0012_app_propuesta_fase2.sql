-- ============================================================
-- 0012 — Funcionalidades de la propuesta comercial (fase 2 de la app)
--
-- Cubre lo que la propuesta aceptada promete y necesitaba esquema:
--   1) Chat con fotos          → chat_messages.image_url
--   2) Pedidos programados     → scheduled_at + estado 'scheduled' + pg_cron
--   3) Propina al conductor    → tip_amount (la escribe confirm-tip con
--                                 service role tras verificar el cargo real)
--   4) Caducidad de documentos → *_expires_at + docs_expired + job diario
--
-- Todo aditivo salvo UNA política que se amplía a propósito (ver §2).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Chat con fotos
-- ------------------------------------------------------------
alter table public.chat_messages
  add column if not exists image_url text;

comment on column public.chat_messages.image_url is
  'Foto adjunta al mensaje (URL pública del bucket cargo-photos, comprimida en el móvil).';

-- ------------------------------------------------------------
-- 2. Pedidos programados
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists scheduled_at timestamptz;

comment on column public.transport_requests.scheduled_at is
  'Pedido programado: momento en que el job lo publica (status scheduled → pending).';

-- La política de INSERT exigía status='pending' en exclusiva. Se amplía SOLO
-- para permitir crear programados del propio usuario con fecha futura; el
-- resto de condiciones (sin conductor, sin pagar, a nombre propio) se conserva
-- tal cual.
drop policy if exists transport_requests_insert on public.transport_requests;
create policy transport_requests_insert on public.transport_requests for insert
  with check (
    is_staff()
    or (
      created_by_id = auth.uid()
      and driver_id is null
      and coalesce(payment_status, 'pending') <> 'paid'
      and (
        status = 'pending'
        or (status = 'scheduled' and scheduled_at > now())
      )
    )
  );

-- Publicación automática: cada minuto, lo programado cuyo momento llegó pasa a
-- pendientes y entra en el flujo normal (listas de conductores, emails, panel).
create extension if not exists pg_cron;

select cron.schedule(
  'publish-scheduled-orders',
  '* * * * *',
  $$
  update public.transport_requests
     set status = 'pending'
   where status = 'scheduled'
     and scheduled_at <= now()
  $$
);

-- ------------------------------------------------------------
-- 3. Propina
-- ------------------------------------------------------------
alter table public.transport_requests
  add column if not exists tip_amount numeric;

comment on column public.transport_requests.tip_amount is
  'Propina del cliente al conductor, en euros. La escribe la función confirm-tip (service role) tras verificar el cargo en Stripe. 100% para el conductor.';

-- ------------------------------------------------------------
-- 4. Caducidad de documentos del conductor
-- ------------------------------------------------------------
alter table public.driver_profiles
  add column if not exists license_expires_at date,
  add column if not exists id_document_expires_at date,
  add column if not exists insurance_expires_at date,
  add column if not exists autonomo_receipt_expires_at date,
  add column if not exists censal_document_expires_at date,
  add column if not exists docs_expired boolean not null default false;

comment on column public.driver_profiles.docs_expired is
  'true si algún documento está vencido. Lo recalcula el job diario; mientras esté a true el conductor queda fuera de reparto (is_available=false).';

-- Job diario a las 05:00 UTC: bloquea a quien tenga algo vencido y desbloquea
-- la marca de quien ya renovó. La disponibilidad NO se reactiva sola: volver a
-- ponerse disponible es decisión del conductor desde la app.
select cron.schedule(
  'expire-driver-docs',
  '0 5 * * *',
  $$
  update public.driver_profiles
     set docs_expired = true,
         is_available = false
   where coalesce(docs_expired, false) = false
     and (
          license_expires_at          < current_date
       or id_document_expires_at     < current_date
       or insurance_expires_at       < current_date
       or autonomo_receipt_expires_at < current_date
       or censal_document_expires_at < current_date
     );

  update public.driver_profiles
     set docs_expired = false
   where docs_expired = true
     and coalesce(license_expires_at,          'infinity'::date) >= current_date
     and coalesce(id_document_expires_at,      'infinity'::date) >= current_date
     and coalesce(insurance_expires_at,        'infinity'::date) >= current_date
     and coalesce(autonomo_receipt_expires_at, 'infinity'::date) >= current_date
     and coalesce(censal_document_expires_at,  'infinity'::date) >= current_date
  $$
);
