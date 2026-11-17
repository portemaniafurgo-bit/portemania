-- ============================================================
-- 0030 — Un solo aviso por mensaje de chat
--
-- Migración ADITIVA: añade una columna. No sustituye ninguna función ni
-- trigger existente y no toca datos.
--
-- chat_messages.push_sent_at
--    Cada mensaje enviado desde la app pedía el aviso push DOS veces: el
--    trigger zz_notify_chat_message (0015) y la propia app al enviar
--    (mobile/lib/orders.js, versión instalada). El otro móvil recibía el
--    mismo mensaje repetido. La Edge Function send-push «reclama» ahora el
--    mensaje con un UPDATE ... WHERE push_sent_at IS NULL: solo la primera
--    llamada lo marca y envía. Si esta columna no existe, send-push sigue
--    enviando como antes (no se rompe nada si se despliega la función antes
--    de aplicar esta migración).
--
-- Nota sobre «0 servicios» en la tarjeta del conductor: era un fallo solo de
-- la app (contaba pedidos con la sesión del cliente; la RLS no le deja ver los
-- de otros). La app v2 lee driver_profiles.total_trips, que mantiene
-- sync_driver_rating (0003). Comprobado por lectura en producción el
-- 17-nov-2026: todos los contadores cuadran ya con los pedidos entregados, así
-- que NO se recalculan aquí (un recálculo con el emparejamiento
-- created_by_id-o-email de la 0003 no es determinista para perfiles dados de
-- alta por el admin).
--
-- Rollback: alter table public.chat_messages drop column if exists push_sent_at;
-- ============================================================

begin;
set local lock_timeout = '3s';

alter table public.chat_messages
  add column if not exists push_sent_at timestamptz;

comment on column public.chat_messages.push_sent_at is
  'Cuándo se envió el aviso push de este mensaje. Lo marca send-push (service role) para no avisar dos veces del mismo mensaje.';

commit;
