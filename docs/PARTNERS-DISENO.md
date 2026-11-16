# ClicyVoy Partners (comerciales) — diseño

Decisiones de negocio (Luis, 15-nov-2026): cualquiera puede ser comercial (también
conductores y clientes); la cartera es para siempre; 5 % del precio en el primer
servicio entregado de cada cliente y 2 % en los siguientes (sin propina),
porcentajes editables por el admin; efectivo cuenta igual; toda comisión espera
15 días desde la entrega antes de poder cobrarse; cobro mínimo 20 €, una
solicitud al mes; el admin aprueba y paga por transferencia; de sus clientes el
comercial ve el nombre de pila, el nº de servicios y el importe y porcentaje de
cada comisión (con eso se puede deducir el precio de un servicio); nunca el
apellido, los datos de contacto ni las direcciones.

## Base de datos — migraciones `0028_partners.sql` y `0029_proteger_campos_pedido.sql` (construidas, sin aplicar)
(La 0027 es `stripe_connect`, ya aplicada en producción aunque no esté en esta rama.)
Las dos son puramente aditivas: no recrean ni borran nada de la 0001–0027. **Se
aplican juntas**: sin la 0029, un cliente podía tocar el precio de su pedido o
darlo por entregado, y eso inflaba la comisión. Prueba sin Postgres:
`supabase/tests/partners.test.mjs` (PGlite, con la RLS y los triggers reales del
pedido copiados; instrucciones en su cabecera).

### 0029 — campos clave del pedido (agujero previo, independiente de Partners)
Trigger nuevo `trg_protect_order_core_fields` (BEFORE UPDATE, corre antes que
`trg_protect_order_payment_fields` y `trg_stamp_final_price`). Servidor, Edge
Functions, RPC security definer y staff pasan libres. Para el resto:
- un conductor verificado AJENO (ni dueño ni asignado) sobre un pedido
  pendiente solo puede aceptarlo: de su update se aplican status, driver_id,
  driver_name y accepted_at; todo lo demás vuelve a como estaba (también las
  columnas que se añadan en el futuro);
- proposed_price: solo el dueño, con el pedido pendiente y sin conductor, entre
  max(5 €, 60 % del precio) y max(500 €, 5 × precio); fuera de límites, error;
  aceptado el pedido, fijo;
- congelados: created_by_id, created_by, estimated_price, price_breakdown y las
  entradas del precio (service_type, vehicle_type, needs_help, plantas,
  ascensores, zonas, extra_hours, items_count, package_weight, stops);
- payment_method: libre con el pedido abierto, congelado al entregar o cancelar;
- driver_id: solo nadie → yo (aceptar, conductor verificado, pedido pendiente)
  o yo → nadie (cancelación del conductor);
- estado: a 'delivered' solo el conductor asignado y desde 'picked_up'; salir de
  'delivered' prohibido. Ambos con error claro, igual que un cambio de
  conductor rechazado que venga junto con un cambio de estado; lo demás se
  deshace en silencio.
- El límite de espera (`set local lock_timeout = '3s'`) ya va dentro del
  fichero, junto al trigger (que se crea con `create or replace trigger`, sin
  borrarlo antes): no hay que lanzarlo aparte. Si la tabla está ocupada falla
  a los 3 s sin dejar nada a medias y se vuelve a lanzar. Marcha atrás y aviso
  (no deshacerla con la 0028 en producción) en la cabecera del fichero.

### 0028 — tablas
RLS activado, **solo lectura** por políticas; toda escritura por RPC security
definer o trigger; anon sin ningún permiso.
- `partners`: id, user_id (unique, FK auth.users **on delete set null**), slug
  (unique, `^[a-z0-9-]{3,30}$` con al menos 3 letras/cifras seguidas),
  display_name, status ('active' | 'blocked'), payout_holder, payout_iban,
  created/updated_date. Select: el propio user o **admin** (no staff: lleva
  IBAN). **user_id NULL = inactivo** en todas las funciones.
- `partner_referrals`: client_user_id (PK, FK auth.users on delete cascade),
  partner_id, source, created_date. Select: solo staff.
- `partner_commissions`: id, partner_id, request_id (unique, FK pedido on delete
  set null), client_user_id (FK on delete set null), driver_id, payment_method,
  kind ('first' | 'repeat'), base_amount, rate_pct, amount, status
  ('pending' | 'held' | 'requested' | 'paid' | 'reversed'), available_at,
  generated_at, delivered_at (sello del servidor), payout_id, flags text[].
  Select: staff.
  **"Disponible" no se guarda**: status 'pending', available_at <= now() y el
  pedido sigue entregado y **pagado**; si no está pagado se muestra
  'awaiting_payment'. 'held' = retenida para el admin.
  flags: same_driver, cash, price_above_quote, high_amount, cash_high,
  partner_blocked, program_disabled, order_undelivered, order_deleted,
  admin_reversed.
- `partner_payouts`: id, partner_id, amount, status ('requested' | 'paid' |
  'rejected'), requested_at, resolved_at, resolved_by (on delete set null),
  note, holder, iban (copia). Select: el propio comercial o **admin**. Índice
  único parcial: como mucho una 'requested' por comercial.
