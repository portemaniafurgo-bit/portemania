-- ============================================================
-- 0004 — Corrige el trigger que congela profiles.role
-- Bug: protect_profile_role era SECURITY DEFINER, y dentro de una función
-- DEFINER `current_user` es el PROPIETARIO (postgres), que estaba en la
-- lista de exención → el trigger autorizaba CUALQUIER cambio de rol.
-- Se pasa a SECURITY INVOKER: current_user = rol real que ejecuta el UPDATE
-- (authenticated para usuarios; postgres solo en backoffice/migraciones;
-- service_role en Edge Functions). is_admin() sigue siendo su propia función
-- SECURITY DEFINER, así que se evalúa bien.
-- ============================================================
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
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
    new.role := old.role;  -- cambio no autorizado: se conserva el rol anterior
  end if;
  return new;
end;
$$;

-- Refresca el caché de esquema de PostgREST (evita planes RLS obsoletos tras DDL)
notify pgrst, 'reload schema';
