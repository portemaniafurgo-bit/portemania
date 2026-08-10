# ClicyVoy — app Android

App móvil de ClicyVoy (React Native + Expo SDK 57, JavaScript). Es **otro
cliente del mismo backend** que la web: mismo Supabase (`dnehzwrqphqpkcdjwqfi`),
mismas RPCs, mismas Edge Functions y las mismas tarifas editables. No duplica
reglas de negocio.

- Especificación de producto: [`../docs/FUNCIONALIDADES-APP-ANDROID.md`](../docs/FUNCIONALIDADES-APP-ANDROID.md)
- Plan ejecutable por etapas: [`../docs/PLAN-ACCION-APP-ANDROID.md`](../docs/PLAN-ACCION-APP-ANDROID.md)

## Estado

**Etapas 1 a 5 construidas.** Funciona el ciclo completo: el cliente pide
(4 servicios, fotos, precio en vivo), sigue al conductor en el mapa y chatea;
el conductor recibe ofertas, las acepta, avanza estados y **emite posición con
el móvil bloqueado**.

El pago con tarjeta y Google Pay funciona con PaymentSheet contra las mismas
Edge Functions que la web (claves de prueba).

Pendiente: ganancias del conductor (T4.7, necesita una vista en BD para que
cuadre con Finanzas del admin), subida de documentos con cámara (T4.8), firma de
entrega (T4.9), Sentry y la publicación en Play Store (Etapa 6).

⚠️ **Añadir un módulo nativo obliga a regenerar la development build**: el APK
que ya esté instalado no lo incluye y la app casca al usarlo. Los cambios de
JavaScript, en cambio, se recargan solos.

⚠️ **El push está inerte** hasta que se aplique la migración `0011` y se
despliegue `send-push`. Sin la tabla `push_tokens` el registro falla en silencio
y la app sigue avisando solo por email. Y sin la columna `location_updated_at`,
la escritura de posición del conductor falla: **eso apaga el seguimiento en
vivo**, así que es el primer paso pendiente.

## Arrancar

```bash
cd mobile
npm install
npx expo start --dev-client
```

⚠️ **Expo Go no sirve.** La app usa módulos nativos (ubicación en segundo plano,
notificaciones, Stripe, MapLibre), así que hace falta una *development build*:

```bash
npx eas login          # cuenta Expo del negocio
npx eas build --profile development --platform android
```

Se instala el APK resultante en el móvil y a partir de ahí `npx expo start
--dev-client` recarga el JS al vuelo.

## Estructura

```
app/                 rutas (expo-router, navegación por ficheros)
  _layout.js         guardia de sesión: decide grupo según el rol
  (auth)/            login, registro, recuperar contraseña
  (cliente)/         pestañas Pedir · Mis pedidos · Perfil
    index.js         asistente de pedido (5 pasos)
    order/[id].js    seguimiento en vivo, chat, valoración e incidencias
  (conductor)/       pestañas Ofertas · Ganancias · Perfil
    index.js         ofertas y aceptación anti-carrera
    job/[id].js      trabajo activo: estados, navegación, chat
components/          ui.js, wizard.js, AddressField, TrackingMap, ReportIncident
lib/
  supabase.js        cliente con sesión en SecureStore (partida en trozos)
  auth.js            contexto de sesión y rol
  useRequestForm.js  estado, validación y envío del pedido
  orders.js          pedido, posición y chat EN TIEMPO REAL
  tracking.js        GPS en segundo plano del conductor
  push.js            registro del token y apertura por notificación
  photos.js          cámara/galería con compresión antes de subir
  addresses.js       autocompletado y "usar mi ubicación"
  driverProfile.js   lookup del perfil de conductor POR EMAIL (ver aviso abajo)
  services.js        catálogo de servicios      ─┐
  pricing.js         motor de precios            ├─ copiados de src/lib de la web:
  tariffs.js         tarifas vivas de la BD      │  si cambias una regla allí,
  zones.js           zona de servicio (CP)       │  cámbiala también aquí
  eta.js             geocodificación y rutas    ─┘
theme.js             colores y tipografías de la web, en hex
```

## Cosas que hay que saber antes de tocar nada

- **El precio lo fija el servidor.** `pricing.js` solo sirve para enseñarlo en
  vivo; el importe que se cobra sale de `compute_quote` en Supabase.
- **`driver_profiles` no tiene `user_id`.** Usa siempre `fetchMyDriverProfile()`
  (busca por email de login): filtrar por `created_by_id` hacía que un
  admin-conductor viese el perfil de otra persona (bug real de julio 2026).
- **`.npmrc` fija `legacy-peer-deps`**: expo-router arrastra dependencias web
  que piden una versión de react distinta a la del SDK. Sin eso, `npm install`
  falla.
- **Mapas gratis**: MapLibre con tiles de OpenStreetMap, sin API keys, igual que
  la web. No introducir Google Maps (de pago). Ojo: **MapLibre v11 cambió la API
  entera** — es `Map`/`Marker`/`GeoJSONSource`, no `MapView`/`PointAnnotation`.
- **Orden de las coordenadas**: `eta.js` las devuelve como `[lat, lng]` porque la
  web usa Leaflet; GeoJSON y MapLibre las quieren como `[lng, lat]`.
- **Nada de sondeos.** El estado, la posición y el chat van por Realtime. Si
  añades una pantalla viva, suscríbete; no pongas un `setInterval`.

## Comprobar que sigue compilando

```bash
npx expo export --platform android --output-dir /tmp/expo-export
```

Empaqueta todo el JS y falla si hay un import roto. Es la verificación mínima
antes de commitear.
