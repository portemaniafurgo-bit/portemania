# Plan de acción — App Android ClicyVoy (Fase 1)

> Escrito el **2026-08-10**. Este es el **plan ejecutable**: etapas y tareas en
> orden, con archivos concretos y criterios de "hecho". Lo consumen agentes de
> IA que programarán la app.
>
> Documentos hermanos:
> - [FUNCIONALIDADES-APP-ANDROID.md](FUNCIONALIDADES-APP-ANDROID.md) — **qué** debe hacer la app (especificación de producto, 2026-07-15).
> - [PLAN-APP-ANDROID.md](PLAN-APP-ANDROID.md) — por qué React Native + Expo y las 3 fases (2026-07-06).
> - [SEGUIMIENTO.md](SEGUIMIENTO.md) — historial del proyecto.

---

## 0. Instrucciones para el agente ejecutor

1. **Ejecuta las etapas en orden** (0 → 6) y, dentro de cada etapa, las tareas
   en orden. No saltes ni mezcles etapas sin cerrar la anterior.
2. **Paridad = código web ACTUAL, no los ejemplos del doc de julio.** El
   catálogo de servicios creció después de escribir la especificación: hoy hay
   porte (40 €), **mini mudanza (99 € base + extras)**, **portes para tiendas
   (30 €)**, paquetes por tramos (4,99/7,99/9,99 €) y **paquete a Villarrobledo
   (19,99 €)**. La fuente de verdad es `src/lib/services.js` +
   `src/lib/pricing.js` + `app_settings.tariffs` en BD. Igual con la prueba de
   entrega: **la firma del receptor YA existe en la web**
   (`src/lib/deliveryProof.js`, bucket privado `delivery-proofs`) → en la app es
   paridad de Fase 1, no Fase 2.
3. **El backend actual NO se toca** salvo lo listado en la Etapa 0 (y la vista
   de ganancias en T4.7). Prohibido modificar: políticas RLS existentes, la RPC
   `compute_quote` (autoridad del precio, migración 0010), las Edge Functions
   `create-payment-intent` / `confirm-payment` / `send-email` / `invite-user`,
   y cualquier regla de negocio del servidor. La app es *otro cliente* del
   mismo backend.
4. **Cero servicios de pago nuevos.** Mapas, geocodificación y rutas siguen
   siendo gratis (OSM / Nominatim / OSRM, igual que la web — decisión histórica
   del proyecto). Push con Expo Push Service. Nada de Google Maps API.
5. **JavaScript, no TypeScript** (como la web). Textos de UI **en español**,
   mismo tono que la web.
6. **Commit + push tras cada tarea** con mensaje claro (`app: T2.3 fotos con
   compresión`). Si tocas archivos de la web: `npm run build` verde **antes**
   de commitear (cada push a master despliega en Vercel).
7. La app vive en **`mobile/`** dentro de este repo. No muevas ni renombres
   nada de la web.
8. Si algo no cuadra (columna que no existe, RPC con otra firma), **lee la
   migración** correspondiente en `supabase/migrations/` antes de improvisar.
9. Al cerrar cada etapa, añade una entrada en `docs/SEGUIMIENTO.md`.

---

## 1. Decisiones técnicas cerradas (no re-decidir)

