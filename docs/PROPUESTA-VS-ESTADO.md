# Propuesta al cliente vs. estado real — App Android ClicyVoy

> Actualizado el **2026-08-11**. Coteja, punto por punto, la propuesta comercial
> aceptada (Rediseño Web + App Android Cliente/Conductor) con lo construido.
> Es el documento de control para las entregas ligadas a los pagos.

Leyenda: ✅ hecho · 🔶 hecho con matices · ⏳ pendiente · 🔑 bloqueado por una
credencial o servicio que debe aportar el negocio.

## 2.1 Rediseño Web — ✅ ENTREGADO

Desplegado en producción el 2026-08-08 (clicyvoy.es, E2E 72/72). Fuera del
alcance de este documento.

## 2.2 App Android Cliente

| Propuesta | Estado | Detalle |
|---|---|---|
| Registro con email | ✅ | Con detección de email ya registrado |
| Registro con Google | 🔶 | Botón "Continuar con Google" construido. ⚠️ La consent screen de Google del negocio sigue en modo *Testing*: solo entran los test users dados de alta. **Publicarla es tarea del negocio** (pendiente histórico del rebrand) |
| OTP por SMS (verificación de teléfono) | 🔑 | Necesita cuenta **Twilio Verify** (~0,05 €/SMS). Sin esa alta no se puede construir |
| Autocompletado de direcciones | ✅ | Con Photon/OSM (gratis) en vez de Mapbox/Google — ver «Desviaciones» |
| Pin en mapa | ✅ | Patrón Uber: pin fijo al centro, se arrastra el mapa, geocodificación inversa al confirmar |
| "Usar mi ubicación" | ✅ | Con explicación si se deniega el permiso |
| Cámara nativa con compresión y multi-captura | ✅ | 1600 px · JPEG 0.7 antes de subir |
| Borradores offline | 🔶 | AsyncStorage en vez de WatermelonDB — ver «Desviaciones». El pedido a medias se recupera al volver |
| Seguimiento en vivo (Realtime + ETA OSRM + frescura) | ✅ | Sin sondeos; indicador "en vivo" / "hace X min" |
| Push FCM en todos los cambios de estado | 🔑 | Todo construido y la Edge Function `send-push` desplegada y verificada. **Falta el proyecto Firebase** (gratuito): sin `google-services.json` Android no entrega notificaciones |
| Chat: mensajería | ✅ | Realtime en ambos lados |
| Chat: fotos comprimidas | ✅ | En app (cámara/galería + compresión) y pintadas también en la web. Columna `image_url` aplicada (migración 0012) |
| Chat: badges de no leídos | ✅ | Contador por pedido en «Mis pedidos» |
| Chat: sonido/vibración | ✅ | Canales Android (las ofertas con sonido propio) — efectivo cuando haya FCM |
| Pagos: Stripe nativo con Google Pay | ✅ | PaymentSheet contra las MISMAS Edge Functions (el servidor recalcula el importe y verifica el cargo). Claves test |
| Pagos: tarjetas guardadas | ⏳ | PaymentSheet lo soporta, pero exige crear el *customer* de Stripe en `create-payment-intent`. Se hará con pruebas dedicadas: es la función que cobra |
| Valoración con estrellas | ✅ | La media la recalcula el trigger de la BD |
| Propina al conductor | ✅ | Cargo Stripe aparte (funciones `create-tip-intent`/`confirm-tip` desplegadas y verificadas); 0,50–20 €, un intento por pedido, 100% para el conductor |
| Recibo/factura PDF | ✅ | PDF en el móvil (expo-print) + envío por email (Edge Function send-receipt, verificada; solo al dueño del pedido entregado) |
| Historial con filtros | ✅ | Activos / Entregados / Cancelados |
| Repetir pedido con un toque | ✅ | Rellena el asistente; el precio lo fija el servidor de nuevo |
| Pedidos programados | ✅ | Día/hora en el asistente; nacen como 'scheduled' (política RLS ampliada solo a fecha futura) y un job pg_cron los publica cada minuto |

## 2.3 App Android Conductor

