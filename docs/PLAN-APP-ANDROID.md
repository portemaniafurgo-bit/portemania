# Plan: de MVP web a app Android real (ClicyVoy)

> Escrito el 2026-07-06. Complementa a `SEGUIMIENTO.md`.
> Objetivo: tras validar el negocio con la web, construir la app móvil.

## Tecnología elegida

**React Native + Expo.** Motivos:

- La web actual ya es React + JavaScript + Supabase → se **reutiliza la lógica casi
  entera** (tarifas, ETA, geocodificación, cliente Supabase, Stripe) y **todo el
  backend sin tocar nada**. La app es simplemente otro cliente del mismo Supabase.
- Una sola base de código produce **Android e iOS**.
- Expo resuelve lo difícil de una app de transporte: GPS en segundo plano,
  notificaciones push, mapas, builds firmados para Play Store sin Mac ni Android
  Studio, y actualizaciones OTA (corregir bugs sin pasar por revisión de Google).

Descartados: Flutter (Dart: se tira el conocimiento del código actual) y Kotlin
nativo (solo Android, el más caro de mantener; innecesario aquí).

**La web no muere**: queda como captación SEO (blog, landing, solicitud como
invitado) y como **panel de administración** (el admin no necesita app).

Stack móvil concreto:

| Pieza | Herramienta |
|---|---|
| Mapas | react-native-maps o MapLibre |
| GPS en segundo plano (conductor) | expo-location |
| Push | expo-notifications + FCM |
| Pagos nativos (tarjeta + Google Pay) | @stripe/stripe-react-native |
| Posición en vivo y chat | Supabase Realtime |
| Build y publicación | EAS Build / EAS Submit |
| Errores en producción | Sentry |

## Cuadro de funcionalidades para salir del MVP

Leyenda: ✅ ya existe en la web · 🔶 a medias · ❌ nuevo

### App Cliente

| Funcionalidad | Hoy | Producto real |
|---|---|---|
| Pedir porte con fotos, CP, fecha | ✅ | Igual, UI nativa |
| Precio cerrado pequeña/grande + ayuda | ✅ | 🔶 Precio por distancia/tiempo real (base + €/km vía OSRM) |
| Seguimiento en vivo del conductor en el mapa | ❌ | Realtime + GPS background; LA funcionalidad que justifica la app |
| Notificaciones push (aceptado/en camino/llegó/entregado) | ❌ (solo email) | FCM; email de respaldo |
| Registro/login con teléfono (OTP SMS) | ❌ (email) | Supabase Auth + Twilio |
| Métodos de pago guardados, Google Pay | 🔶 (tarjeta test) | Stripe nativo, pago al finalizar |
| Programar portes + recordatorio | 🔶 | Selector nativo + push |
| Historial + factura PDF | 🔶 | Factura automática por porte |
| Chat con el conductor | ✅ | Igual + push al llegar mensaje |
| Valorar al conductor | ✅ | Igual |
| Propina post-servicio | ❌ | Pantalla tras valorar (Stripe) |
| Códigos promo / referidos | ❌ | Motor de cupones |
| Cancelación con política (gratis hasta X min) | 🔶 | Reglas + posible cargo |

### App Conductor

| Funcionalidad | Hoy | Producto real |
|---|---|---|
| Ver pendientes y aceptar | ✅ | 🔶 Asignación automática al más cercano compatible, countdown 30s, pasa al siguiente |
| Modo conectado/desconectado | ❌ | Solo recibes ofertas conectado |
| GPS en segundo plano con trabajo activo | ❌ | Alimenta el tracking del cliente |
| Navegación (Google Maps/Waze) | ✅ | Deep links nativos |
| Cancelar con motivo / feedback post-entrega | ✅ | Igual |
| Panel de ganancias (hoy/semana/mes) | ❌ | Pantalla principal del conductor |
| Cobro automático de liquidaciones | ❌ (CSV manual) | Stripe Connect: comisión se separa sola, payout semanal automático |
| Documentación con caducidades | 🔶 (subida + re-subida hecha en web) | Estados (pendiente/aprobado/caducado) con **fecha de caducidad** y bloqueo automático al vencer + aviso push 15 días antes |
| Prueba de entrega (foto + firma) | ❌ | Protege ante disputas |
| Mapa de calor de demanda | ❌ | Con los datos de stats existentes |

Documentos del conductor (lista completa): selfie, carnet de conducir, documento
de identidad, seguro del vehículo, **recibo de autónomo**, **situación censal
(Hacienda)**, 4 fotos del vehículo, marca y matrícula. Todos re-subibles cuando
caducan (ya operativo en la web desde 2026-07-06).

### Plataforma / Operación

| Funcionalidad | Hoy | Producto real |
|---|---|---|
| Matching por tamaño de furgoneta | ✅ | + proximidad, valoración, tasa de aceptación |
| Multi-ciudad (hoy CP 02001–02008) | ❌ | Zonas configurables desde admin |
| Stripe en modo test | 🔶 | Claves live + webhooks |
| Verificación telefónica antifraude | ❌ | OTP SMS lo cubre en gran parte |
| Analítica de producto (embudos) | ❌ | PostHog o similar |
| Crash reporting | ❌ | Sentry |
| Publicación Play Store | ❌ | Ficha + política de privacidad (ya existe página) + revisión Google (~1 semana) |

## Orden de ejecución

1. **Fase 1 — La app existe (4-6 semanas):** React Native con paridad del MVP web
   + lo que la web no puede dar: push, GPS background, tracking en vivo.
   Cliente y conductor en una sola app según rol. Play Store.
2. **Fase 2 — Funciona sola (3-4 semanas):** asignación automática con countdown,
   Stripe Connect (cobros/payouts automáticos), precio por distancia, ganancias
   del conductor, caducidades de documentos con bloqueo y aviso, prueba de entrega.
3. **Fase 3 — Crece (continua):** propinas, referidos y promos, OTP SMS,
   multi-ciudad, heatmap de demanda, analítica fina.

Regla: la Fase 1 hace la app mejor que la web, la Fase 2 hace que el negocio
funcione solo, la Fase 3 lo hace crecer. El backend, las tarifas, la lógica de
rutas, el blog/SEO y el panel admin actuales se conservan enteros.
