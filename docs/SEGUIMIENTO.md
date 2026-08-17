# ClicyVoy — Documento de seguimiento

> Historial de todo lo construido, el estado actual y lo que queda. Actualizado: **2026-08-08**.
> Documentación técnica de referencia: [README.md](../README.md).
> Resumen legible para entrega: [INFORME-ENTREGA.md](INFORME-ENTREGA.md).

---

## 1. Qué es

Plataforma web de transporte y portes on-demand ("Uber de furgonetas") para **Albacete capital** (CP 02001–02008). Clientes (con cuenta o como invitados) piden portes; conductores autónomos verificados los aceptan; la empresa lo administra todo desde `/admin`.

- **Producción:** https://clicyvoy.es (dominio propio; también clicyvoy.vercel.app y pontemania.vercel.app)
- **Repo:** https://github.com/portemaniafurgo-bit/portemania
- **Supabase:** proyecto `dnehzwrqphqpkcdjwqfi` (cuenta portemaniafurgo, eu-west-2)
- **Vercel:** cuenta del negocio **portemaniafurgo@gmail.com** (proyecto prj_VyWeiIL9kVTwyNU6FKlkU4nLRAi0), **vinculado a GitHub: cada push a master despliega solo**. Deploy manual opcional: `npx vercel deploy --prod --yes --token <token del negocio>`. Migrado desde la cuenta personal el 2026-07-04 (proyecto viejo borrado con autorización).

## 2. Cronología de lo hecho

