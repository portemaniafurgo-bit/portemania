# Funcionalidades de la futura app Android — ClicyVoy

> Escrito el **2026-07-15** tras una revisión funcional completa del código web
> (todas las pantallas de cliente, conductor y admin, tracking, chat, pagos y
> el nuevo servicio de paquetes). Complementa a [PLAN-APP-ANDROID.md](PLAN-APP-ANDROID.md)
> (elección de tecnología y fases) y a [SEGUIMIENTO.md](SEGUIMIENTO.md) (historial).
>
> **Este documento es la especificación de producto**: qué debe hacer la app,
> qué mejora respecto a la web y qué hay que tocar en el backend para lograrlo.

Leyenda usada en todo el documento:
- ✅ **Paridad** — ya existe en la web; en la app se rehace con UI nativa.
- ⬆️ **Mejora** — existe en la web pero la app lo hace sustancialmente mejor.
- 🆕 **Nuevo** — no existe hoy; la app (o el backend) lo estrena.

---

## 1. Por qué una app (y qué NO cambia)

La web actual es un MVP completo y seguro (precio calculado en servidor, RLS
endurecida, pagos verificados contra Stripe, 64/64 checks E2E en producción).
Pero hay cuatro cosas que **un navegador móvil no puede dar** y que definen a
un "Uber de furgonetas":

1. **GPS en segundo plano.** Hoy el conductor emite posición con
   `getCurrentPosition` en un intervalo de 15 s **solo mientras la pestaña está
   abierta y en primer plano**. Al bloquear el móvil o abrir Google Maps para
   navegar, la posición se congela en la BD y el cliente ve una ubicación vieja
   sin saberlo.
2. **Notificaciones push.** Hoy no existe ninguna: el conductor se entera de
   pedidos nuevos por email o teniendo la app abierta (polling cada 10 s), y el
   cliente **no recibe ningún aviso** cuando le asignan conductor, cuando está
   llegando o cuando le escriben por el chat.
3. **Cámara y ficheros de verdad.** Las fotos de carga/documentos se suben a
   tamaño completo (varios MB por foto de cámara), sin compresión ni miniaturas.
4. **Ahorro de batería/datos.** La web vive de polling: chat del conductor cada
   3 s, trabajo activo cada 5 s, solicitudes cada 10 s, posición cada 10-15 s.

**Qué no cambia:** todo el backend (Supabase: BD, RLS, RPCs, Edge Functions,
Storage, Realtime), las tarifas editables, el blog/SEO, la landing, el flujo de
invitado y el **panel de administración**, que sigue siendo web. La app es *otro
cliente* del mismo backend.

**Decisión de forma:** una **única app** con dos experiencias según el rol de la
cuenta (cliente / conductor), como Uber. Evita mantener dos apps y simplifica la
publicación. El admin no necesita app (a lo sumo, recibir push — ver §6).

---

## 2. Diagnóstico de la revisión: qué mejoraría en el upgrade

Hallazgos concretos del código, cada uno con su mejora correspondiente en la app:

| # | Hallazgo (web hoy) | Mejora en Android |
|---|---|---|
| 1 | GPS: `getCurrentPosition` + `setInterval` 15 s, solo con pestaña abierta; al cerrarla la última posición queda **congelada sin marca de frescura** — el cliente la ve como actual | Tracking continuo con ubicación en segundo plano (expo-location + task manager) y campo `location_updated_at`: si la posición tiene >60 s, la UI lo dice ("última posición hace 2 min") |
| 2 | Cero push; el cliente no recibe **ningún** aviso de estado ni de chat | FCM para todos los eventos (matriz completa en §6) con email de respaldo |
| 3 | Chat inconsistente: cliente por Realtime, conductor por **polling de 3 s**; sin no-leídos, sin sonido | Realtime unificado en ambos lados + push al recibir mensaje + badges de no leídos |
| 4 | Polling masivo (3/5/10/15 s) en todas las pantallas vivas | Suscripciones Realtime + push; el refetch queda solo como reconciliación |
| 5 | Fotos subidas **sin comprimir** (imagen de cámara completa) | Compresión y redimensionado en el dispositivo antes de subir + miniaturas |
| 6 | Direcciones tecleadas a mano con regex de CP (02001–02008); sin autocompletado ni mapa | Autocompletado de direcciones (Photon, ya usado) + **fijar el punto en el mapa** + "usar mi ubicación"; el CP se deduce del geocoding |
| 7 | Pago solo con CardElement web de Stripe (y en modo test) | Stripe nativo con **Google Pay** y métodos guardados; paso a claves live |
| 8 | Navegación por deep-link a Google Maps/Waze (funciona, pero saca al conductor de la app y el GPS web se congela) | Se mantienen los deep-links, pero con GPS en segundo plano la posición ya no se pierde al navegar |
| 9 | Sin modo offline; si falla la red se pierde lo tecleado | Borradores locales del asistente de pedido y cola de reintentos para chat/estado |
| 10 | Iconos de mapa cargados desde CDN externo (unpkg) | Recursos empaquetados en la app |
| 11 | **Cabos sueltos de producto detectados**: `priority` de incidencias nunca se fija al crearlas; `final_price` no lo escribe nadie (las horas extra reales se cobran "en mano" y no quedan registradas); `helpers_count` semi-muerto; alta duplicada workers/drivers | Ver §7 — se corrigen en el backend durante la fase 1, benefician también a la web |