- `app_settings.partner_program` (solo si falta): `{enabled: true, public: false, first_pct: 5,
  repeat_pct: 2, hold_days: 15, min_payout: 20, payout_interval_days: 30,
  claim_window_days: 30, hold_same_driver: true, max_price_quote_ratio: 2,
  max_auto_base: 300, max_auto_cash_base: 150}`. El admin lo edita
  directamente. Cada valor ilegible o fuera de rango cae al de por defecto; los
  días con decimales se truncan (15,5 → 15); un `enabled` ilegible o la fila ausente = programa apagado;
  un `public` ausente o ilegible = no público (solo el personal);
  `hold_same_driver_cash` se acepta como nombre antiguo.
  **Dos interruptores**: `enabled` (programa encendido) y `public` (abierto a
  todo el mundo). Encendido y no público = lanzamiento privado: solo
  `is_staff()` puede darse de alta y la web/app solo enseñan el programa al
  personal y a quien ya es comercial; atribución, comisiones, panel y cobros
  funcionan igual.

### 0028 — reglas
- Comisión (trigger `zz_partner_commission`, AFTER UPDATE OF status), al pasar a
  'delivered' con cliente atribuido:
  - sin comisión si no hay conductor o el conductor es el propio cliente;
  - si ya existe y no está anulada, no se toca; si está anulada, revive
    recalculada (conservando sus avisos) salvo que lleve admin_reversed;
  - 'first' si es el servicio más antiguo (por sello de entrega del servidor) de
    los vivos del cliente y no hay ya otro 'first' vivo; si no, 'repeat';
  - base = coalesce(final_price, estimated_price) − línea
    `pending_cancellation` si la hubiera (defensa: el set_request_price
    vigente, el de la 0026, ya no la escribe; nunca resta en negativo); propina
    fuera;
    amount = round(base × pct / 100, 2); si da 0, nada;
  - retenida ('held') si el conductor es el propio comercial (same_driver,
    además cash si es efectivo), si la base supera max_price_quote_ratio veces
    el presupuesto de compute_quote (price_above_quote; sin compute_quote se
    salta la comprobación), si la base supera max_auto_base (high_amount) o,
    en efectivo/Bizum, max_auto_cash_base (cash_high), si el comercial está bloqueado o sin usuario
    (partner_blocked) o si el programa está apagado (program_disabled);
  - available_at = now() del servidor + hold_days.
  Al dejar de estar entregado: pending/held → 'reversed'; requested/paid → se
  deja y flag order_undelivered. Todo dentro de un bloque con exception: un
  fallo deja un WARNING y **nunca bloquea la entrega**.
- Borrado de un pedido por el admin (trigger `zz_partner_commission_on_delete`,
  BEFORE DELETE): pending/held → 'reversed'; requested/paid → flag
  order_deleted. La comisión se conserva sin pedido.
- RPC del comercial: `partner_activate(nombre, slug)` (programa apagado, o
  encendido pero no público y quien llama no es `is_staff()` → disabled),
  `partner_update_payout_data(titular, iban)`, `partner_claim_referral(slug)`
  (la antigüedad se mide con la cuenta, `auth.users.created_at`; motivos:
  disabled, unknown_code —también comercial bloqueado o sin usuario—,
  already_referred, own_link, has_orders, not_new; repetir con el mismo
  comercial devuelve ok), `partner_public(slug)` (anon; desconocido, bloqueado y
  apagado responden igual: `{first_name: null, active: false}`),
  `partner_dashboard()`, `partner_clients()` (nombre de pila, fecha de alta sin
  hora, nº de servicios y comisión), `partner_commission_list(límite)` (fechas
  sin hora; trae importe y porcentaje de cada comisión, así que el precio de un
  servicio se puede deducir; lo que el comercial no ve nunca es el apellido del
  cliente, sus datos de contacto ni las direcciones), `partner_request_payout()`
  (bloquea al comercial con FOR NO KEY UPDATE; exige activo, IBAN, ninguna
  abierta, 30 días desde la última pedida/pagada y ≥ mínimo; mueve exactamente
  las comisiones disponibles sumadas).
- RPC del admin (comprueban `is_admin()` dentro): `partner_admin_list`,
  `partner_admin_payouts(estado)`, `partner_admin_resolve_payout(id, 'paid' |
  'rejected', nota)` (al rechazar bloquea los pedidos en lectura; los de pedidos
  ya no entregados se anulan con admin_reversed en vez de volver a pendientes),
  `partner_admin_set_status`, `partner_admin_release_commission(id, 'release' |
  'reverse')` (reverse solo de pending/held, marca admin_reversed),
  `partner_admin_commissions(comercial | null)`. Una acción nula responde
  bad_action o bad_status.
- Borrado de cuenta: el cliente sale de la cartera (cascade) y sus comisiones se
  conservan sin cliente; el comercial borrado queda sin usuario (inactivo).