| Propuesta | Estado | Detalle |
|---|---|---|
| Verificación documental (selfie, carnet, DNI, seguro, autónomo, vehículo) | ✅ | Los 10 documentos con cámara/galería y compresión; sensibles al bucket privado con signed URLs |
| Escaneo de bordes del documento | 🔶 | Se sube la foto comprimida sin recorte automático de bordes (necesitaría vision-camera; ver «Desviaciones») |
| Caducidad inteligente | 🔶 | Fechas por documento en la app, avisos visuales (≤15 días) y job pg_cron diario que bloquea el reparto al vencer. El push de aviso llegará con Firebase |
| Toggle Disponible/No disponible | ✅ | Además apaga el GPS y condiciona el push de ofertas |
| Ofertas por push con sonido distintivo | 🔑 | Construido (canal "Ofertas" propio); efectivo cuando haya Firebase |
| GPS background con foreground service, solo en trabajo activo | ✅ | expo-location + TaskManager; escribe `location_updated_at`; se apaga al terminar/cancelar/desconectarse |
| Navegación Google Maps/Waze sin perder tracking | ✅ | Deep links; el GPS sigue en segundo plano |
| Prueba de entrega: foto + firma digital | ✅ | Firma en pantalla + foto; obligatoria en paquetes/tienda, opcional en portes; bucket privado |
| Avance de estados con botones grandes | ✅ | Y cancelación con motivo solo antes de recoger |
| Panel de ganancias con gráficos | ✅ | Misma fórmula que la web (comisión editable por el admin); gráfico de 7 días |
| Chat con cliente Realtime + push | ✅ | Push efectivo cuando haya Firebase |

## Desviaciones deliberadas respecto al stack de la propuesta

Todas abaratan la operación o simplifican el mantenimiento sin recortar
funcionalidad visible; se documentan para que el negocio las conozca:

1. **Mapas: MapLibre + OpenStreetMap en vez de Mapbox/Google.** La propuesta
   estimaba **150-250 €/mes** de Google Maps API; con OSM el coste es **0 €**.
   Es además la decisión histórica del proyecto web (Leaflet + OSM).
2. **Borradores: AsyncStorage en vez de WatermelonDB.** WatermelonDB es una
   base de datos reactiva pensada para miles de filas sincronizadas; para
   guardar un formulario a medias es sobre-ingeniería. Menos dependencias
   nativas = builds más simples.
3. **Cámara: expo-image-picker en vez de react-native-vision-camera.** Cubre
   multi-captura y compresión. Vision-camera aportaría el escaneo de bordes de
   documentos; se puede añadir después si el negocio lo quiere.
4. **JavaScript en vez de TypeScript.** Todo el código web existente es JS; así
   la lógica (precios, zonas, ETA) se comparte tal cual entre web y app.
5. **Expo SDK 57 en vez de 52.** La propuesta se escribió con el SDK de
   entonces; se construye con el estable actual.

## Lo que el negocio debe aportar (bloqueos externos)

| Qué | Para qué | Coste |
|---|---|---|
| Proyecto **Firebase** + `google-services.json` subido con `eas credentials` | Sin esto Android NO entrega push, aunque el backend ya los envíe | 0 € |
| Publicar la **consent screen de Google** (salir de modo Testing) | Login con Google para cualquier usuario | 0 € |
| Cuenta **Twilio Verify** | OTP por SMS del onboarding | ~25 €/mes est. |
| Cuenta **Google Play Console** | Publicar la app | 25 $ una vez |
| DSN de **Sentry** | Crash reporting en producción | 0 € (plan free) |

## Trabajo restante (sin contar bloqueos externos)

La migración 0012 está **aplicada** y las funciones de propina **desplegadas y
verificadas** (2026-08-11). Queda:

1. Tarjetas guardadas (customer de Stripe en `create-payment-intent`) — con
   pruebas dedicadas: es la función que cobra.
2. Envío del recibo por email (el PDF en el móvil ya funciona).
3. Escaneo de bordes de documentos (si el negocio lo quiere: vision-camera).
4. QA en dispositivos reales y checklist de Play Store (Data Safety + vídeo de
   ubicación en segundo plano).
5. Cuando haya Firebase: probar la matriz de push completa con dos móviles.

**Nota de diseño (2026-08-11):** la app usa la línea gráfica de la landing
actual — morado `#7145d6` (pressed `#5a35b0`), amarillo de marca `#F5B400`,
negro `#1a1b20`, botones redondeados. Todo sale de `mobile/theme.js`: ninguna
pantalla lleva colores en duro.