| Pieza | Decisión |
|---|---|
| Framework | **Expo** (última SDK estable) + **expo-router** (navegación por archivos, análoga al App Router de Next) |
| Lenguaje | JavaScript (paridad con la web, permite copiar `src/lib/*` casi tal cual) |
| Ubicación | Carpeta `mobile/` en este mismo repo (no afecta al build de Vercel, que usa la raíz) |
| Mapas | **@maplibre/maplibre-react-native** con tiles raster de OSM (sin API keys — snippet en el Apéndice A.4) |
| GPS 2º plano | expo-location + expo-task-manager (foreground service Android) |
| Push | expo-notifications + **Expo Push Service** (usa FCM por debajo; tokens `ExponentPushToken[...]`) |
| Pagos | @stripe/stripe-react-native con **PaymentSheet** (incluye Google Pay); mismas Edge Functions de hoy |
| Sesión | supabase-js con adaptador de storage sobre expo-secure-store (Apéndice A.1) |
| Errores | Sentry (@sentry/react-native vía config plugin de Expo) |
| Build | EAS Build (dev build para desarrollo — la app usa módulos nativos, **Expo Go no sirve**) + EAS Submit |
| Forma | **Una sola app**, dos experiencias según rol de la cuenta (cliente / conductor), como decidió la especificación §1 |

---

## 2. Mapa del backend y del código web (referencia rápida)

- **Supabase**: proyecto `dnehzwrqphqpkcdjwqfi` (cuenta portemaniafurgo, eu-west-2).
- **RPCs clave**: `compute_quote` (precio, autoridad final), `create_guest_request`,
  `get_public_drivers`, `create_driver_application`. Busca el resto con
  `grep -rn "\.rpc(" src`.
- **Edge Functions**: `create-payment-intent`, `confirm-payment`, `send-email`
  (con lista blanca de destinatarios), `invite-user`.
- **Migraciones**: `supabase/migrations/0001…0010`. Las nuevas empiezan en 0011.

Archivos web a **copiar a `mobile/lib/`** (adaptando imports y quitando
cualquier uso de `window`/`document`; son lógica pura casi todos):

| Archivo | Qué es |
|---|---|
| `src/lib/services.js` | Catálogo de servicios (fuente de verdad) |
| `src/lib/pricing.js` | Motor de precios isomorfo (el servidor manda igualmente) |
| `src/lib/tariffs.js` | Lectura de tarifas de `app_settings` |
| `src/lib/zones.js` | Zona de servicio (CP 02001–02008) |
| `src/lib/eta.js` | Geocodificación + rutas OSRM + ETA |
| `src/lib/requestIntent.js` | Intención de pedido (anti-duplicado) |
| `src/lib/deliveryProof.js` | Firma de entrega (bucket privado + signed URLs) |

Pantallas web de referencia por funcionalidad (léelas antes de rehacer cada una):

| Funcionalidad | Archivo web |
|---|---|
| Asistente de pedido | `src/components/request/useRequestForm.js` (+ componentes en `src/components/request/`) |
| Pago con tarjeta | `src/app/(app)/payment/[id]/page.jsx` |
| Seguimiento del cliente | `src/app/(app)/order/[id]/page.jsx` |
| Trabajo del conductor (GPS, estados, firma) | `src/app/(app)/driver/job/[id]/page.jsx` |
| Incidencias | `src/components/common/ReportIncidentButton.jsx` |
| Redirección por rol tras login | `src/lib/postLogin.js` + `src/lib/AuthContext.jsx` |
| Ganancias/Finanzas admin (para cuadrar T4.7) | `src/app/(app)/admin/` |

---

## 3. Etapas y tareas

### Etapa 0 — Backend y fixes web previos (~3-5 días)

> Todo lo de esta etapa beneficia también a la web y se puede desplegar ya.

- **T0.1 — Migración `0011_app_android_base.sql`**
  - `alter table driver_profiles add column location_updated_at timestamptz;`
  - Tabla `push_tokens`: `id uuid pk`, `user_id uuid not null references auth.users on delete cascade`,
    `token text not null unique`, `platform text not null default 'android'`,
    `device_name text`, `updated_at timestamptz default now()`.
  - RLS: cada usuario inserta/actualiza/borra **solo** sus filas; nadie hace
    `select` de tokens ajenos (las funciones con service role no pasan por RLS).
  - *Hecho cuando*: migración aplicada en `dnehzwrqphqpkcdjwqfi` y el archivo
    versionado en `supabase/migrations/`.
