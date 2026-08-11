# Handoff — App Android ClicyVoy: lo que queda y cómo continuarla

> Escrito el **2026-08-11** para que **otro agente de IA** continúe el trabajo
> sin contexto previo. Léelo entero antes de tocar nada, junto con:
> [PROPUESTA-VS-ESTADO.md](PROPUESTA-VS-ESTADO.md) (contrato vs realidad),
> [PLAN-ACCION-APP-ANDROID.md](PLAN-ACCION-APP-ANDROID.md) (plan original) y
> [SEGUIMIENTO.md](SEGUIMIENTO.md) (historial completo con los porqués).

---

## 1. Estado real: qué está CONSTRUIDO y verificado en un móvil físico

La app (carpeta `mobile/`, Expo SDK 57 + expo-router, JavaScript) está en la
**versión 0.1.3**, instalada y probada en el Xiaomi del usuario. Una sola app,
dos experiencias según `profiles.role`:

**Cliente** ✅: login email+Google (G oficial), asistente con los 4 servicios y
precio en vivo del servidor, autocompletado de direcciones + pin en mapa +
"mi ubicación", fotos comprimidas, borrador local, aviso de duplicado, pedidos
programados, pago con tarjeta/Google Pay (PaymentSheet, claves test),
seguimiento en vivo por Realtime con frescura de posición, chat con fotos y
badges, valoración, propina, recibo PDF en el móvil, incidencias con urgencia,
historial con filtros y repetir pedido.

**Conductor** ✅: ofertas por Realtime con filtro de furgoneta y aceptación
anti-carrera, estados con un botón, cancelación con motivo, navegación Google
Maps/Waze, **GPS en segundo plano** (con refresco de sesión: no muere en
trabajos largos), prueba de entrega foto+firma (obligatoria en paquete/tienda),
documentación completa con cámara y caducidades (aviso ≤15 días, bloqueo
diario por pg_cron), ganancias con gráfico (fórmula de la web), chat, opinión
final.

**Backend** ✅: migraciones 0011 y 0012 APLICADAS en `dnehzwrqphqpkcdjwqfi`;
Edge Functions `send-push`, `create-tip-intent`, `confirm-tip` desplegadas con
`verify_jwt=true` y con el arranque verificado llamándolas.

**Marca** ✅: línea de la landing (morado #7145d6, amarillo #F5B400, Poppins,
botones rounded-full), iconos/splash generados desde el SVG real con
`scripts/generate-app-assets.mjs`. Todo el color sale de `mobile/theme.js`.

## 2. Cuentas y credenciales para trabajar

- **Supabase (PRODUCCIÓN)**: proyecto `dnehzwrqphqpkcdjwqfi`. Se opera por
  Management API con el PAT del negocio (está en la memoria del agente
  anterior y en el historial del chat; si caducó, pedirlo al usuario).
  Scripts listos: `scripts/apply-sql.mjs` (migraciones) y
  `scripts/deploy-function.mjs` (funciones; usa el endpoint multipart — el
  PATCH provoca BOOT_ERROR). **Tras desplegar una función, VERIFICAR llamándola.**
- **Expo/EAS**: cuenta `clicyvoys-team`, proyecto `@clicyvoys-team/clicyvoy`
  (id `1df4daf7-0c6a-401b-94bc-ff0b3fe65493`). Token robot en el historial.
- **Conductor de prueba** (recreado 2026-08-11, login verificado):
  `conductor.test@portemania.es` / `Conductor2026!` — verificado, furgón
  grande, disponible, documentación completa. Borrarlo al acabar las campañas
  (regla de `e2e/README.md`).
- **Admin real**: NO tocar su contraseña (regla histórica; el dueño la gestiona).
- **Stripe**: claves TEST (tarjeta `4242 4242 4242 4242`). Live al lanzar.

## 3. Cómo se entrega el trabajo (aprendido a base de golpes)

