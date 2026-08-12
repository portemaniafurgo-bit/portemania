-- ============================================================
-- 0013 — Borrado de cuenta desde la app (requisito de Google Play)
--
-- Toda app que permita registrarse debe permitir borrar la cuenta. La RPC la
-- ejecuta el PROPIO usuario (authenticated); es security definer porque toca
-- auth.users y filas protegidas por RLS.
--
-- Decisión de negocio: los PEDIDOS no se borran (los necesita Finanzas y la
-- trazabilidad de servicios ya prestados) — se ANONIMIZAN los datos personales
-- del cliente en ellos. Lo que sí se borra del todo: tokens push, perfil de
-- conductor con sus datos, perfil y el usuario de auth.
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_email text;
begin
  if uid is null then
    raise exception 'No autenticado';
  end if;

  select email into my_email from auth.users where id = uid;

  -- Un conductor con un servicio EN CURSO no puede borrarse: dejaría a un
  -- cliente colgado a mitad de porte.
  if exists (
    select 1 from transport_requests
     where driver_id = uid and status in ('accepted', 'in_transit', 'picked_up')
  ) then
    raise exception 'Tienes un servicio en curso: termínalo o cancélalo antes de borrar la cuenta';
  end if;

  delete from push_tokens where user_id = uid;

  -- Pedidos como cliente: anonimizar datos personales, conservar el registro.
  update transport_requests
     set client_name = 'Cuenta eliminada',
         client_phone = null,
         recipient_name = null,
         recipient_phone = null,
         notes = null
   where created_by_id = uid;

  -- Mensajes de chat: se conserva el hilo (el otro participante lo tiene) pero
  -- sin contenido ni nombre.
  update chat_messages
     set message = '[mensaje eliminado]',
         image_url = null,
         sender_name = 'Cuenta eliminada'
   where sender_id = uid;

  -- Perfil de conductor: fuera (documentos, matrícula, teléfono...).
  delete from driver_profiles
   where created_by_id = uid
      or (my_email is not null and lower(email) = lower(my_email));

  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