- **T0.2 — Edge Function `send-push`** (espejo de `send-email`; Apéndice A.3)
  - Entrada: `{ user_ids?: string[], mode: string, order_id?: string, title, body, data? }`.
  - Con service role lee los tokens de esos usuarios y hace POST a
    `https://exp.host/--/api/v2/push/send` (lotes de ≤100).
  - **Misma filosofía de lista blanca que `send-email`**: valida el `mode` y
    que los destinatarios correspondan al pedido/rol — nadie puede usarla de spam.
  - Borra de `push_tokens` los tokens que devuelvan `DeviceNotRegistered`.
- **T0.3 — Web: frescura del GPS (escritura)** — en
  `src/app/(app)/driver/job/[id]/page.jsx`, el update que escribe
  `current_lat/current_lng` escribe también `location_updated_at: new Date().toISOString()`.
- **T0.4 — Web: frescura del GPS (lectura)** — en
  `src/app/(app)/order/[id]/page.jsx`, junto al mapa: "En vivo" si la posición
  tiene <60 s; si no, "última posición hace X min".
- **T0.5 — Web: `priority` al crear incidencia** — en
  `src/components/common/ReportIncidentButton.jsx`, fijar `priority` al insertar
  (selector simple o por defecto "media"; hoy se crea sin prioridad).

*Cierre de etapa*: `npm run build` verde, commit + push, comprobar deploy.

### Etapa 1 — Esqueleto de la app (~1 semana)

- **T1.1** — `npx create-expo-app@latest mobile` (plantilla con expo-router, en JS).
  Android package: `com.clicyvoy.app`. Nombre visible: **ClicyVoy**.
