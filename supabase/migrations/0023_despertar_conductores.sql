-- ============================================================
-- 0023 — «El dinero te persigue»: aviso por hora en horario laboral
--
-- Cada hora, si hay pedidos esperando, se escribe a los conductores
-- verificados que están DESCONECTADOS. La función `wake-drivers` ya se encarga
-- de no repetirse (máximo uno cada 6 h por conductor) y de no escribir si no
-- hay trabajo.
--
-- El horario se comprueba en HORA DE ESPAÑA, no en UTC: pg_cron va en UTC y
-- España cambia la hora dos veces al año; con horas fijas de cron, en invierno
-- los correos saldrían una hora antes.
-- ============================================================

/** Llama a wake-drivers, pero solo entre las 8:00 y las 21:00 de España. */
create or replace function public.wake_drivers_if_working_hours()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hora int;
  base_url text;
  service_key text;
begin
  hora := extract(hour from (now() at time zone 'Europe/Madrid'))::int;
  -- Fuera de horario no se molesta a nadie: un correo a las 4 de la mañana
  -- solo consigue que lo marquen como spam.
  if hora < 8 or hora >= 21 then return; end if;

  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or service_key is null then
    raise notice 'wake_drivers: faltan los secretos del proyecto';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/functions/v1/wake-drivers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.wake_drivers_if_working_hours() from public, anon, authenticated;

select cron.schedule(
  'wake-disconnected-drivers',
  '0 * * * *',
  $$ select public.wake_drivers_if_working_hours() $$
);
