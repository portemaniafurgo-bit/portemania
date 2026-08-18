-- ============================================================
-- 0015 — Avisos push que NO puede disparar la app
--
-- Hay tres avisos que ninguna pantalla puede lanzar, porque ocurren en el
-- servidor cuando no hay nadie mirando:
--
--   1. Un pedido PROGRAMADO llega a su hora y se publica solo (cron de 0012).
--      Hasta ahora cambiaba de estado en silencio: ningún conductor se
--      enteraba de que había trabajo.
--   2. Un pedido creado desde la WEB o como invitado. La app avisaba al
--      crearlo; la web no. Con el disparador, da igual por dónde entre.
--   3. La documentación del conductor caduca. El job diario le bloqueaba el
--      reparto sin decirle por qué se habían acabado las ofertas.
--
-- Todo pasa por la Edge Function `send-push`, que es quien sabe a quién
-- corresponde cada aviso y respeta las reglas de reparto.
--
-- REQUISITOS ANTES DE APLICAR (ver docs/PUSH-NOTIFICACIONES.md):
--   - Extensión pg_net habilitada.
--   - Dos secretos en Vault:  project_url  y  service_role_key.
-- ============================================================

create extension if not exists pg_net;

-- ------------------------------------------------------------
-- 1. Llamada a send-push desde la base de datos
-- ------------------------------------------------------------
-- SECURITY DEFINER y sin permisos para authenticated: nadie desde el cliente
-- puede provocar avisos a mano llamando a esta función.
create or replace function public.notify_push(p_mode text, p_order_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';

  -- Sin secretos configurados no se rompe nada: simplemente no hay aviso. El
  -- pedido, el mensaje o el bloqueo siguen su curso.
  if base_url is null or service_key is null then
    raise notice 'notify_push: faltan los secretos project_url / service_role_key';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_strip_nulls(jsonb_build_object('mode', p_mode, 'order_id', p_order_id))
  );
end;
$$;

revoke all on function public.notify_push(text, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Pedido disponible → conductores (venga de donde venga)
-- ------------------------------------------------------------
create or replace function public.zz_notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando ENTRA en pendiente: al crearlo ya publicado, o al llegar la
  -- hora de uno programado. Un pedido que vuelve a pendientes porque el
  -- conductor canceló también cuenta: hay trabajo libre otra vez.
  if new.status = 'pending'
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.notify_push('new_request', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_notify_new_request on public.transport_requests;
create trigger zz_notify_new_request
  after insert or update of status on public.transport_requests
  for each row execute function public.zz_notify_new_request();

-- ------------------------------------------------------------
-- 3. Mensaje de chat → la otra parte (web y app por igual)
-- ------------------------------------------------------------
create or replace function public.zz_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then return new; end if;

  -- El chat necesita además el id del mensaje: el texto del aviso sale de la
  -- fila real, no de lo que diga quien llama.
  perform net.http_post(
    url := base_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('mode', 'chat_message', 'order_id', new.request_id, 'message_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists zz_notify_chat_message on public.chat_messages;
create trigger zz_notify_chat_message
  after insert on public.chat_messages
  for each row execute function public.zz_notify_chat_message();

-- ------------------------------------------------------------
-- 4. Documentación a punto de caducar → conductor
-- ------------------------------------------------------------
-- A las 08:00 (07:00 UTC en verano): a esa hora el conductor ya está en pie y
-- puede hacer algo al respecto, no a las 5 de la mañana como el job de bloqueo.
select cron.schedule(
  'notify-docs-expiring',
  '0 7 * * *',
  $$ select public.notify_push('docs_expiring') $$
);

comment on function public.notify_push(text, uuid) is
  'Dispara un aviso push llamando a la Edge Function send-push. Uso interno (triggers y cron): revocada para anon y authenticated.';