- **T1.2** — Instalar (con `npx expo install` cuando sea módulo Expo):
  `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `expo-secure-store`, `expo-location`, `expo-task-manager`,
  `expo-notifications`, `expo-image-picker`, `expo-image-manipulator`,
  `@stripe/stripe-react-native`, `@maplibre/maplibre-react-native`,
  `@sentry/react-native`, `date-fns`, `zod`.
- **T1.3** — `mobile/lib/supabase.js` con sesión persistente en SecureStore
  (Apéndice A.1). Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (los mismos valores que usa la web, están en Vercel/`.env.local`).
- **T1.4** — Copiar los archivos de la tabla de §2 a `mobile/lib/`.
- **T1.5** — Rutas expo-router:
  - `app/(auth)/` → login, registro, recuperar contraseña (email+contraseña y Google).
  - `app/(cliente)/` → tabs: **Pedir** · **Mis pedidos** · **Perfil**.
  - `app/(conductor)/` → tabs: **Ofertas** · **Trabajo** · **Ganancias** · **Perfil**.
  - Guard raíz que replica `postLogin.js`: según el rol, entra a un grupo u otro.
- **T1.6** — `mobile/theme.js` con los colores/tipografías de la web
  (extraer de `src/app/globals.css` y `tailwind.config.js`).
- **T1.7** — Sentry inicializado y probado (error de prueba visible en el panel).

*Hecho cuando*: dev build de EAS instalada en un Android real; login contra el
Supabase de producción funciona y redirige por rol; sesión sobrevive a cerrar
la app.

### Etapa 2 — Cliente: pedir servicio (~1,5 semanas)

- **T2.1** — Asistente por pasos con **todos** los servicios actuales
  (paridad con `useRequestForm.js`): campos, validaciones zod y textos.
- **T2.2** — Direcciones: autocompletado con el geocodificador gratuito que ya
  usa la web (ver `eta.js`) + mapa MapLibre con **pin arrastrable** + botón
  "usar mi ubicación" (permiso foreground). El CP se sigue validando en servidor.
- **T2.3** — Fotos de la carga: expo-image-picker (cámara y galería,
  multi-captura) + **compresión** con expo-image-manipulator (lado mayor
  ≤1600 px, JPEG calidad 0.7) antes de subir al mismo bucket que la web.
- **T2.4** — Precio: cálculo local en vivo con `pricing.js` (informativo) y al
  confirmar **el mismo flujo servidor que la web con sesión** (el importe lo
  fija `compute_quote` — replica exactamente las llamadas de la web).
- **T2.5** — Aviso anti-duplicado (paridad con `requestIntent.js`).
- **T2.6** — Pago: efectivo (por defecto) y tarjeta con PaymentSheet —
  `create-payment-intent` → PaymentSheet con Google Pay habilitado →
  `confirm-payment`. Claves test de Stripe, como hoy.
- **T2.7** — Borrador local: el estado del asistente se persiste en
  AsyncStorage a cada paso; al reabrir, ofrece continuar o empezar de cero.

*Hecho cuando*: un pedido de **cada** servicio creado desde el móvil aparece en
el admin web con el precio correcto, y un pago test con tarjeta queda
confirmado y verificado igual que desde la web.

### Etapa 3 — Cliente: seguimiento, chat e historial (~1,5 semanas)

- **T3.1** — Pantalla de pedido: timeline de estados con timestamps reales +
  ficha del conductor (foto, valoración, fotos del vehículo, llamada directa).
- **T3.2** — Mapa en vivo: **suscripción Realtime** a la posición del conductor
  (nada de polling) + ruta por carretera y ETA (`eta.js`) + **indicador de
  frescura** ("En vivo" / "hace X min", usando `location_updated_at`).
- **T3.3** — Chat: Realtime (ya montado en la web para el cliente) + **envío de
  fotos** comprimidas (subir al bucket y referenciar en el mensaje) + contador
  de no leídos. Tras la entrega, solo lectura.
- **T3.4** — Historial con filtros (activos/entregados/cancelados), detalle,
  valoración con estrellas + reseña, reportar incidencia (con `priority`),
  cancelación solo en pendiente (regla actual).
- **T3.5** — Los push del cliente de la matriz §6 de la especificación se
  integran aquí (el disparo se construye en la Etapa 5; deja los puntos de
  llamada preparados).

*Hecho cuando*: con un conductor emitiendo posición (web o app), el cliente ve
el marcador moverse sin refrescar y el indicador pasa a "hace X min" si el
emisor se detiene.

### Etapa 4 — Conductor (~2 semanas)

- **T4.1** — Ofertas: lista de pendientes compatibles con su furgoneta
  (paridad de reglas con la web) vía **Realtime** en vez de polling; detalle
  completo antes de aceptar; aceptación con el **flujo condicionado
  anti-carrera existente** (no lo reinventes — míralo en el código web).
- **T4.2** — Toggle **Disponible / No disponible** (además condicionará el push
  de ofertas en la Etapa 5).
- **T4.3** — Trabajo activo: avance de estados con un botón (Iniciar viaje →
  He llegado → Finalizado) y cancelación con motivo solo antes de recoger
  (paridad exacta; al cancelar vuelve a pendientes y avisa a la empresa).
- **T4.4** — **GPS en segundo plano** (la tarea estrella; Apéndice A.2):
  `startLocationUpdatesAsync` + TaskManager, **solo mientras hay trabajo
  activo**; escribe `current_lat/current_lng/location_updated_at` cada ~10 s o
  25 m; notificación persistente (foreground service, obligatoria en Android);
  se detiene al finalizar, cancelar o pasar a No disponible. Pide el permiso
  "Permitir siempre" con una pantalla explicativa previa (requisito de Google
  Play para background location).
- **T4.5** — Deep links a Google Maps / Waze para navegar (paridad).
- **T4.6** — Chat del conductor por **Realtime** (sustituye el polling de 3 s
  de la web) + fotos + no leídos.
- **T4.7** — Ganancias: nueva **vista/RPC de solo lectura** en BD (migración
  `0012_driver_earnings.sql`) que cuadre con Finanzas del admin; pantalla
  hoy/semana/mes con gráfico de 7 días.
- **T4.8** — Perfil documental: ver estado de cada documento y **re-subir** con
  cámara + compresión (bucket privado + signed URLs, igual que la web).
- **T4.9** — **Prueba de entrega — paridad**: la firma del receptor ya existe
  en la web (`deliveryProof.js` + `driver/job/[id]`); replicarla en la app con
  lienzo de firma nativo. Si la web hace foto de entrega, replicarla también.

*Hecho cuando*: un servicio completo (aceptar → navegar con Google Maps →
estados → firma → finalizar) se hace desde la app **con la pantalla bloqueada
parte del trayecto** y el cliente ve la posición fresca todo el tiempo.

### Etapa 5 — Push de punta a punta (~1 semana; solapa con 3-4)

- **T5.1** — Registro del token: al iniciar sesión (y en cada arranque) pedir
  permiso, obtener el Expo push token y hacer upsert en `push_tokens`;
  borrarlo al cerrar sesión.
- **T5.2** — Disparos: replicar el patrón de `send-email`
  (`supabase.functions.invoke` en cada evento — ver
  `src/components/request/useRequestForm.js:286` como ejemplo) añadiendo
  `send-push` en los mismos puntos, hasta cubrir la **matriz completa de §6**
  de la especificación (publicado→conductores compatibles, asignado→cliente,
  llegando <100 m→cliente, recogido/entregado→cliente, chat→ambos,
  cancelación→cliente y admin).
- **T5.3** — Canales Android: canal "Ofertas" con sonido propio (conductor) y
  canal "Estado" por defecto.
- **T5.4** — Tocar la notificación abre la pantalla del pedido correspondiente
  (deep link interno con expo-router).
- **T5.5** — Badges de no leídos del chat alimentados por push + Realtime.

*Hecho cuando*: con dos móviles (cliente y conductor) y la app **cerrada**,
cada evento de la matriz produce su push.

### Etapa 6 — QA, resiliencia y Play Store (~1 semana + revisión de Google)

- **T6.1** — QA con los criterios de éxito de §4 en dispositivos reales; las
  suites E2E de la web siguen verdes (última referencia: **72/72** tras el
  rediseño de 2026-08-08) — el backend compartido no se rompe.
- **T6.2** — Resiliencia: cola de reintentos con backoff para mensajes de chat
  y cambios de estado si falla la red; borradores ya cubiertos (T2.7).
- **T6.3** — Rendimiento: listas largas con FlatList, caché de imágenes,
  revisar consumo del GPS.
- **T6.4** — Play Store: cuenta de Google Play (la crea el usuario, 25 USD única
  vez), ficha (título, descripciones, capturas), política de privacidad (ya
  existe la página web — enlazarla), **formulario Data Safety** (la ubicación en
  segundo plano exige declaración y vídeo justificativo — prepararlos), build
  AAB con EAS Build y subida con EAS Submit. Revisión de Google ≈1 semana.
- **T6.5** — **Borrado de cuenta desde la app** (requisito de Google Play):
  pantalla en Perfil + RPC `delete_own_account` (migración
  `0013_delete_own_account.sql`) que borra/anonimiza los datos del usuario.

*Hecho cuando*: app publicada al menos en **internal testing** con los
criterios de éxito cumplidos.

---

## 4. Criterios de éxito de la Fase 1

1. El cliente recibe push en todos los cambios de estado **sin la app abierta**.
2. La posición del conductor se actualiza con su app en segundo plano y el
   cliente **nunca** ve una posición de >60 s presentada como actual.
3. Un pedido completo (cualquier servicio) se crea desde la app en <2 minutos.
4. Un pago con Google Pay se confirma y **verifica en servidor** igual que hoy.
5. Las suites E2E de la web siguen verdes (72/72) — el backend compartido no se
   ha roto.

---

## 5. Lo que NO entra en la Fase 1 (no programar aunque tiente)

- **Fase 2**: asignación automática con countdown, Stripe Connect (payouts),
  caducidades de documentos con bloqueo, horas extra reales en `final_price`,
  pedidos programados, facturas PDF, consolidar `workers`/`drivers`, claves
  Stripe live.
- **Fase 3**: propinas, cupones/referidos, OTP por SMS, llamada enmascarada,
  mapa de calor, seguimiento público del destinatario de paquetes,
  multi-ciudad, resumen fiscal del conductor, iOS.

(La prueba de entrega ya NO está aquí: ver T4.9 — es paridad.)

---

## 6. Bloqueos externos — lo que debe aportar el usuario

Pídelos **al empezar la etapa que los necesita**, no antes:

| Cuándo | Qué | Para qué |
|---|---|---|
| Etapa 1 | Cuenta **Expo/EAS** (gratuita) | Dev builds y builds firmados |
| Etapa 5 | Proyecto **Firebase** (gratuito) + `google-services.json` + service account subido con `eas credentials` | FCM (transporte del push en Android) |
| Etapa 1 | DSN de **Sentry** (plan gratuito) | Crash reporting |
| Etapa 2 | Publishable key **test** de Stripe (ya existe en la web) | PaymentSheet |
| Etapa 6 | Cuenta **Google Play Console** (25 USD, única vez) | Publicar |

---

## 7. Estimación

Suma de etapas: **6–8 semanas** de calendario para la Fase 1 (las etapas 3-5 se
solapan parcialmente), más ~1 semana de revisión de Google. Coherente con las
4-6 semanas del plan original + margen de publicación.

---

## Apéndice A — Snippets de arranque (usar como base, no como dogma)

### A.1 Cliente Supabase con sesión en SecureStore (`mobile/lib/supabase.js`)

```js
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

