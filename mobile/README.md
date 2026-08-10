# ClicyVoy — app Android

App móvil de ClicyVoy (React Native + Expo SDK 57, JavaScript). Es **otro
cliente del mismo backend** que la web: mismo Supabase (`dnehzwrqphqpkcdjwqfi`),
mismas RPCs, mismas Edge Functions y las mismas tarifas editables. No duplica
reglas de negocio.

- Especificación de producto: [`../docs/FUNCIONALIDADES-APP-ANDROID.md`](../docs/FUNCIONALIDADES-APP-ANDROID.md)
- Plan ejecutable por etapas: [`../docs/PLAN-ACCION-APP-ANDROID.md`](../docs/PLAN-ACCION-APP-ANDROID.md)

## Estado

**Etapa 1 (esqueleto) terminada.** Hay sesión persistente, enrutado por rol y
pantallas que ya leen datos reales de producción. El asistente de pedido, el
seguimiento en vivo, el chat, el GPS en segundo plano y el push llegan en las
etapas 2-5.

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
  (conductor)/       pestañas Ofertas · Ganancias · Perfil
components/ui.js     piezas de UI compartidas (Card, Button, Field…)
lib/
  supabase.js        cliente con sesión en SecureStore (partida en trozos)
  auth.js            contexto de sesión y rol
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
  la web. No introducir Google Maps (de pago).

## Comprobar que sigue compilando

```bash
npx expo export --platform android --output-dir /tmp/expo-export
```

Empaqueta todo el JS y falla si hay un import roto. Es la verificación mínima
antes de commitear.