1. **Cambios de JavaScript o assets del bundle → OTA, sin APK**:
   `cd mobile && EXPO_TOKEN=... npx eas-cli update --branch preview --message "..."`.
   La app instalada (canal `preview`, runtimeVersion = versión de app) lo
   descarga al reabrirse. Así se corrige un bug en minutos.
2. **Cambios de módulos nativos o de app.json (plugins, iconos, splash,
   permisos) → APK nuevo**: subir `version` en `app.json` y `package.json`,
   `eas build --profile preview --platform android`, y entregar. El móvil del
   usuario ya ACEPTA `adb install -r` (activó "Instalar vía USB"); si volviera
   a bloquear, copiar a `/sdcard/Download/` con
   `MSYS_NO_PATHCONV=1 adb push` y que lo instale tocándolo.
3. **Verificación mínima antes de cualquier entrega**:
   `npx expo export --platform android` (detecta imports rotos) y, si se tocó
   la web, `npm run build` en la raíz. Con el móvil conectado, `adb logcat`
   filtrado por `ReactNativeJS|FATAL EXCEPTION` y `adb shell screencap` para
   ver lo que ve el usuario.
4. **Commit + push tras cada tarea** (auto-deploy de la web en Vercel).
   Actualizar `docs/SEGUIMIENTO.md` al cerrar cada bloque.

## 4. Reglas que NO se negocian

- El precio lo fija `compute_quote` en el servidor. La app solo lo enseña.
- No tocar RLS ni las funciones de pago existentes sin pruebas dedicadas.
- Nada de servicios de pago nuevos: mapas/geocoding gratis (OSM/Photon).
- `driver_profiles` NO tiene `user_id`: usar `fetchMyDriverProfile` (por email).
- Paridad de reglas con la web: si divergen, un pedido válido en un sitio es
  inválido en el otro.
- El arranque de la app NUNCA puede colgarse: todo lo async del camino crítico
  lleva catch/timeout (ver `lib/supabase.js` y `lib/auth.js` — hubo un cuelgue
  real por SecureStore y se arregló así).
- Los colores SOLO en `mobile/theme.js`.

## 5. TAREAS PENDIENTES, en orden recomendado

### T0 — Mejoras UX del conductor "estilo Uber" (feedback directo del cliente)
Especificadas COMPLETAS en **[MEJORAS-UX-CONDUCTOR.md](MEJORAS-UX-CONDUCTOR.md)**:
mapa embebido en el trabajo activo (UX-1), mapa de contexto en la oferta
(UX-2) y pulido visual con la paleta (UX-3). Todo JavaScript → se entrega por
OTA sin APK. **Empezar por aquí**: es lo que el cliente pidió al probar.

### T1 — Push de verdad (bloqueado por Firebase) 🔑
**Qué falta**: solo la credencial. Todo el código existe y `send-push` está
desplegada y verificada.
**Pasos**: el negocio crea proyecto Firebase (gratis) → descargar
`google-services.json` → `cd mobile && eas credentials` (Android → FCM V1 →
subir service account) → rebuild APK → probar la matriz de §6 de
FUNCIONALIDADES-APP-ANDROID.md con dos móviles y la app CERRADA.
**Hecho cuando**: pedido nuevo suena en el móvil del conductor de prueba con
la app cerrada; asignación/estados/chat llegan al cliente.

### T2 — Verificación por SMS (OTP) en el registro 🔑
**Qué falta**: cuenta Twilio Verify del negocio.
**Pasos**: alta en Twilio → en Supabase Auth activar el proveedor Phone con
Twilio Verify → en la app, tras el registro, pantalla de código de 6 dígitos
(`supabase.auth.signInWithOtp({ phone })` + `verifyOtp`) y guardar el teléfono
verificado en `profiles.phone`.
**Hecho cuando**: un alta nueva exige verificar el teléfono antes de pedir.

### T3 — Google login público 🔑
**Qué falta**: publicar la consent screen de Google (está en modo Testing;
tarea del negocio, consola de Google Cloud). Sin código.