### A.2 GPS en segundo plano (conductor, solo con trabajo activo)

```js
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

const TASK = "clicyvoy-driver-location";

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const { latitude, longitude } = data.locations.at(-1).coords;
  await supabase
    .from("driver_profiles")
    .update({
      current_lat: latitude,
      current_lng: longitude,
      location_updated_at: new Date().toISOString(),
    })
    .eq("user_id", (await supabase.auth.getUser()).data.user.id);
});

export async function startTracking() {
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,
    distanceInterval: 25,
    foregroundService: {
      notificationTitle: "ClicyVoy — servicio en curso",
      notificationBody: "Compartiendo tu posición con el cliente",
    },
  });
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK)) {
    await Location.stopLocationUpdatesAsync(TASK);
  }
}
```

### A.3 Esqueleto de la Edge Function `send-push`

```ts
// supabase/functions/send-push/index.ts — espejo de send-email
// 1) valida mode + destinatarios (lista blanca, como send-email)
// 2) lee push_tokens de esos user_ids con service role
// 3) envía en lotes de 100:
const messages = tokens.map((t) => ({
  to: t.token,
  title,
  body,
  data, // p. ej. { order_id } para el deep link
  channelId: mode === "new_request" ? "ofertas" : "estado",
}));
await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(messages),
});
// 4) si la respuesta trae DeviceNotRegistered → delete de ese token
```

### A.4 Mapa MapLibre con tiles OSM (sin API key)

```js
import MapLibreGL from "@maplibre/maplibre-react-native";

MapLibreGL.setAccessToken(null);

export const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
// <MapLibreGL.MapView styleJSON={JSON.stringify(OSM_STYLE)} ... />
```

### A.5 Registro del push token

```js
import * as Notifications from "expo-notifications";

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;
  const projectId = /* de app.json → extra.eas.projectId */;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.from("push_tokens").upsert(
    { user_id: userId, token, platform: "android" },
    { onConflict: "token" }
  );
  return token;
}
```
