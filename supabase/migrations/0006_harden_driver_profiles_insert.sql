-- ============================================================
-- 0006 — Endurecimiento de driver_profiles (hallazgos auditoría 2026-07-07)
--
-- 1) INSERT: la policy de 0001 permitía a CUALQUIER autenticado insertarse
--    un perfil con status='verified' → acceso inmediato a los pedidos
--    pendientes (PII de clientes) sin pasar por la verificación del admin.
--    Ahora: el staff crea lo que quiera; un usuario normal solo puede crear
--    SU propio perfil (created_by_id = su uid, que el trigger set_created_by
--    garantiza en inserts sin valor explícito) y siempre nace pendiente.
--
-- 2) UNIQUE sobre lower(email): el bug histórico creaba perfiles duplicados
--    por email y la fila "ganadora" era indeterminada. Mejor un error claro
--    que un duplicado silencioso.
-- ============================================================

drop policy if exists driver_profiles_insert on public.driver_profiles;
create policy driver_profiles_insert on public.driver_profiles for insert
  with check (
    public.is_staff()
    or (
      auth.uid() is not null
      and created_by_id = auth.uid()
      and coalesce(status, 'pending_verification') = 'pending_verification'
    )
  );

-- En una BD con datos del bug histórico puede haber emails duplicados: se
-- conserva la fila más ANTIGUA (mismo criterio que fetchMyDriverProfile) para
-- que el índice único no aborte la migración en instalaciones desde cero.
delete from public.driver_profiles d
using public.driver_profiles k
where d.email is not null
  and k.email is not null
  and lower(d.email) = lower(k.email)
  and d.created_date > k.created_date;

create unique index if not exists driver_profiles_email_unique
  on public.driver_profiles (lower(email))
  where email is not null;

-- Refresca el caché de esquema de PostgREST
notify pgrst, 'reload schema';