---

## 3. App Cliente — funcionalidades completas

### 3.1 Cuenta y acceso
- ✅ Registro/login con email + contraseña y con Google (Supabase Auth).
- 🆕 **Login con teléfono (OTP por SMS)** — reduce fricción y verifica el
  teléfono, que es el dato operativo real del negocio (anti-fraude incluido).
- ✅ Recuperar contraseña; editar teléfono y contraseña en el perfil.
- ⬆️ Sesión persistente nativa (SecureStore) — no caduca como una cookie web.
- 🆕 Borrado de cuenta desde la app (requisito de Google Play).

### 3.2 Pedir un servicio (transporte o paquete)
- ✅ Asistente por pasos con **dos servicios**: *Transporte* (furgoneta pequeña
  40 € / grande 60 €, 2 h incluidas, hora extra, seguro, ayuda del conductor
  +30 €) y **🆕 en web hoy / paridad en app: Envío de paquetes mismo día**
  (0–9 kg 4,99 € · 10–19 kg 7,99 € · 20–30 kg 9,99 €; sin extras; foto opcional).
- ⬆️ Direcciones con autocompletado + pin en mapa + "usar mi ubicación actual"
  (hoy: campo de texto con regex de CP). La zona (CP 02001–02008) se valida
  igual en servidor.
- ⬆️ Fotos de la carga con cámara nativa integrada, multi-captura, compresión
  automática y reordenación.
- ✅ Aviso anti-duplicado (mismo teléfono, pendiente <30 min).
- ✅ Precio cerrado calculado en vivo y **siempre recalculado en servidor**
  (RPC / Edge Function — sin cambios).
- 🆕 **Pedido programado**: elegir fecha/hora futura con recordatorio push al
  cliente y publicación automática a los conductores a la hora elegida.
- 🆕 Borrador local: si el usuario abandona el asistente, al volver continúa.

### 3.3 Seguimiento en vivo (la pantalla estrella)
- ⬆️ Mapa con el conductor moviéndose en tiempo real (Realtime en vez de
  polling), ruta por carretera y **ETA con hora de llegada** (OSRM, ya existe).
- ⬆️ Indicador de **frescura de la posición** ("en vivo" / "hace 2 min") — hoy
  no existe y una posición congelada parece actual.
- 🆕 Push de proximidad: "Tu conductor está llegando" (<100 m — el umbral ya
  se calcula hoy, solo se muestra en pantalla).
- ✅ Timeline de estados (pendiente → aceptado → en camino → recogido →
  entregado) con los timestamps reales.
- ✅ Ficha del conductor: nombre, foto, valoración, fotos del vehículo,
  teléfono (llamada directa).
- 🆕 (fase 3) Llamada enmascarada vía el fijo del negocio (Twilio/Zadarma) en
  lugar de exponer el teléfono real — ya identificado en el roadmap web.

### 3.4 Chat
- ✅ Chat con el conductor por pedido (Supabase Realtime, ya montado).
- ⬆️ Push al recibir mensaje + contador de no leídos + sonido/vibración.
- ⬆️ Envío de **fotos** en el chat (hoy solo texto) con compresión.
- ✅ Tras la entrega queda en solo-lectura (historial).

### 3.5 Pagos
- ⬆️ Stripe nativo: tarjeta guardada, **Google Pay**, 3DS nativo. El flujo
  servidor no cambia (create-payment-intent recalcula, confirm-payment
  verifica el cargo real).
- ✅ Efectivo al conductor (opción por defecto del invitado web).
- 🆕 **Propina post-servicio** en la pantalla de valoración (cargo Stripe
  aparte, 100 % para el conductor).
- 🆕 **Recibo/factura PDF** por pedido, descargable y enviado por email
  (generación en Edge Function).
- 🆕 (fase 3) Cupones y códigos de referido (motor de descuentos en BD,
  validación en servidor dentro del cálculo de precio).