### 2026-07-01 — Port desde Base44
- Reescritura completa de la app original de Base44 (https://portemania-on-demand.base44.app/) a **Next.js 16 + Supabase + Vercel**, diseño idéntico, sin dependencia de Base44.
- Shim `src/api/base44Client.js` que imita el SDK de Base44 sobre Supabase → las ~30 páginas se portaron sin reescribir su lógica.
- Export original conservado en `base44/` (solo referencia local, fuera del repo).

### 2026-07-02 — Migración a infraestructura propia del negocio
- **GitHub**: repo oficial `portemaniafurgo-bit/portemania` (antes el código no estaba ni commiteado).
- **Supabase nuevo** (`dnehzwrqphqpkcdjwqfi`): esquema completo reconstruido, verificado contra el original y **versionado** en `supabase/migrations/0001_init_portemania_schema.sql` — la BD se puede recrear desde cero con ese archivo.
- Bugs latentes del original corregidos al migrar:
  - Guardar el perfil del conductor fallaba (faltaban ~10 columnas que el formulario envía).
  - La solicitud como invitado no podía devolver la fila creada (RLS) → RPC `create_guest_request`.
  - RLS más estricta: los teléfonos de clientes ya no son visibles para cualquier usuario autenticado; el chat solo lo escriben los participantes del pedido.
- Usuarios de prueba recreados. Producción re-apuntada al Supabase nuevo (env vars Vercel).
- Limpieza: entidades muertas (`Worker`, `AppSettings` de Base44) eliminadas; lint a 0 errores.

### 2026-07-02 — Brief de mejoras del negocio
- **`/ser-conductor`**: formulario público de candidatura (tamaño de furgoneta, ¿autónomo?, disponibilidad, datos personales, privacidad). El botón "Quiero ser conductor" de la landing lleva ahí (antes era un mailto). Las candidaturas se gestionan en Admin → Conductores.
- **CP obligatorio**: las direcciones de ambos formularios exigen un código postal 02001–02008 válido.
- **Mínimo 1 foto** de la mercancía (ya existía, verificado) y **aceptación de términos + política de privacidad** con enlaces.
- **Mapa de conductores en la landing** (bajo "¿Cómo funciona?"): conductores verificados siempre dentro de la zona (RPC `get_public_drivers`, posiciones redondeadas por privacidad), centrado en la geoposición del visitante, clic en furgoneta → popup de solicitar.
- **ETA en tiempo real** para el cliente: "Llega a la recogida en ~X min" con la posición GPS del conductor (Nominatim + OSRM gratis, `src/lib/eta.js`, fallback aproximado).
- **"¿Necesitas ayuda?"**: el cliente describe la ayuda (bajar un sofá, ¿ascensor?...) y el conductor la ve destacada ANTES de aceptar — él decide.
- **Fix de sesión**: la versión Base44 cerraba sesión al ir atrás; el port usa cookies persistentes y la sesión se lee en local (`getSession`), sin red, así que no se pierde.
- Llamada cliente↔conductor: **descartada por ahora** (ver §5).

### 2026-07-02 — Integraciones externas (credenciales vía Claude Chrome)
| Servicio | Estado | Nota |
|---|---|---|
| **Google OAuth** | ✅ Activo | Consent screen en modo *Testing*: solo test users pueden entrar con Google hasta publicarla en Google Cloud |
| **Stripe** | ✅ Configurado | Clave **de test** (`pk_test_`); tarjeta de prueba 4242 4242 4242 4242. Cambiar a `pk_live_` al lanzar |
| **Resend (emails)** | ✅ Funciona | Edge Function `send-email` con lista blanca de destinatarios. Sin dominio verificado solo entrega a portemaniafurgo@gmail.com — verificar dominio para que lleguen a conductores |

### 2026-07-02 — Panel de administración (fase 1)
- **`/admin` → Operación**: KPIs en vivo (pedidos hoy, sin aceptar con alerta roja si >10 min, conductores disponibles, facturado del mes, comisión de la plataforma, valoración media), **mapa de la flota en vivo** y últimos pedidos. Se refresca cada 15 s.
- **`/admin/orders`**: columnas de conductor y pago, búsqueda por cliente/teléfono/conductor/dirección, y **fila clicable** →
- **`/admin/orders/[id]`** (detalle completo): **cronología con horas reales** (creado → aceptado → en camino → recogido → entregado), cliente con teléfono, conductor con reasignación, ruta, carga + fotos + ayuda pedida, pago con botón "Marcar pagado", valoración, chat en solo-lectura y cancelación.
- **`/admin/settings` → Tarifas editables**: precios base por furgoneta, hora extra, seguro y comisión se editan ahí y **toda la app los usa al momento** (landing, formularios, ganancias del conductor). Ya no hay precios en el código (`app_settings.tariffs` + `src/lib/tariffs.js`).
- **`/admin/drivers`**: gestión completa unificada — candidaturas nuevas, alta de conductor (invite-user), verificación con documentación y fotos, disponibilidad, suspensión, borrado.

## 3. Credenciales y accesos

| Qué | Dónde |
|---|---|
| Admin app | `renato.0550.calero@gmail.com` / `ClicyVoy2026!` (cambiable por email en /forgot-password) |
| Cuentas de prueba | ⚠️ **Borradas en la limpieza del 2026-07-06** (cliente.test / conductor.test). Recrearlas si se quieren pasar las suites E2E |
| Correo (Resend SMTP) | Dominio `clicyvoy.es` verificado; API key en el secreto `RESEND_API_KEY` de la Edge Function y en el SMTP de Supabase Auth. Envía desde `noreply@clicyvoy.es` |
| Supabase (gestión) | Cuenta portemaniafurgo · Management API con el PAT del negocio |
| GitHub | Token de portemaniafurgo-bit embebido en el remote local (`.git/config`) |
| Google OAuth secret | JSON en Descargas (`client_secret_2_1012801251989...(1).json`) |
| Claves públicas (Supabase anon, Stripe pk) | `.env.local` (no versionado) y env vars de Vercel |

## 4. Cómo operar

```bash
npm run dev                      # local en http://localhost:3000
npm run build                    # build (34 rutas)
npx vercel deploy --prod --yes   # deploy a producción
```
- **Cambios de BD**: editar `supabase/migrations/` y aplicar por la Management API (o SQL Editor del dashboard). Nunca tocar la BD sin reflejarlo en la migración.
- **Edge Functions**: código en `supabase/functions/`; se despliegan por la Management API (`/functions/deploy`).
- **Tarifas**: se cambian desde la app, Admin → Ajustes (no requiere deploy).

### 2026-07-03 — Verificación E2E completa (bucle probar→corregir)
- Dos rondas con Claude Chrome (flujos de usuario 21/23; panel admin 22/22) y después **suites Playwright propias en el repo** ([`e2e/`](../e2e)): `flows.js` (invitado+conductor+cliente, 18 checks) y `admin.js` (panel completo, 26 checks). **Resultado final: 44/44 en producción.**
- Corregido a raíz de las pruebas: chat visible en solo-lectura tras la entrega; nombre completo del conductor; menú del admin completo (faltaban Operación/Usuarios/Ajustes); confirmaciones en dos clics en lugar de `confirm()` nativo (congelaba el navegador); detalle de pedido con `router.push` y estado de error visible; `send-email` responde `sent:false` en fallos de entrega (consola limpia).
- Verificado que NO eran bugs: el "pago pendiente" del informe (el conductor aceptó el pedido duplicado sin pagar; Stripe marcó `paid` correctamente) y el "fallo" del clic de fila (artefacto del test: `isVisible()` de Playwright no espera).
- Datos de prueba de todas las rondas borrados; BD limpia (0 pedidos, 0 candidaturas, conductor de prueba a 5.0/0 viajes).

### 2026-07-03 — Fase 2 del admin + Stripe real + duplicados + roles
- **Stripe server-side**: Edge Function `create-payment-intent` (valida que el pedido sea del usuario y crea el cargo real); `/payment` confirma con `confirmCardPayment`. Mientras no esté configurado el secreto `STRIPE_SECRET_KEY`, cae automáticamente al modo anterior (validar tarjeta sin cargo). ✅ Secreto `STRIPE_SECRET_KEY` configurado (2026-07-03): el cargo real funciona de punta a punta (verificado con un pago de 50€ de test que aparece en el dashboard de Stripe). Al lanzar: cambiar a claves `live`.
- **Finanzas** (`/admin/finance`): liquidaciones por conductor y periodo (semana/mes/todo) — efectivo lo cobra el conductor (debe comisión), tarjeta lo cobra la empresa (debe su parte); neto compensado. Export **CSV** de liquidaciones y de pedidos (formato Excel ES).
- **Estadísticas** (`/admin/stats`): pedidos por zona (CP 02001–08), horas punta, día de la semana y tipo de furgoneta.
- **Aviso de pedido duplicado**: si hay un pendiente con el mismo teléfono (<30 min), ambos formularios avisan y piden confirmación ("Crear otra igualmente"). En invitado lo valida la RPC (`force`), en autenticado el cliente.
- **Rol Empleado (staff)**: nueva función `is_staff()` y políticas RLS — el empleado ve/opera pedidos, chat e incidencias, pero NO tarifas, usuarios, conductores, finanzas ni estadísticas (menú filtrado + guards + RLS). El rol se asigna desde Admin → Usuarios (selector por usuario).
- Suites E2E ampliadas y auto-sembradas: **18/18 flujos + 30/30 admin** en producción.

### 2026-07-04 — Brief del negocio: furgonetas simples, ayuda con recargo, cancelación y opinión del conductor
- **Furgonetas "pequeña" y "grande"** (adiós L1H1/L1H2/L2H2, que nadie entendía): fotos nuevas del negocio en `public/vehicles/` con nota "imagen de referencia, tamaño aprox.". Datos existentes migrados. **Reparto por tamaño**: pedido de furgoneta grande solo lo ven conductores con furgón grande (lista y emails); pedido pequeño lo ven todos.
- **Precios nuevos**: pequeña **40 €** / grande **60 €** (2 h incluidas, hora extra 15 €) + **ayuda del conductor +30 €** — todo editable en Ajustes (`help_price` añadido).
- **Checkbox condicionado**: con ayuda contratada desaparece "acepto recogida a pie de calle" (el conductor sube/baja contigo); sin ayuda es obligatorio y se advierte que la mercancía debe estar preparada a pie de calle.
- **Cancelación del conductor** (solo antes de recoger): motivos predefinidos (pesada/voluminosa, carga mal especificada, sospecha de mercancía ilegal, cliente problemático, otro) → el pedido **vuelve a pendientes**, el motivo queda en el detalle del admin (recuadro rojo) y llega email a la empresa.
- **Opinión del conductor al entregar**: chips (Precio justo / injusto / Mucho tiempo de espera) + texto libre → visible en el detalle del admin y email a la empresa.
- **Bug de valoración ARREGLADO**: la puntuación del conductor no se actualizaba porque el cliente no tiene permiso (RLS) para escribir en driver_profiles; ahora lo recalcula un **trigger** en la BD (`sync_driver_rating`) al entregar y al valorar. Verificado.
- Suites E2E actualizadas: **21/21 flujos + 30/30 admin** en producción.

### 2026-07-04 — Sistema de rutas en vivo (estilo Uber)
- **Cliente**: ruta por carretera dibujada en el mapa (conductor → recogida; tras cargar, → entrega), ETA con **hora estimada de llegada** ('~3 min · 15:54') actualizándose en vivo, y banner verde "¡El conductor está llegando!" a <100 m.
- **Conductor** (pensado para móvil): mapa con su posición, destino de la fase actual y la ruta dibujada; su propio ETA; y botones **Google Maps / Waze** (deep links) que abren el navegador del teléfono con el destino puesto.
- Técnica: OSRM devuelve también la geometría de la ruta (gratis); geocodificación migrada a **Photon** (komoot) con Nominatim de respaldo — Nominatim bloqueaba peticiones por User-Agent y era frágil. Detección de llegada por distancia haversine.
- Limitación conocida: al ser web, el GPS del conductor solo emite con la pestaña abierta y pantalla encendida; mientras navega con Google Maps la posición se congela (solución definitiva: PWA/nativa, roadmap).
- Suites: **29/29 flujos + 30/30 admin** (checks nuevos: mapa/ruta/ETA/hora/botones ambos lados).

### 2026-07-04 — Rebranding: PorteManía → ClicyVoy
- Marca cambiada en toda la plataforma (16 archivos): logo (Clic**yVoy**), títulos/metadata, textos, emails y Edge Functions (redesplegadas).
- Dominio nuevo **https://clicyvoy.vercel.app** reclamado y asignado; https://pontemania.vercel.app sigue funcionando (ambas sirven la app). Supabase site_url → clicyvoy; allowlist incluye ambas.
- Pendiente del rebrand: el banner del hero es una imagen con el logo antiguo dibujado (hace falta un banner nuevo del negocio); añadir el origen clicyvoy.vercel.app en Google Cloud para el login con Google; los emails de prueba (@portemania.es) se mantienen porque son credenciales.

### 2026-07-04 — Dominio propio clicyvoy.es y Vercel consolidado
- El negocio compró **clicyvoy.es**: asignado al proyecto único de Vercel (www redirige al apex con 308). Supabase site_url → https://clicyvoy.es.
- La instalación de GitHub había creado un proyecto Vercel duplicado ('portemania'); se movieron sus dominios al principal y se borró. Proyecto único: **clicyvoy** (todo verificado ✓).
- Pendiente: añadir https://clicyvoy.es a los orígenes de Google OAuth (Google Cloud) para el login con Google desde el dominio nuevo.

### 2026-07-05 — Blog + SEO técnico y fixes de reparto
- **Blog completo**: Admin → Blog (editor con vista previa, Markdown seguro sin dependencias, slug automático, extracto para Google, portada a Storage, borrador/publicar/despublicar). Público /blog (ISR 5 min) y /blog/[slug] con metadata dinámica, canonical, Open Graph, Twitter card y schema.org Article. **sitemap.xml dinámico** (siempre incluye el último artículo) y **robots.txt** (áreas privadas fuera). Primer artículo publicado: /blog/precios-portes-albacete. Enlace Blog en el footer.
- Fixes: panel del conductor aplica el mismo reparto por tamaño que Solicitudes (mostraba pedidos grandes a furgones pequeños → lista vacía al entrar); alta de conductor del admin pide tamaño de furgoneta; tamaño editable en la ficha; **todos los conductores existentes puestos en furgoneta grande** (decisión del negocio).
- Suites: **29/29 flujos + 35/35 admin** (5 checks de blog nuevos, con calentamiento de ISR).

### 2026-07-06 — Correo real (Resend + dominio propio) y arreglo del alta de conductores
- **Dominio clicyvoy.es verificado en Resend** (DKIM+SPF+MX en Hostinger) y conectado como **SMTP de Supabase Auth**: los emails de restablecer contraseña e invitaciones ya salen de verdad desde noreply@clicyvoy.es (probado: recovery 'delivered'). Límite subido a 100/h. Antes salían por el correo de PRUEBA de Supabase (2/h) y no llegaban → causa del 'Invalid reset link'.
- send-email (avisos a conductores) ahora también envía desde clicyvoy.es (antes onboarding@resend.dev, solo llegaba al negocio).
- **Alta de conductor**: fallaba con emails ya existentes (createUser sobre cuenta existente daba error Y corrompía su contraseña — así se rompió el login admin). Corregido: invite-user comprueba existencia antes; el panel muestra la contraseña temporal en pantalla para enviarla por WhatsApp (onboarding sin depender de email).
- Contraseña del admin restaurada y cambiada a **ClicyVoy2026!** (estable).

### 2026-07-06 (tarde) — Bug grave: conductores no veían pedidos + email operativo
- **BUG DE PRODUCCIÓN**: los conductores reales (Leandro, Sergio) NO veían ningún pedido pendiente. Causa: al crearlos el admin, su driver_profile queda con created_by_id = uid del ADMIN (el trigger set_created_by usa auth.uid() del que inserta), y la RLS de 'ver pendientes' exigía created_by_id = auth.uid() del conductor. Corregido a dos niveles: (1) datos, se vinculó created_by_id de cada perfil a su cuenta por email; (2) RLS robusta, el conductor verificado ve/acepta pendientes si created_by_id O su email coinciden (versionado en la migración). Verificado: Sergio pasó de 0 a 10 pendientes visibles.
- Email: Resend + dominio clicyvoy.es verificado y conectado como SMTP de Supabase (los resets/invitaciones ya llegan). Alta de conductor muestra la contraseña en pantalla (WhatsApp). Admin restaurado a ClicyVoy2026!.
- Suites 29/29 + 35/35.

### 2026-07-06 (fin) — Limpieza de la BD para probar desde cero
- A petición del negocio se vació la base de datos para pruebas en limpio: **borrados** todos los pedidos, chats, candidaturas, usuarios cliente, TODOS los conductores (perfiles incluidos) y las cuentas de prueba (cliente.test, conductor.test). También el artículo de blog de ejemplo.
- **Conservado**: cuenta admin (renato.0550.calero / ClicyVoy2026!), cuenta del negocio (portemaniafurgo@gmail.com), los 3 artículos de blog reales del negocio, y las tarifas/configuración.
- Estado final: 2 usuarios auth (admin + negocio), 0 conductores, 0 pedidos, mapa público vacío. El esquema/estructura intactos.
- ⚠️ Consecuencia: las **suites E2E** (e2e/flows.cjs y e2e/admin.cjs) dependen de cliente.test/conductor.test; no correrán hasta recrear esas dos cuentas.

### 2026-07-06 (noche) — Onboarding por email + documentos de autónomo + bug de docs "perdidos"

- **Alta de conductores por email (flujo estándar)**: al crear un conductor le llega
  "Te han invitado a ClicyVoy 🚐" y crea su propia contraseña en `/reset-password`
  (enlace `token_hash` a prueba de escáneres de correo — era la causa del
  "Invalid reset link"). Eliminado el apaño de contraseña en pantalla/WhatsApp.
  Verificado E2E completo: alta → email → enlace → contraseña propia → login (7/7).
- **Documentos nuevos del conductor**: recibo de autónomo y situación censal
  (Hacienda), obligatorios para recibir trabajos (migración `0002`). Admiten PDF.
- **Re-subida de documentos**: botón «Cambiar» en cada documento (para caducidades:
  recibo, seguro, censal…). El admin ve todos los documentos en la ficha (PDF como chip).
- **Bug corregido — "me pide todos los documentos de nuevo"**: el perfil del
  conductor se buscaba solo por `created_by_id` (que en perfiles creados por el
  admin apunta al admin) y con email sensible a mayúsculas → la app creía que no
  había perfil, pedía todo otra vez y podía crear un duplicado vacío al guardar.
  Ahora hay un lookup único y robusto en `src/lib/driverProfile.js` (created_by_id
  → email case-insensitive → re-vínculo automático) usado por panel y perfil.
- **Contraseña admin "incorrecta"**: era Claude reseteándola a `ClicyVoy2026!` para
  las pruebas mientras el dueño ponía la suya. Norma desde hoy: NO tocar la
  contraseña del admin; para pruebas se crean cuentas temporales que se borran.
- **Plan post-MVP**: escrito en `docs/PLAN-APP-ANDROID.md` (React Native + Expo,
  cuadro de funcionalidades cliente/conductor/plataforma, 3 fases).

### 2026-07-07 — Revisión de calidad pre-entrega (4 auditores + verificación real)

Auditoría en paralelo de cliente, conductor, admin y seguridad; cada hallazgo se
verificó contra código/BD reales y se corrigió. Commit `c076831` + migraciones
0003/0004 + Edge Functions send-email v7 / create-payment-intent v6.

**Seguridad (migraciones 0003 + 0004, verificado con ataques reales):**
- Escalada a admin cerrada por dos vías: (a) `signup` con `data.role=admin`
  (whitelist en `handle_new_user`); (b) `UPDATE` del propio `profiles.role`
  (trigger `protect_profile_role`). El trigger DEBE ser `SECURITY INVOKER`: como
  DEFINER, `current_user` era el propietario (postgres) y el propio trigger lo
  autorizaba → el bug tardó en verse. Probado: cliente no puede hacerse admin;
  transición legítima client→driver sigue funcionando.
- PII de conductores (teléfono, email, nº carnet, DNI, recibo autónomo, censal)
  ya NO es legible por cualquier usuario autenticado: RLS de `driver_profiles`
  restringida a dueño/staff/cliente-con-pedido-asignado. `get_public_drivers`
  (nombre + ubicación difusa) sigue siendo la vía pública.
- Bucket `driver-docs` pasa a **privado** (documentos de identidad ya no
  accesibles por URL).
- `transport_requests`: insert/update acotados (no insertar 'paid', ni a nombre
  de otro; el conductor solo se autoasigna o devuelve a pending).
- CP 02001-02008 validado también en la RPC de invitado (servidor).

**Pagos:**
- `create-payment-intent` recalcula el importe en el servidor desde las tarifas
  (probado: pedido con `estimated_price` manipulado a 1€ → cobra los 90€ reales).
  Idempotencia por pedido (sin cargos duplicados).
- Página de pago: **eliminado el fallback que marcaba el pedido como pagado sin
  cobrar** (era pérdida de dinero directa). Sin Stripe → ofrece efectivo, nunca
  marca pagado. Guard de pedido ya pagado (evita re-cobros al volver atrás).

**Robustez cliente/conductor/admin:** order/[id] con catch (sin spinner
infinito), onError con avisos en chat/valorar/cancelar, subida de fotos con
manejo de error, CP robusto (varios códigos en la dirección); caché de ganancias
del conductor separada (ya no infla con cancelados), carrera al aceptar resuelta
(update condicionado), gate por perfil incompleto/no disponible en Solicitudes,
aviso de GPS denegado, comisión desde tarifas; guards en órdenes/incidencias del
admin, staff no ve finanzas, reasignación resuelve el uid real del conductor,
validación de tarifas y de slug/contenido del blog.

**Aviso de pedido nuevo:** `send-email` modo `new_request` — el servidor resuelve
destinatarios (admins + conductores verificados compatibles con el tamaño) y el
contenido. Probado: 4/4 entregados (incluido el conductor verificado).

⚠️ **GOTCHA de despliegue de Edge Functions**: desplegar SIEMPRE con el endpoint
multipart `POST /v1/projects/{ref}/functions/deploy?slug=...` (metadata JSON +
file), que genera el bundle ESZIP. El `PATCH .../functions/{slug}` con `{body}`
sube el código en crudo (sin ESZIP) → la función arranca con `BOOT_ERROR`.

### 2026-07-07 (tarde) — Bug real del cliente: perfil cruzado con otro conductor

Reporte del negocio (6-jul 22:52, antes del fix de esa noche — pero el fix de la
noche NO cubría este caso): entró como conductor con su correo (el del admin),
subió un documento y su perfil "se convirtió" en el del conductor Sergio que
acababa de crear; desde entonces le salía el perfil de Sergio y le pedía toda
la documentación otra vez.

**Causa raíz (dos piezas que se combinan):**
1. El trigger `set_created_by` rellena `created_by_id` con el uid de QUIEN
   INSERTA → los perfiles dados de alta desde `/admin/drivers` quedaban
   ligados al uid del ADMIN, no al del conductor invitado.
2. `fetchMyDriverProfile` buscaba PRIMERO por `created_by_id` (con `limit(1)`
   sin `order`): un admin que además es conductor "hereda" el último perfil
   que creó, y sus subidas de documentos se guardan en la fila del otro.

**Arreglos (código + BD):**
- Alta desde admin: `DriverProfile.create` pasa el `created_by_id` del
  conductor invitado (`invite.user.id`) — el perfil nace bien vinculado.
- `fetchMyDriverProfile`: la identidad fiable ahora es el **email de login**
  (case-insensitive, fila más antigua si hay duplicados, re-vínculo
  self-heal); `created_by_id` queda como respaldo y descartando filas cuyo
  email es de otra persona.
- Migración `0005_fix_driver_profile_linkage.sql`: re-vincula las filas
  existentes al usuario auth de su mismo email (también corrige que, con la
  fila de Sergio ligada al admin, el trigger de valoraciones y la policy de
  aceptar pedidos trataran esa fila como del admin), y normaliza con
  `lower()` la comparación de email de la policy de UPDATE (el self-heal
  podía fallar en silencio por mayúsculas).
- ⚠️ Revisar en `/admin/drivers` la ficha de Sergio: puede contener documentos
  subidos por error desde la cuenta del admin (la mezcla ya ocurrida no se
  puede deshacer automáticamente).

### 2026-07-07 (tarde, 2ª ronda) — Auditoría multi-agente: hallazgos restantes corregidos

Tras el fix del perfil cruzado, una auditoría de 33 agentes (4 dimensiones +
verificación adversarial) confirmó estos problemas adicionales, corregidos:

- **PII a bucket privado (grave)**: TODOS los documentos se subían al bucket
  público `cargo-photos` (URLs accesibles sin sesión) aunque la 0003 había
  preparado `driver-docs` privado. Ahora carnet, DNI, seguro, recibo de
  autónomo y censal se suben a `driver-docs` y se guardan como referencia
  `driver-docs://<path>`; se abren con signed URLs (helper
  `resolveDriverDocUrl`, miniaturas `DriverDocThumb` en la ficha del admin).
  La selfie y las fotos del vehículo siguen públicas (se muestran al cliente).
  Las URLs públicas antiguas se siguen mostrando por compatibilidad — los
  ficheros ya subidos permanecen en el bucket público hasta re-subirse.
- **`/admin/workers`** creaba perfiles sin `created_by_id` (misma raíz del
  perfil cruzado por otra vía): ahora pasa el uid del invitado.
- **`/reset-password`**: muestra SIEMPRE de qué cuenta se va a cambiar la
  contraseña (con una sesión previa de otra cuenta viva en el navegador se
  podía cambiar la equivocada sin saberlo) y cierra la sesión temporal tras
  guardar.
- **`order/[id]`**: la ficha/GPS del conductor tomaba la fila más NUEVA en
  colisión (orden por defecto `-created_date`); ahora pide la más antigua.
- **Login conductores**: mensajes de error diferenciados (rate-limit, cuenta
  sin activar, credenciales) en vez de "credenciales incorrectas" para todo.
- **Migración `0006`** (aplicada en prod): la policy de INSERT de
  `driver_profiles` permitía a cualquier autenticado insertarse un perfil
  `verified` (→ ver pedidos pendientes con PII de clientes); ahora solo staff
  crea perfiles arbitrarios y el auto-registro nace `pending_verification` y
  propio. UNIQUE sobre `lower(email)` contra duplicados.
- `fetchMyDriverProfile`: escapado de comodines LIKE en la búsqueda por email.

Pendiente menor (anotado, no bloquea): mover los ficheros antiguos del bucket
público al privado (hoy: 2 conductores, re-subirán al caducar), borrar el
fichero anterior al re-subir (huérfanos), y gestión de caducidad con fechas y
avisos (diferida al plan de la app Android).

### 2026-07-07 (noche) — Auditoría integral "producto final": 53 hallazgos, todos los relevantes corregidos

Auditoría multi-agente de TODAS las funcionalidades (público/invitado, auth,
cliente, conductor, admin, transversal) con verificación contra la RLS vigente.
Corregido en esta tanda:

**Flujos rotos o a medias (graves):**
- La distancia del pedido era un número ALEATORIO (5–34 km, `Math.random`)
  visible para cliente y conductor → ahora se geocodifican origen/destino
  (Photon/Nominatim) y se usa la ruta real de OSRM; si falla, no se muestra.
- Pedido con tarjeta abandonado no se podía pagar nunca → botón «Pagar ahora»
  en el detalle. Pagar un pedido cancelado ahora está bloqueado (página + Edge).
- Registro con email ya existente dejaba al usuario atrapado en la pantalla
  OTP sin código posible → detectado (identities vacías) con mensaje y enlace.
- El historial del conductor enlazaba a la vista de CLIENTE (podía valorarse
  a sí mismo) → enlaza a su vista de trabajo, y la valoración exige ser dueño.
- Conductor/cliente sin perfil veían un falso «Cuenta desactivada/eliminada»
  → CTA de completar perfil; «suspendida» solo si el estado es suspended.
- Incidencias estaba a MEDIAS (panel admin sin forma de crearlas) → botón
  «Reportar un problema» en el pedido del cliente y en el trabajo del conductor.
- Ningún login redirigía por rol (conductor/admin caían al panel de cliente
  sin salida) → redirección por rol en login y dashboard; /login legado (en
  inglés) redirige a /login-clientes.
- Con furgoneta preseleccionada se saltaba el único paso con horas extra →
  el paso 3 se muestra siempre. El parámetro ?vehicle ya no se pierde al
  registrarse.
- /solicitud-enviada prometía un seguimiento online imposible para invitados
  → texto honesto (la cuenta sirve para los PRÓXIMOS pedidos).

**Seguridad (migración 0007, código + Edge):**
- Un conductor podía AUTO-VERIFICARSE (UPDATE sin WITH CHECK) → trigger que
  congela status/rating/viajes para no-staff.
- Un cliente podía marcar su pedido como PAGADO sin pagar → nueva Edge
  Function `confirm-payment` (verifica el cargo real en Stripe con la clave
  secreta y escribe con service role); trigger que impide cambiar
  payment_status/final_price a no-staff. create-payment-intent rechaza
  pedidos cancelados.
- El invitado fijaba su propio precio → `create_guest_request` recalcula el
  precio EN SERVIDOR desde las tarifas; duplicados por teléfono normalizado.
- El staff no podía resolver el uid del conductor al reasignar (RLS de
  profiles solo admin) → profiles legibles por staff.

**Calidad/pulido:** manejo de errores con toast en subida de docs del
conductor, guardado de perfil (cliente y conductor), acciones del admin sobre
pedidos (reasignar/pagar/cancelar con onError y cierre al confirmar), portada
del blog; PDF admitido en carnet/DNI/seguro; aviso «perfil en revisión» para
conductores pending; nombre del conductor (no su email) al aceptar; chat con
append optimista (Realtime caído); pestaña «Recogidos» en admin/orders;
reasignar oculto en pedidos cerrados y limpia el rastro de cancelación;
duplicado de alta comprobado en BD antes de invitar; alta de trabajadores
nace no-disponible (ya no aparecía en el mapa público); hero servido en local
(antes CDN de Base44); footer con enlaces reales y zona real (Albacete);
cambio de contraseña en /profile; roles en español; DriverDocThumb con estado
de error; e2e con admin temporal vía E2E_ADMIN_EMAIL/PASS.

### 2026-07-07 (noche) — Verificación REAL en producción: 64/64 checks

Con todo lo anterior desplegado (deploy `a1acd54` READY, migración 0007
aplicada, Edge Functions `confirm-payment` v1 y `create-payment-intent` v7
ACTIVAS con ESZIP y arranque verificado):

- **Suites E2E contra producción: `flows.cjs` 29/29 + `admin.cjs` 35/35**
  (renombradas a `.cjs`: con `"type":"module"` en package.json no podían
  ejecutarse; checks del blog ahora DINÁMICOS sobre el artículo publicado más
  reciente — el de ejemplo ya no existe, el negocio publicó los suyos).
- **Ataques reales bloqueados (verificado por API):** invitado pidiendo
  precio 1€ → se guarda 40€ (recalculado en servidor); cliente PATCH
  payment_status='paid' → sigue 'pending'; conductor PATCH rating/viajes →
  sin cambios.
- **Documentos antiguos migrados al bucket privado**: los 5 docs sensibles
  del conductor Renato copiados a `driver-docs`, campos reescritos a
  `driver-docs://…`, originales borrados del bucket público (la URL pública
  antigua ya devuelve 400). Signed URL verificada (staff descarga, anónimo no).
- Config verificada: `send-email` sin verify_jwt (aviso de invitados
  funciona), registro instantáneo (autoconfirm) — coherente con el nuevo
  flujo de registro sin pantalla OTP.
- **Cuentas de prueba**: se recrearon por SQL para las suites (cliente.test,
  conductor.test y un admin temporal e2e.admin.test para NO tocar la
  contraseña del dueño — las suites aceptan E2E_ADMIN_EMAIL/PASS) y se
  BORRARON al terminar. Estado final de la BD: solo datos reales (4 usuarios,
  2 conductores, 1 pedido de prueba del dueño).


### 2026-08-07 — Rediseño web (Fase 1 de la propuesta ClicyVoy)

Alcance completo en [FUNCIONALIDADES-PROPUESTA.md](FUNCIONALIDADES-PROPUESTA.md).

**Catálogo real de servicios.** Hasta ahora la BD solo distinguía `transport` y `package`: mini mudanza, porte y compra en tienda eran la misma fila. Ahora `service_type` vale `porte` | `mini_mudanza` | `porte_tienda` | `paquete`, definidos en `src/lib/services.js` (única fuente: nombres, iconos, qué pasos activa cada uno y a qué landing corresponde).

**Un solo precio.** Los precios vivían en cinco sitios que se contradecían — la landing anunciaba la mini mudanza a 99 € mientras el asistente cobraba 60 €. Ahora:
- `app_settings.tariffs` es tarifario por servicio (porte 40 €, mini mudanza 99 €/2 h, hora extra 25 €, ayuda 39 €, planta sin ascensor 15 €, parada 20 €, tienda 30 €, paquetes 4,99/7,99/9,99 € y Villarrobledo 19,99 €).
- La fórmula vive en `public.compute_quote` (migración 0010) y un trigger `BEFORE INSERT` fija `estimated_price` y `price_breakdown` en **todos** los pedidos. Antes solo el invitado tenía el precio recalculado en servidor; el cliente autenticado mandaba el suyo.
- `create-payment-intent` ya no duplica la fórmula: llama a la misma función.
- `src/lib/pricing.js` la replica en el navegador **solo para enseñar el desglose en vivo**. Si se toca una regla, hay que tocarla en los dos sitios.

**Servicios nuevos en el flujo:** paradas intermedias (+20 €), ascensor y plantas por dirección (15 €/planta, solo con ayuda contratada), límite de 6 objetos en el porte, receptor y firma obligatoria en paquetes y entregas a tiendas, y envío a Villarrobledo (02600, hasta 10 kg, 24 h).

**Un solo asistente.** Los tres formularios duplicados (hero, invitado y cliente con cuenta, ~2.700 líneas que se desincronizaban) se sustituyen por `RequestWizard` + el hook `useRequestForm`. El hero pasa a ser un arranque rápido: eliges servicio, pones las dos direcciones y entras al asistente.

**Regla de UX aplicada:** la home y las landings solo enseñan precio y ventajas. Las condiciones que frenan al cliente (que la ayuda es un trabajo de dos, el recargo por plantas, el aviso de que declarar mal la carga se recalcula como mudanza) están dentro del proceso de compra, con el precio actualizándose en vivo.

**SEO:** cuatro landings indexables (`/portes-albacete`, `/mini-mudanzas-albacete`, `/portes-para-tiendas`, `/envio-paquetes-albacete-villarrobledo`) con metadatos, Open Graph, JSON-LD de Service y FAQPage, precios reales leídos en servidor y enlazadas desde el sitemap, el menú, el pie y el bloque de texto de la home (que ahora es el H1).

**Datos honestos:** el panel del mapa mostraba «12 conductores disponibles» y «~8 minutos» hardcodeados; ahora sale de `get_public_drivers()`. Los tres badges de Google Play enlazaban a `/ser-conductor` para una app que no existe; se sustituyen por el formulario real y un «próximamente».

**Reseñas de Google:** sección al final de la home. Lee la ficha real vía Places API si se configuran `GOOGLE_PLACES_API_KEY` y `GOOGLE_PLACE_ID`; sin ellas muestra el enlace al perfil, nunca testimonios inventados.

**Firma de entrega:** el conductor la captura en el panel web y se guarda en el bucket privado `delivery-proofs` (dato personal), visible solo para el cliente del pedido, su conductor y el staff.

> ⚠️ **Orden de despliegue.** La migración `0010` renombra `service_type` de `package`→`paquete` y `transport`→`porte`/`mini_mudanza`. El código anterior compara con `"package"`, así que **BD y web tienen que subir juntas**: aplicar la migración y desplegar en la misma ventana, no antes.

### 2026-08-08 — Cierre de la Fase 1 (rediseño web completo, listo para desplegar)

Revisión punto por punto contra `FUNCIONALIDADES-PROPUESTA.md` §1 y remate de lo que faltaba:

- **`final_price` al cerrar el servicio** (punto 1.10, era lo único sin implementar): sección 9 de la migración `0010` — trigger `trg_stamp_final_price` que, al pasar el pedido a `delivered`, estampa `final_price = estimated_price` si nadie lo fijó antes. Corre después de `trg_protect_order_payment_fields` (orden alfabético de triggers), así que primero se descarta cualquier valor que intentara colar el cliente y después lo escribe el servidor. Backfill de los pedidos ya entregados incluido. Los extras de la app del conductor (horas excedidas, ayuda añadida) partirán de este valor.
- **Lint a 0 errores** (había 6): `Msg` del perfil subido a nivel de módulo (no crear componentes durante el render) y directivas puntuales con justificación en los `setState`-en-efecto intencionados (AuthContext, mapa de la home, ETA del pedido). Las 26 warnings restantes son preexistentes (hooks deps, `<img>`, etc.).
- **Suites E2E adaptadas al flujo nuevo** (`e2e/flows.cjs` y `e2e/admin.cjs`): el invitado ahora entra por `/solicitar?service=mini_mudanza` y comprueba selector de servicios, aviso "trabajo de dos", accesos por dirección, hora extra sumada en vivo y el desglose (`Precio total` + líneas de ayuda y hora extra); el admin comprueba el hero nuevo (mapa "Conductores en Albacete", contador real o "Servicio bajo demanda") y el tarifario por servicio en Ajustes (porte 40, mudanza 99, Villarrobledo 19.99). ⚠️ Solo pueden ejecutarse **después** de desplegar (van contra producción) y exigen recrear `cliente.test`/`conductor.test` (borradas en la limpieza del 2026-07-06).
- **Limpieza**: borrado `DriversMapSection.jsx` (huérfano desde que el mapa vive en el hero); el comentario de `pricing.js` apuntaba a una función inexistente (`quote_request` → `compute_quote`).
- **Verificación**: `npm run build` ✓ (42 rutas, las 4 landings estáticas) y `npm run lint` ✓ (0 errores).

**Estado: la Fase 1 está completa en código y SIN desplegar.** Para publicarla: aplicar `0010` por la Management API (cuenta del negocio) y hacer push/deploy **en la misma ventana** (ver aviso de arriba), luego correr las suites. Pendiente de negocio (no bloquea): fotos reales de la furgoneta para la landing de mini mudanzas, `GOOGLE_PLACES_API_KEY`/`GOOGLE_PLACE_ID` para las reseñas, y la elección formal entre las 2 direcciones de diseño (1.1) si se quiere presentar alternativa a la actual.

### 2026-08-08 — FASE 1 DESPLEGADA EN PRODUCCIÓN y verificada (72/72)

- La migración `0010` ya estaba aplicada en producción de una sesión anterior (verificado: `compute_quote`, triggers de precio y `final_price`, columnas nuevas y tarifario por servicio, pedidos migrados a `porte`/`mini_mudanza`/`paquete`). Solo faltaba el código.
- **Commit `ac97329`** (65 archivos, toda la Fase 1) pusheado → deploy automático de Vercel. Verificado en vivo: las 4 landings SEO responden 200 en clicyvoy.es y el sitemap las incluye.
- **Suites E2E contra producción: `flows.cjs` 34/34 + `admin.cjs` 38/38** (comprobaciones nuevas del flujo: selector de servicios, aviso «trabajo de dos», accesos ascensor/plantas, hora extra a 25 € en vivo, desglose con ayuda, etiqueta de servicio en la tarjeta del conductor, hero con contador real, tarifario por servicio en Ajustes).
- Fix de suite: con ayuda contratada es obligatorio responder «¿Hay ascensor?» en ambas direcciones (la suite no lo rellenaba). Cuentas de prueba recreadas por SQL y **borradas al terminar** — gotchas del seed documentados en [e2e/README.md](../e2e/README.md).
- BD final: solo datos reales (6 usuarios, 3 conductores, 12 pedidos, 0 restos de prueba).
- ⚠️ El token de Vercel del negocio (2026-07-04) **no tiene scope del team** — el deploy por CLI/API falla con «Not authorized … portemaniafurgo-7893s-projects». No bloquea (el deploy va por git push), pero para operar Vercel por API hay que regenerar el token con acceso al team.
- **Reseñas de Google visibles sin la Places API** (commit `8224331`, verificado en prod): la home muestra el volcado estático de las reseñas REALES de la ficha «Clicyvoy» (5,0 · 4 valoraciones) — las dos con texto, sin la respuesta del dueño ni valoraciones sin texto. Descubierto por el camino: el enlace corto guardado (maps.app.goo.gl/CEs2fNnTqzqcBkb4A) apuntaba a la DIRECCIÓN C. Gerona 15, no a la ficha de empresa; corregido al perfil real (`/g/11zgsd09_c`). Si llegan reseñas nuevas, actualizar a mano `src/lib/reviews.js`; al configurar `GOOGLE_PLACES_API_KEY`+`GOOGLE_PLACE_ID` pasan a leerse en vivo y el volcado deja de usarse.

### 2026-08-10 — Plan de acción ejecutable para la app Android

- Nuevo documento **[PLAN-ACCION-APP-ANDROID.md](PLAN-ACCION-APP-ANDROID.md)**: convierte la especificación de producto (2026-07-15) en 7 etapas con tareas ordenadas, archivos concretos y criterios de "hecho", pensado para que lo ejecute un agente de IA. Decisiones cerradas: Expo + expo-router en JS, carpeta `mobile/` en este repo, MapLibre + tiles OSM (sin API keys), Expo Push Service, Stripe PaymentSheet con Google Pay, sesión en SecureStore.
- Correcciones de alcance respecto al doc de julio detectadas en la revisión del código: el catálogo de servicios creció (mini mudanza 99 €, tiendas 30 €, paquete Villarrobledo 19,99 €) y la **firma de entrega ya existe en la web** (`deliveryProof.js`) → ambas cosas son paridad de Fase 1, no Fase 2.

### 2026-08-10 — App Android: Etapa 0 (parcial) y Etapa 1 (esqueleto) construidas

Ejecutando [PLAN-ACCION-APP-ANDROID.md](PLAN-ACCION-APP-ANDROID.md).

**Etapa 0 — backend y fixes web** (commit 527759c, desplegado):
- `supabase/migrations/0011_app_android_base.sql`: `driver_profiles.location_updated_at` + tabla `push_tokens` con RLS de dueño. **ESCRITA PERO NO APLICADA** (ver bloqueos abajo).
- `supabase/functions/send-push/index.ts`: espejo de `send-email` para Expo Push. El llamante solo manda `mode` + `order_id`; el servidor resuelve destinatarios y texto y comprueba que el estado real del pedido justifique el aviso, así que aunque se llame sin sesión (como `send-email`, por el flujo de invitado) solo puede reenviar una notificación que ya era cierta. Modos: `new_request`, `driver_assigned`, `driver_arriving`, `status_changed`, `chat_message`, `driver_cancelled`. **ESCRITA PERO NO DESPLEGADA.**
- T0.5 hecho: el reporte de incidencias ya deja elegir urgencia (normal/alta/urgente). Antes TODAS entraban como `normal` por defecto de columna y el admin no podía distinguir un retraso de un daño grave.

**Etapa 1 — esqueleto de la app** (commit e7e44c5, en GitHub): carpeta `mobile/`, Expo SDK 57 + expo-router en JavaScript. Sesión persistente en SecureStore (partida en trozos: el límite de ~2 KB por entrada no admite una sesión entera) con refresco atado al `AppState`; guardia de navegación por rol (una sola app, cara de cliente y de conductor); pantallas leyendo producción de verdad: catálogo con tarifas vivas de `app_settings`, pedidos del cliente vía RLS, ofertas del conductor con el filtro de tamaño de furgoneta y toggle de disponibilidad. `lib/` copia services/pricing/tariffs/zones/eta de la web y porta `driverProfile` con el lookup por email. Verificado con `expo config`, `expo-doctor` (19/20; el que falla es de red) y `expo export --platform android` (1705 módulos, bundle 3,8 MB, sin errores).

**Etapas 2 a 5 construidas el mismo día** (commits 6427291 → 8b917bc):
- **Asistente de pedido** con los 4 servicios reales, precio en vivo desde `app_settings`, direcciones con autocompletado (Photon/OSM) y "usar mi ubicación" — el código postal sale del geocodificador en vez de teclearlo, que era el fallo más común del formulario web. Fotos con cámara o galería **comprimidas en el móvil** (1600 px, JPEG 0.7) antes de subir. Borrador local y aviso de pedido duplicado.
- **Seguimiento en vivo, chat e historial** del cliente: todo por Realtime, sin un solo sondeo (la web refresca cada 3/5/10 s en tres pantallas). Mapa con MapLibre + tiles OSM, indicador de frescura de la posición, valoración, cancelación e incidencias con urgencia.
- **Conductor**: ofertas con filtro por tamaño de furgoneta, aceptación con update condicionado anti-carrera, estados con un botón, cancelación con motivo solo antes de recoger, navegación a Google Maps/Waze y **GPS en segundo plano** (expo-location + TaskManager con servicio en primer plano) que sigue emitiendo con el móvil bloqueado o navegando.
- **Push** registrado en la app con canales de Android y apertura del pedido al tocar la notificación; inerte hasta que exista la tabla `push_tokens`.
- **Proyecto EAS creado** (`@clicyvoys-team/clicyvoy`) y **build de desarrollo lanzada** con el token que aportó el usuario.

Gotchas de Expo SDK 57 que costaron tiempo y conviene recordar: `@expo/vector-icons` ya no viene incluido con `expo`; el plugin de Stripe exige `merchantIdentifier` en app.json o `expo config` falla; hace falta `.npmrc` con `legacy-peer-deps` porque expo-router arrastra dependencias web que piden otra versión de react; y **MapLibre v11 cambió la API entera** (`Map`/`Marker`/`GeoJSONSource`, no `MapView`/`PointAnnotation`). Además `eta.js` devuelve las coordenadas en orden `[lat, lng]` porque la web usa Leaflet, mientras que GeoJSON las quiere al revés.

**Etapa 0 CERRADA el 2026-08-11** (commits 808d1a9 y 7b154ae), tras autorizarlo el usuario nombrando el proyecto:
- Migración **0011 aplicada** en `dnehzwrqphqpkcdjwqfi`: columna `location_updated_at`, tabla `push_tokens` y 4 políticas RLS, verificadas por consulta al esquema.
- **`send-push` desplegada** con `verify_jwt=true` (todos sus llamantes tienen sesión; `send-email` sigue pública porque la solicitud de invitado en la web no tiene JWT). Verificada EN PRODUCCIÓN: arranca de verdad (devuelve un 404 real, no BOOT_ERROR), el guardia de estado salta un `new_request` sobre un pedido cancelado, y sin JWT responde 401.
- **Frescura del GPS mergeada y desplegada** en la web: el conductor escribe `location_updated_at` y el cliente ve «en vivo» o «hace X min»; el aviso «está llegando» ya exige posición reciente. Build 42/42 rutas.
- Nuevo helper `scripts/deploy-function.mjs` (endpoint multipart, el único que genera ESZIP).

**Pendiente de aportar por el negocio** para terminar: proyecto **Firebase** (transporte del push en Android), DSN de **Sentry** y cuenta de **Google Play Console** — ver §6 del plan de acción.

### 2026-08-11 (noche) — Marca real + cierre de huecos contra la propuesta comercial

El usuario aportó la **propuesta comercial aceptada por el cliente** (Rediseño web 300 € + App Cliente 700 € + App Conductor 700 €); pasa a ser el contrato de referencia. Cotejo completo punto por punto en **[PROPUESTA-VS-ESTADO.md](PROPUESTA-VS-ESTADO.md)**. Construido en esta tanda:

- **Marca de verdad**: iconos, adaptive icon, monocromo, splash y logo del login generados desde el MISMO SVG de la web (`scripts/generate-app-assets.mjs` con sharp; un solo origen de marca). La app dejó de llevar los assets de la plantilla de Expo. Splash con `expo-splash-screen` (en SDK 57 el campo `splash` de app.json ya no hace nada solo).
- **Prueba de entrega completa** (T4.9): lienzo de firma (react-native-svg + view-shot → PNG) + foto de lo entregado, subidas ANTES de marcar entregado al bucket privado `delivery-proofs` — las columnas ya existían de la web, sin migración. Obligatoria en paquete/tienda, opcional en portes.
- **Documentación del conductor** (T4.8): los 10 documentos con cámara/galería + compresión; sensibles → `driver-docs://` privado, selfie/furgoneta → público (mismas reglas que la web).
- **Ganancias** (T4.7): misma fórmula que la web (`(final_price||estimated_price) × (100−commission_pct)%`), hoy/semana/mes + gráfico de 7 días en SVG puro (recharts no existe en RN y para 7 barras no hace falta librería).
- **Pin en mapa** (patrón Uber: pin fijo, se arrastra el mapa) y **badges de no leídos** por pedido (last-read en AsyncStorage; el badge es UI, no estado de negocio).
- **Login con Google** (expo-web-browser + setSession con los tokens del fragmento). ⚠️ La consent screen del negocio sigue en Testing: solo test users hasta publicarla.

Módulos nativos añadidos (obligan a APK nuevo): expo-splash-screen, react-native-svg, react-native-view-shot, expo-web-browser. Pendiente contra la propuesta (ver cotejo): OTP SMS (Twilio 🔑), chat con fotos, programados, propina, PDF, tarjetas guardadas, caducidades (todos necesitan una migración o una credencial externa).

### 2026-08-11 (madrugada) — Re-tema morado + fase 2 completa de la propuesta

El usuario señaló que la app llevaba botones azules del diseño viejo: la línea gráfica de referencia es la de la **landing actual** (morado `#7145d6`/`#5a35b0`, amarillo de marca `#F5B400`, negro `#1a1b20`, botones redondeados). Re-tematizado TODO vía `mobile/theme.js` — ninguna pantalla lleva colores en duro (los `#EFF6FF`/`#3B82F6` que quedaban pasaron a tokens). A petición suya, **NO se lanza build hasta su OK** (la que estaba en cola se canceló).

**Migración 0012 APLICADA** en `dnehzwrqphqpkcdjwqfi` (verificada por consulta al esquema: columnas + política + 2 jobs pg_cron) y con ella construido:
- **Chat con fotos**: cámara/galería comprimidas, pintadas en app Y en la web (`chat_messages.image_url`).
- **Pedidos programados**: día/hora en el asistente; nacen `scheduled` (política de INSERT ampliada SOLO a fecha futura del propio usuario), job pg_cron los publica cada minuto y entonces disparan los avisos normales. Visibles y cancelables en la app.
- **Propina**: Edge Functions `create-tip-intent` + `confirm-tip` desplegadas con verify_jwt y verificadas (espejo del patrón de pago: el servidor valida el rango 0,50-20 €, un intento por pedido, y solo se anota tras verificar el cargo real en Stripe). UI con PaymentSheet tras la entrega.
- **Caducidades**: 5 columnas `*_expires_at` + `docs_expired`; el conductor pone la fecha al documento en su perfil, avisos visuales a ≤15 días, y job pg_cron diario que bloquea el reparto al vencer (el push de aviso llegará con Firebase).
- **Recibo PDF**: generado EN el móvil (expo-print) con la marca, compartible; sin Edge Function y funciona offline.
- **Auth**: `clicyvoy://` añadido a la allowlist de redirecciones de Supabase (sin esto el login con Google de la app no podía volver).

Verificación: bundle Android limpio (5,9 MB), build web 42/42 (el chat de las dos páginas web pinta fotos). El cotejo [PROPUESTA-VS-ESTADO.md](PROPUESTA-VS-ESTADO.md) queda: TODO ✅ salvo OTP SMS (🔑 Twilio), push efectivo (🔑 Firebase), Google login público (🔑 consent screen), tarjetas guardadas, email del recibo y escaneo de bordes.

### 2026-08-11 (tarde) — v0.1.1→0.1.3 probadas EN el móvil del usuario + handoff

Ciclo real de prueba con el usuario (Xiaomi, adb + capturas de pantalla + logcat en directo). Tres versiones en un día:
- **0.1.1**: cuelgue real en "Abriendo ClicyVoy…" → dos causas tapadas (SecureStore que revienta tras reinstalar sin catch; consulta de rol sin timeout). El adaptador de sesión ya no puede lanzar jamás.
- **0.1.2**: "Unmatched Route" al entrar (tres `index` disputándose `/` → grupos con pantallas CON NOMBRE `pedir`/`ofertas` + guardia que redirige siempre), isotipo recortado al rasterizar (caja holgada), G oficial de Google.
- **0.1.3**: el deep link de vuelta de Google (`clicyvoy://auth`) no tenía ruta → `app/auth.js` + `+not-found.js` como red de seguridad; splash APILADO (isotipo arriba, wordmark debajo); **expo-updates + EAS Update (canal preview)**: desde esta versión los cambios de JS llegan por OTA sin APK. VERIFICADO en el móvil: icono de marca en el launcher, splash nuevo, login con Google entrando hasta "Pedir", asistente morado funcionando (capturas en el historial del chat).
- MIUI ya acepta `adb install` (el usuario activó Instalar vía USB): la 0.1.3 se instaló sola desde el PC.
- **Conductor de prueba recreado y verificado** (login OK, driver verificado, furgón grande, docs completos): `conductor.test@portemania.es` / `Conductor2026!` — borrarlo tras las campañas.
- **[HANDOFF-APP-PENDIENTES.md](HANDOFF-APP-PENDIENTES.md)**: plan completo y documentado para que otro agente continúe (T1-T10 con pasos, credenciales, flujo OTA vs APK, reglas y trampas).

### 2026-08-12 (2ª tanda) — NEGOCIACIÓN DE PRECIO operativa en backend y web

El usuario aportó el rediseño de Claude Design (24 pantallas, negociación incluida; importado vía DesignSync) y aprobó: mapas se quedan en MapLibre gratis aproximando el estilo, y la negociación se implementa junto al rediseño. Hecho en esta tanda:

- **Backend (migración 0014, APLICADA y verificada)**: `proposed_price` con suelo del 60 % del precio calculado (trigger `zz_validate_proposed_price`, corre tras `set_request_price` por orden alfabético), tabla `price_offers` (Realtime activado, RLS de solo lectura — escrituras SOLO vía RPCs) y 4 RPCs security definer con anti-carrera: `make_price_offer`, `accept_price_offer`, `accept_at_client_price`, `reject_price_offer`. El precio pactado va a `final_price` (el trigger de 0007 lo permite a postgres) y fluye solo a ganancias/recibo/finanzas.
- **Pagos**: `create-payment-intent` v9 — cobra `final_price` (pactado/staff) si existe; si no, `compute_quote` como siempre. Y la Idempotency-Key ahora incluye el importe: si el importe cambió tras negociar, Stripe no rechaza la clave reutilizada con parámetros distintos. Verificada en prod.
- **Web conductor** (`/driver/requests`): pedidos con precio propuesto muestran «ofrece el cliente · tarifa X€», botón «Aceptar por X€» (RPC), formulario de contraoferta (importe + motivo) y estado «tu contraoferta: esperando». Sin negociación, flujo clásico intacto.
- **Web cliente** (`/order/[id]`): panel «Respuestas de conductores» EN VIVO (Realtime sobre price_offers) con aceptar/rechazar cada contraoferta; asistente con campo opcional «¿Quieres proponer tu precio?» (solo con cuenta; los invitados siguen a precio cerrado — la RPC de invitado ignora claves desconocidas).
- **send-push v2**: modos `price_offer` (→ cliente, importe leído de la BD) y `offer_accepted` (→ conductor, «¡Trato hecho!»), verificados; los dispara la web al contraofertar/aceptar.

Pendiente de esta funcionalidad: pantallas de la app (canvas 1e/1g/1i/1j) dentro del rediseño general, que es el siguiente bloque.

### 2026-08-12 — T0+T5+T6+T7 desarrolladas y PRIMERA ENTREGA OTA

Mapa embebido estilo Uber en el trabajo del conductor (posición propia en vivo por watchPositionAsync + banda de estado morada con stepper; Maps/Waze quedan como opción), oferta expandible con mapa y «a X km de ti», pulido visual completo con la paleta, pestaña Servicios (historial del conductor), borrado de cuenta (RPC 0013 aplicada; anonimiza pedidos, bloquea con servicio en curso) y recibo por email (send-receipt verificada). **Primera actualización OTA publicada** (runtime 0.1.3, canal preview, grupo c1ed011e): la app instalada la recibe al reabrirse dos veces, sin APK. Gotcha aprendido: eas update en no-interactivo exige --environment y, sin react-native-web instalado, hay que publicar con --platform android.

### 2026-08-12 — Pasada de calidad (revisión gráfica + funcional pre-entrega)

Revisión completa con ojos de cliente. **Gráfico**: tipografía Poppins en títulos (la de la landing; expo-font ya venía con vector-icons, cero módulos nuevos, y si la fuente falla la app arranca con la del sistema); botones `rounded-full` que oscurecen al morado de hover al pulsar, como los CTA de la landing. **Cinco fallos funcionales encontrados y corregidos**:
1. El detalle del pedido saltaba solo hasta el fondo al abrirse (el auto-scroll del chat disparaba con la carga inicial y escondía el mapa). Ahora solo baja cuando entra un mensaje nuevo estando dentro.
2. **GPS en trabajos largos**: el access token dura 1 h y el refresco automático se para en segundo plano → en una mudanza larga el GPS habría dejado de escribir EN SILENCIO. La tarea de fondo ahora fuerza `getSession()` (refresco perezoso) antes de cada escritura.
3. Las ofertas del conductor no tenían la suscripción Realtime prometida (solo pull-to-refresh). Añadida, con debounce.
4. El selector de pedido programado usaba un valor centinela feo ("  /  ") como estado; sustituido por estado propio.
5. En envíos de paquete la foto de entrega no se exigía pese a ser obligatoria en la propuesta; ahora la firma no se confirma sin foto. Y el toque de una notificación con la app CERRADA se perdía (arranque en frío): se recupera con `getLastNotificationResponseAsync`.

## 5. Pendientes / roadmap

**Para lanzar en real:**
1. Publicar la pantalla de consentimiento de Google (o añadir test users mientras).
2. Verificar dominio en Resend → los avisos por email llegarán a los conductores.
3. Al lanzar en real: cambiar Stripe de claves `test` a `live` (publicable en Vercel, secreta en el secreto de la Edge Function).

**Fase 2 del admin (propuesta ya definida):**
4. Dinero: desglose efectivo/tarjeta y liquidaciones por conductor (85/15) por semana/mes.
5. Exportar pedidos/ingresos a Excel/CSV (gestoría).
6. Búsqueda global por teléfono/cliente.

**Más adelante:**
7. Llamada cliente↔conductor con el fijo 967 14 99 55 enmascarado (Twilio/Zadarma, de pago). Mientras: el teléfono se comparte al aceptar el pedido (cubierto en política de privacidad).
8. Distancia real origen→destino en el precio (hoy simulada; el ETA ya usa ruta real).
9. Estadísticas por zona/horas punta; roles limitados para empleados.
10. Tests automatizados.

## 6. Decisiones técnicas clave (por qué)

- **Leaflet + OpenStreetMap + Nominatim + OSRM**: mapas, geocodificación y rutas 100% gratis, sin API keys. Se evitó Google Maps (de pago).
- **Tailwind fijado a v3.4**: para clonar exactamente el diseño de la referencia Base44.
- **RPCs `security definer`** para los flujos anónimos (solicitud de invitado, candidatura, mapa público): el anónimo no lee tablas directamente; cada RPC valida sus campos.
- **Lista blanca en `send-email`**: la función es pública (el invitado no tiene sesión) pero solo entrega a admins y conductores verificados — nadie puede usarla de spam.
- **`accepted_at`** se guarda al aceptar: permite la cronología real del admin.
