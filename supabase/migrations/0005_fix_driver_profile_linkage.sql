-- ============================================================
-- 0005 — Repara la vinculación de driver_profiles con su conductor real
--
-- Bug (reportado por el cliente 6-jul): el trigger set_created_by rellena
-- created_by_id con el uid de QUIEN INSERTA. Los perfiles dados de alta por
-- el admin quedaban ligados al uid del ADMIN, así que al entrar el admin como
-- conductor "heredaba" el último perfil creado (veía el perfil de Sergio y
-- sus documentos se guardaban en la fila de Sergio).
--
-- Arreglo en código (mismo commit): el alta desde admin pasa created_by_id
-- del conductor invitado, y fetchMyDriverProfile busca por email de login
-- primero. Esta migración repara las filas YA existentes.
-- ============================================================

-- 1) Re-vincular cada perfil de conductor al usuario auth con su mismo email.
--    Idempotente: solo toca filas cuyo created_by_id no es ya el correcto.
update public.driver_profiles dp
set created_by_id = p.id,
    created_by = coalesce(dp.created_by, p.email)
from public.profiles p
where dp.email is not null
  and lower(p.email) = lower(dp.email)
  and dp.created_by_id is distinct from p.id;

-- 2) La política de UPDATE comparaba el email con sensibilidad a mayúsculas:
--    si la fila tenía el email con otra grafía, el self-heal del código
--    fallaba en silencio (0 filas afectadas). Se normaliza con lower().
drop policy if exists driver_profiles_update on public.driver_profiles;
create policy driver_profiles_update on public.driver_profiles for update
  using (
    created_by_id = auth.uid()
    or lower(email) = lower(auth.jwt() ->> 'email')
    or public.is_admin()
  );

-- Refresca el caché de esquema de PostgREST
notify pgrst, 'reload schema';