### 3.6 Historial y postventa
- ✅ Mis pedidos con filtros (activos/entregados/cancelados) y detalle completo.
- ✅ Valoración con estrellas + reseña (la media la recalcula un trigger en BD).
- ✅ Reportar incidencia desde el pedido (⬆️ fijando `priority` al crearla —
  hoy se crea sin prioridad, cabo suelto detectado en la revisión).
- ✅ Cancelación por el cliente **solo en pendiente** (regla actual). 🆕 Se
  añade **política de cancelación** explícita para pedidos ya aceptados
  (gratis hasta X min tras la aceptación; después, posible cargo — regla
  configurable en Ajustes del admin).
- 🆕 "Repetir pedido" desde el historial (rellena el asistente con lo mismo).

---

## 4. App Conductor — funcionalidades completas

### 4.1 Alta y verificación
- ✅ Candidatura pública (hoy formulario web /ser-conductor; la app enlaza o lo
  integra) y alta por invitación del admin con email.
- ✅ Perfil documental completo: selfie, carnet, DNI, seguro, recibo de
  autónomo, situación censal, 4 fotos del vehículo, marca/matrícula. Documentos
  sensibles en bucket privado con signed URLs (ya operativo).
- ⬆️ Subida con cámara nativa + recorte/escaneo de documento + compresión.
- 🆕 **Caducidades**: cada documento con fecha de vencimiento; push 15 días
  antes; al vencer, el perfil pasa automáticamente a "documentación caducada" y
  deja de recibir ofertas hasta re-subir (hoy la re-subida existe, el
  vencimiento no).

### 4.2 Trabajo diario
- ✅ Toggle **Disponible / No disponible** (hoy existe; en la app condiciona
  además el envío de ofertas push).
- ⬆️ **Ofertas por push** con sonido propio: hoy el conductor descubre pedidos
  por polling de 10 s o por email. En la app, push inmediato al publicarse un
  pedido compatible (por tamaño de furgoneta; los paquetes van a todos).
- 🆕 (fase 2) **Asignación automática**: la oferta se propone primero al
  conductor compatible más cercano con countdown de 30 s; si no responde, pasa
  al siguiente (hoy: lista abierta y el primero que acepta se lo lleva — la
  aceptación condicionada anti-carrera ya existe y se conserva).
- ✅ Detalle antes de aceptar: carga, fotos, direcciones, petición de ayuda del
  cliente, precio (su parte).
- ✅ Avance de estados con un botón (Iniciar viaje → He llegado → Finalizado) y
  cancelación con motivo solo antes de recoger (vuelve el pedido a pendientes y
  avisa a la empresa — regla actual).
- ⬆️ **GPS en segundo plano durante el trabajo activo** (expo-location +
  task manager): alimenta el tracking del cliente aunque el conductor esté
  navegando con Google Maps o con la pantalla bloqueada. Se apaga al terminar
  o al pasar a No disponible. Con `location_updated_at` para frescura.
- ✅ Deep-links a Google Maps / Waze para navegar (se mantienen).
- 🆕 **Prueba de entrega**: foto del paquete/mercancía entregada + firma del
  receptor en pantalla (obligatoria en envíos de paquete, opcional en portes).
  Protege ante disputas; visible para el cliente y el admin.
- ✅ Opinión del conductor al finalizar (chips + texto, llega al admin).
- ✅ Chat con el cliente (⬆️ Realtime + push en vez de polling de 3 s).

### 4.3 Dinero
- ✅ Panel de ganancias (hoy/semana/mes, gráfico 7 días) — hoy se calcula en el
  cliente; ⬆️ pasa a una vista/RPC en BD para que cuadre siempre con Finanzas
  del admin.
- 🆕 (fase 2) **Stripe Connect**: los cobros con tarjeta se reparten solos
  (85/15 según comisión configurada) y el conductor recibe **payout automático
  semanal**; los cobros en efectivo generan saldo deudor de comisión. Hoy la
  liquidación es un CSV manual del admin.
- 🆕 Resumen fiscal descargable por trimestre (para su gestoría de autónomo).

### 4.4 Extras
- 🆕 (fase 3) Mapa de calor de demanda por zona/hora (los datos ya existen en
  admin/stats).
- 🆕 Historial de valoraciones recibidas con comentarios.

---

## 5. Envío de paquetes en la app (servicio nuevo, ya en producción web)

El servicio lanzado el 2026-07-15 entra en la app con paridad total y dos
mejoras propias del móvil:

- ✅ Selector de servicio en el asistente, 3 tramos de peso con precio fijo,
  foto opcional, cualquier conductor puede aceptarlo, precio en servidor.
- 🆕 **Prueba de entrega obligatoria** (foto + firma, §4.2) — en paquetes es
  crítica porque el remitente no suele estar en la entrega.
- 🆕 Push al **destinatario** (si el remitente da su teléfono): enlace público
  de seguimiento del paquete sin cuenta (página web ligera, reutiliza el
  tracking).