## Web
- `/comercial/[slug]` público: guarda el código (cookie de primera parte 90 días
  + localStorage, es funcional, no publicidad) y lleva a la portada/registro con
  un aviso "Te invita X". `?ref=slug` en cualquier URL hace lo mismo (proxy.js).
- Tras iniciar sesión (AuthContext): si hay código guardado, llamar
  `partner_claim_referral` una vez y borrar el código.
- `(app)/partner`: activar perfil; panel (ganancias, disponible, pendiente,
  gráfica, cartera, comisiones, enlace + QR + WhatsApp, datos de cobro,
  solicitar cobro, historial). Entrada en los menús de cliente y conductor
  (y en la app, fila del perfil) solo si el programa está encendido y es
  público, si el usuario ya es comercial o si es del personal; si no, `/partner`
  enseña "no disponible" a quien no es comercial ni del personal.
- `(app)/admin/partners`: comerciales, cartera y totales, solicitudes de cobro
  (aprobar/rechazar, CSV), porcentajes y reglas, bloquear comercial.
- Términos y privacidad: apartado del programa (borrador para revisar). En los
  Términos va el último (13); su contenedor `#comerciales` siempre está, pero
  el texto solo aparece con el programa encendido y público, o para el
  personal (que lo prueba en el lanzamiento privado).
- robots: `/partner` privado; `/comercial/` no indexable.

## Móvil (parte 2)
Campo "código de invitación" en completar-perfil (solo con el programa
encendido y público, o para el personal), fila "Gana con ClicyVoy" en los
perfiles y pantallas del comercial.

## Fuera de esta parte
Pago automático por Stripe; iOS; pedidos de invitado (hoy cerrados a anónimos).

## Estado y puesta en marcha (16-nov-2026)

Programado y revisado por agentes independientes (BD: 3 rondas contra el esquema
real de producción; web: 1 ronda; móvil: 1 ronda). **Nada aplicado ni publicado.
No probado contra una base de datos real ni en un móvil.**

Orden para lanzar (cada paso con el OK explícito de Luis):
1. `0029_proteger_campos_pedido.sql` en producción. Las dos migraciones (0029
   y 0028) llevan dentro su `set local lock_timeout = '3s'`: si la tabla de
   pedidos está ocupada fallan a los 3 s, sin dejar nada a medias ni hacer
   esperar a los accesos y pedidos, y basta con volver a lanzarlas. Se puede
   aplicar sola y ya: cierra un agujero que existe hoy. Rollback en su
   cabecera. No deshacerla con la 0028 viva.
2. `0028_partners.sql` en producción, en tres tiempos:
   - aplicarla: crea la fila `partner_program` con `enabled: true` y
     `public: false` (lanzamiento privado). Nadie salvo el personal (admin y
     staff) ve "Gana con ClicyVoy" ni puede darse de alta; los enlaces y la
     atribución sí funcionan, para que un cliente de prueba quede en la
     cartera de una cuenta del equipo;
   - prueba privada de punta a punta con cuentas del equipo (paso 5);
   - cuando el gestor y los textos legales estén listos (ver "Antes de
     abrirlo al público"), activar "Abierto a todo el mundo" en Admin →
     Comerciales → "Ajustes del programa". Desde ese momento la web y la app lo enseñan a
     todos los clientes y conductores, y el apartado del programa aparece en
     los Términos.
   `enabled: false` sigue siendo el interruptor de apagado total (nadie se da
   de alta, nadie capta clientes y las comisiones nuevas quedan retenidas).
3. Web: publicar esta rama (incluye los arreglos del mapa y del rol).
4. Móvil: OTA desde este árbol + `cd mobile && npm run check` con SUPABASE_PAT
   (verifica que las tablas y funciones existen: hacerlo DESPUÉS del paso 2).
5. Prueba real mínima (con el programa aún privado): alta de comercial con una
   cuenta del equipo (staff o admin), enlace en un navegador limpio con una
   cuenta de Google nueva, pedido, entrega y pago, ver la comisión, datos
   bancarios, solicitar cobro (bajar `min_payout` y `hold_days` para la prueba y
   restaurarlos), aprobar en el panel de admin. Y repasar los flujos normales:
   aceptar, entregar, cancelar, valorar, subir oferta.

Antes de abrirlo al público (activar `public`):
- revisión del gestor (retenciones/facturas de los comerciales);
- revisión de los textos de `terminos` y `privacidad`, que son borradores (el
  apartado de los Términos solo se publica con el programa abierto; el de
  Privacidad se ve siempre);
- actualizar en Google Play el formulario de Seguridad de los datos: la app
  recogerá el número de cuenta bancaria (IBAN) de los comerciales. Hacerlo
  antes de que las pantallas del comercial sean públicas.

Pendiente fuera de este trabajo:
- Pago automático por Stripe e iOS.
- `zz_settle_cancellation_fees` da por saldadas las penalizaciones de
  cancelación sin cobrarlas (el `set_request_price` actual ya no añade la línea).
- Un cliente todavía puede poner su pedido en `cancelled` por la API saltándose
  la penalización, y un conductor saltarse fases (`accepted → picked_up`).