### T4 — Tarjetas guardadas (con MUCHO cuidado)
**Qué es**: `create-payment-intent` debe crear/reutilizar un `customer` de
Stripe (guardar `stripe_customer_id` en `profiles`, columna nueva) y devolver
`customer` + `ephemeralKey`; la app los pasa a `initPaymentSheet`.
**Regla**: es LA función que cobra. Probar en test: pagar sin guardar, pagar
guardando, reutilizar guardada, y que el flujo web actual sigue intacto.

### T5 — Recibo por email
Edge Function nueva `send-receipt` (Resend, ya hay API key como secret):
tras `delivered`, enviar al email del cliente un resumen con los mismos datos
que `mobile/lib/receipt.js`. El PDF adjunto es opcional: un email HTML limpio
con la referencia vale para v1.

### T6 — Historial del conductor (paridad web pendiente)
La web tiene `driver/history`; la app no. Pantalla nueva en `(conductor)`:
lista de sus servicios entregados/cancelados (RLS ya lo permite), con fecha,
precio y acceso al detalle. Reusar patrones de `(cliente)/orders.js`.

### T7 — Borrado de cuenta (requisito de Google Play)
RPC `delete_own_account` (migración 0013: borra/anonimiza pedidos propios,
chat, tokens push, perfil y el usuario de auth) + botón con doble confirmación
en Perfil (cliente y conductor).

### T8 — Sentry 🔑 (DSN gratis)
`npx expo install @sentry/react-native` ya está instalado — falta el DSN del
negocio, `Sentry.init` en `app/_layout.js` y probar un error de ejemplo.

### T9 — QA guiada + Play Store
1. Recorrer los criterios de éxito de FUNCIONALIDADES-APP-ANDROID.md §9.
2. Ciclo completo real con dos móviles: cliente pide (tarjeta test) →
   conductor acepta → GPS con pantalla bloqueada → chat con foto → firma →
   valoración → propina → recibo.
3. Play Console (25 USD, cuenta del negocio): ficha, capturas, política de
   privacidad (ya existe en la web), **Data Safety** declarando ubicación en
   segundo plano + vídeo justificativo, build `production` (AAB) y submit.

### T10 — Opcionales acordados como mejoras
Escaneo de bordes de documentos (react-native-vision-camera, módulo nativo),
push al destinatario del paquete (página pública de tracking), multi-ciudad.

## 6. Trampas conocidas (leer antes de pelearse con algo)

- **Expo SDK 57**: `@expo/vector-icons` se instala aparte; el plugin de Stripe
  exige `merchantIdentifier`; el splash es SOLO vía plugin `expo-splash-screen`;
  `.npmrc` con `legacy-peer-deps` es obligatorio.
- **MapLibre v11**: API nueva (`Map`/`Marker`/`GeoJSONSource`/`Camera`).
  `eta.js` devuelve coords `[lat,lng]` (Leaflet); GeoJSON quiere `[lng,lat]`.
- **expo-router**: los grupos usan pantallas CON NOMBRE (`pedir`, `ofertas`);
  jamás recrear un `index` por grupo (rompía la navegación). El deep link
  OAuth entra por `app/auth.js`; `+not-found.js` es la red de seguridad.
- **Subidas a Storage desde RN**: base64 → `decode()` de base64-arraybuffer
  (el Blob de RN no tiene `arrayBuffer()`).
- **Fotos**: comprimir SIEMPRE antes de subir (`ImageManipulator.manipulate`).
- **El móvil del usuario es Xiaomi/MIUI**: cache de iconos del launcher,
  restricciones de instalación, SmartPower matando procesos en el log (ruido,
  no crash).

## 7. Definición de "terminado" (contra la propuesta comercial)

La app se considera entregable al cliente cuando: T1 (push) + T2 (OTP) + T4
(tarjetas) + T7 (borrado) + T9 (QA + Play Store en internal testing) estén
hechas y el ciclo completo con dos móviles funcione. El resto (T5, T6, T8,
T10) son calidad/paridad que pueden entrar por OTA después.