---

## 6. Notificaciones — matriz completa (transversal)

| Evento | Cliente | Conductor | Admin |
|---|---|---|---|
| Pedido publicado | — | 🔔 Push (compatibles) + email actual | 🔔 Push si >10 min sin aceptar (hoy: solo alerta en panel) |
| Conductor asignado | 🔔 Push "Tu conductor es X" | 🔔 Push confirmación | — |
| Conductor en camino / llegando (<100 m) | 🔔 Push | — | — |
| Recogido / Entregado | 🔔 Push | — | — |
| Mensaje de chat | 🔔 Push + badge | 🔔 Push + badge | — |
| Conductor cancela | 🔔 Push "buscando nuevo conductor" | — | 🔔 Push + email actual |
| Pago confirmado / propina | 🔔 Recibo | 🔔 "Has recibido propina" | — |
| Documento caduca en 15 días / caducado | — | 🔔 Push | 🔔 Panel |
| Pedido programado (recordatorio) | 🔔 Push | 🔔 Al publicarse | — |

Infra: tabla `push_tokens` (usuario, token FCM, dispositivo) + Edge Function
`send-push` (espejo de la actual `send-email`, con la misma lista blanca de
destinatarios). **El email actual se conserva como respaldo.**

---

## 7. Cambios de backend necesarios (benefician también a la web)

Todo lo listado es aditivo; el esquema y las políticas actuales se conservan.

1. `driver_profiles.location_updated_at` — frescura del GPS (hallazgo #1).
2. Tabla `push_tokens` + Edge Function `send-push` (§6).
3. `transport_requests`: `scheduled_at` (programados), `proof_photo_url`,
   `proof_signature_url` (prueba de entrega), `tip_amount` (propina),
   `cancellation_fee` (política de cancelación).
4. `driver_documents` o columnas de caducidad por documento (`*_expires_at`) +
   job diario (pg_cron) que degrada el estado y dispara avisos.
5. Incidencias: fijar `priority` al crear (cabo suelto detectado) y push al
   admin en prioridad alta.
6. **`final_price` con uso real**: las horas extra que hoy se pagan "en mano"
   pasan a registrarse al finalizar el trabajo (el conductor declara horas
   reales, el sistema recalcula y cobra/registra la diferencia). Imprescindible
   para que Finanzas y Stripe Connect cuadren.
7. Consolidar el alta `workers` dentro de `drivers` (duplicidad detectada).
8. Limpiar `helpers_count` (campo semi-muerto; la realidad es `needs_help`).
9. Stripe: claves live + webhooks + (fase 2) Connect para payouts.
10. Analítica de producto (PostHog) y crash reporting (Sentry) — hoy no hay.

---

## 8. Alcance por fases (actualiza el plan de 2026-07-06)

**Fase 1 — La app existe y ya es mejor que la web (4-6 semanas)**
Paridad completa de cliente y conductor (incluido el servicio de paquetes) +
lo que la web no puede: push completo (§6), GPS en segundo plano con frescura,
chat Realtime unificado con no-leídos, cámara nativa con compresión,
autocompletado de direcciones + pin en mapa, Google Pay, borradores offline.
Backend: puntos 1, 2, 3 (parcial), 5, 10 de §7. Publicación en Play Store
(ficha, política de privacidad — ya existe la página — y revisión de Google).

**Fase 2 — El negocio funciona solo (3-4 semanas)**
Asignación automática con countdown, Stripe Connect (payouts automáticos),
prueba de entrega (foto + firma), caducidades de documentos con bloqueo,
horas extra reales en `final_price`, pedidos programados, facturas PDF.

**Fase 3 — Crecimiento (continuo)**
Propinas, cupones/referidos, OTP SMS, llamada enmascarada, mapa de calor,
seguimiento público para el destinatario de paquetes, multi-ciudad (zonas
configurables desde el admin — hoy el CP está fijado en RPC y formularios),
resumen fiscal del conductor, iOS (el mismo código React Native).

**Regla de decisión** (heredada del plan original): la Fase 1 hace la app
mejor que la web; la Fase 2 hace que el negocio opere sin intervención manual;
la Fase 3 lo hace crecer.

---

## 9. Criterios de éxito de la Fase 1

- El cliente recibe push en todos los cambios de estado sin tener la app abierta.
- La posición del conductor se actualiza con la app en segundo plano y el
  cliente nunca ve una posición de >60 s como si fuera actual.
- Un pedido completo (transporte y paquete) se crea desde la app en <2 minutos.
- Un pago con Google Pay se confirma y verifica en servidor igual que hoy.
- Las suites E2E de la web siguen 64/64 (el backend no se rompe: es compartido).
