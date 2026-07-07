# ClicyVoy — Documento de seguimiento

> Historial de todo lo construido, el estado actual y lo que queda. Actualizado: **2026-07-07**.
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
