# ClicyVoy — Documento funcional: Rediseño Web + App Android Cliente/Conductor

**Fecha:** 2026-08-07 · **Base:** propuesta comercial aceptada (300 € web + 700 € app cliente + 700 € app conductor, sin IVA) · **Proyecto:** `pontemania` (Next.js 16 + Supabase + Vercel)

Este documento traduce la propuesta a funcionalidades concretas y construibles, indicando en cada punto **qué existe ya**, **qué se modifica** y **qué es nuevo**. Complementa (no sustituye) a `FUNCIONALIDADES-APP-ANDROID.md` y `PLAN-APP-ANDROID.md`.

Leyenda: ✅ ya existe · 🔧 existe pero se modifica · 🆕 nuevo

---

## 0. Principio rector de UX (aplicable a todo)

**La página de inicio y las páginas de servicio venden; el checkout informa.**

Todo lo que genera fricción — recargos por plantas, avisos de "el cliente también ayuda", advertencia de cobro como mudanza, desplegables de ascensor, coste por parada — **NO aparece en la home ni en las tarjetas de servicio**. Aparece únicamente dentro del flujo de compra, en el paso correspondiente, justo antes de confirmar, con el precio recalculándose en vivo para que nunca haya sorpresa en el resumen final.

En la home y landings solo se muestra: precio base atractivo, qué incluye, y el botón de acción.

---

## 1. FASE 1 — REDISEÑO WEB (300 €, 2-4 días, hito: finales de agosto)

### 1.1 Bases de diseño

- 🆕 Se presentarán **2 propuestas de diseño** (dirección visual: colores, tipografía, hero, tarjetas) sobre la home. El cliente elige 1 y esa base se aplica a toda la web.
- Se mantiene intacta la lógica de negocio y el backend Supabase actual.

### 1.2 Home — Hero con mapa en vivo

- ✅ Ya existe el mapa Leaflet con conductores disponibles (`get_public_drivers()`, posición difuminada por privacidad, Realtime).
- 🔧 Pasa a ser **el banner protagonista** de la home.
- 🔧 Eliminar los datos falsos hardcodeados del panel flotante ("12 disponibles ahora", "~8 minutos") y sustituirlos por datos reales calculados de la RPC (nº de conductores disponibles reales; si es 0, mensaje neutro tipo "Servicio bajo demanda en Albacete").
- **Nota sobre la dependencia con la app:** el mapa funciona *hoy* con las posiciones del panel web del conductor (se actualizan solo con la pestaña abierta). Cuando llegue la app conductor (Fase 3) con GPS en segundo plano + `location_updated_at`, el mapa mostrará solo posiciones frescas (< 2 min) y será fiable de verdad. **Se implementa ya en Fase 1; la Fase 3 lo alimenta con datos buenos.**

### 1.3 Home — "¿Qué necesitas transportar hoy?"

- ✅ El selector de 4 servicios ya existe (grid 2×2 en el hero + navbar + footer + tarjetas).
- 🔧 Cambios:
  - Añadir el título exacto: **"¿Qué necesitas transportar hoy?"**.
  - 4 botones **animados** (framer-motion ya está instalado): 📦 Porte · 🏠 Mini mudanza · 🛍 Compra en tienda · 🚚 Envío de paquete.
  - Cada botón entra **directamente al flujo de compra** del servicio correspondiente (ya funciona vía `?service=`), no a una página intermedia.
  - Unificar los nombres en navbar/footer (hoy el footer los tiene en inglés: "Shop Delivery", "Package").

### 1.4 Nuevos tipos de servicio y motor de tarifas (requisito previo a todo lo demás)

Hoy en BD solo existen `transport` y `package`; mini mudanza, porte y compra en tienda son indistinguibles, y **los precios viven en 5 sitios que se contradicen** (landing 99 €, asistente 60 €, BD 40 €, README otra variante…). El rediseño exige arreglarlo:

- 🆕 `service_type` real con 4+1 valores: `porte` · `mini_mudanza` · `porte_tienda` · `paquete` (+ `paquete_villarrobledo` o campo `destination_zone`).
- 🆕 Reestructurar `app_settings.tariffs` como **tarifario por servicio** (jsonb), editable desde el admin como hasta ahora:

| Servicio | Precio base | Incluye | Extras |
|---|---|---|---|
| Porte | **40 €** | Recogida y entrega a pie de calle, máx. 6 objetos | — (sin ayuda, sin horas) |
| Mini mudanza | **99 €** | Furgoneta grande, 2 h incluidas, a pie de calle | Hora extra **25 €** · Ayuda conductor **+39 €** · Planta sin ascensor **15 €/planta** · Parada adicional **+20 €** |
| Porte para tiendas | **30 €**/servicio | Subida a piso si hay ascensor, firma obligatoria | — |
| Paquete Albacete | **4,99 / 7,99 / 9,99 €** (0-9 / 10-19 / 20-30 kg) | Entrega en el día | — |
| Paquete Villarrobledo 🆕 | **19,99 €** | Hasta 10 kg, recogida en Albacete, entrega 24 h en Villarrobledo, firma obligatoria | — |

- 🔧 **Una única fuente de precios**: landing, asistente, RPC de invitado y términos legales leen todos del tarifario. Eliminar los precios hardcodeados de `ServicesSection.jsx`, `VehicleCard.jsx` y el fallback de la RPC.
- 🔧 La selección de furgoneta small/large **desaparece como paso**: el servicio determina el vehículo (mini mudanza = solo grande; se elimina la furgoneta pequeña de ese flujo).

### 1.5 Páginas de servicio (landings SEO) — 🆕 no existe ninguna

Cuatro páginas nuevas indexables (añadir al sitemap, metadata + JSON-LD `Service`):

**`/mini-mudanzas-albacete` — "Tu mudanza en Albacete en minutos"**
- Texto SEO informativo + fotos reales de la furgoneta grande (**pendiente: el propietario envía las fotos**).
- Precio visible: 99 € · 2 h incluidas. CTA al flujo.
- Lo demás (hora extra 25 €, ayuda 39 €, plantas, paradas) se explica **dentro del checkout** (ver 1.6).

**`/portes-albacete` — "Transportes rápidos en Albacete para particulares"**
- Precio visible: 40 €, recogida a pie de calle.
- Máximo 6 objetos (lavadora, lavavajillas, colchón…): se menciona en la página como característica ("hasta 6 objetos"), y la **advertencia** ("si no se informa correctamente se cobrará como mudanza o se cancelará el servicio") va solo en el checkout.

**`/portes-para-tiendas` — "Contrata el servicio de entrega para tu negocio"**
- Página B2B: 30 €/servicio, subida a piso si hay ascensor, entrega con firma obligatoria y geolocalizada.
- Orientada a tiendas de electrodomésticos y comercios; CTA de contacto/alta además del flujo directo.

**`/envio-paquetes-albacete-villarrobledo` — "Envío de paquetes en Albacete y Villarrobledo"**
- Tramos actuales de Albacete + el nuevo servicio Villarrobledo 24 h / 10 kg / 19,99 €.
- Firma obligatoria del receptor en la entrega.

### 1.6 Flujo de compra — nuevos pasos y campos (aquí vive la "fricción")

Sobre los asistentes actuales (hero / invitado / autenticado — **recomendado: unificar los 3 en un componente único**, hoy son 2.700 líneas duplicadas):

**Mini mudanza:**
- 🆕 Toggle "Ayuda del conductor +39 €". Al activarlo, aviso claro: *"La ayuda es un trabajo de dos: el cliente también colabora en la carga y descarga."*
- 🆕 Con ayuda activada, por cada dirección (origen y destino): desplegable **¿Hay ascensor? Sí/No** → si No, desplegable **nº de plantas** → recargo **15 €/planta** sumado en vivo.
- 🆕 Sin ayuda: checkbox actual de "acepto recogida y entrega a pie de calle" (ya existe).
- 🆕 **Paradas adicionales**: botón "+ Añadir parada" entre origen y destino (3 direcciones = 1 parada extra). **+20 €/parada**, sin límite razonable (máx. 3-4). Nueva columna `stops jsonb` con dirección+coordenadas por parada; el conductor las ve en orden en su panel/app.
- 🆕 Horas extra a **25 €** (hoy 15 €) solo en este servicio.

**Porte:**
- 🆕 Campo estructurado "¿Qué transportas?" con contador de objetos (máx. 6).
- 🆕 Aviso en el paso de carga: *"Si la carga declarada no se corresponde con la real, el servicio se cobrará como mini mudanza o podrá cancelarse."* + checkbox de conformidad.
- Sin opción de ayuda ni horas: precio cerrado 40 €.

**Porte para tiendas:**
- 🆕 Datos del receptor (nombre + teléfono) obligatorios.
- 🆕 Marca `signature_required = true` (la firma se captura en la entrega: canvas en el panel web del conductor en Fase 1, firma nativa en la app en Fase 3).

**Paquetes:**
- 🔧 Selector de destino: Albacete (tramos actuales) / **Villarrobledo** (≤10 kg, 19,99 €, entrega 24 h). Validación de CP de destino de Villarrobledo (02600).
- 🆕 `signature_required = true` en ambos.

**Común:**
- El resumen final desglosa cada concepto (base + horas + ayuda + plantas + paradas + seguro) antes de pagar. Sin cargos que el cliente no haya visto.

### 1.7 "Cómo funciona" + texto SEO

- 🔧 Actualizar la sección "Cómo funciona" para reflejar el flujo con las apps (solicitas → conductor verificado acepta → sigues en tiempo real → pagas y valoras).
- 🆕 Debajo de los servicios, bloque SEO con la estructura entregada (texto del cliente, con vía libre para pulirlo):
  - **H1** (si la jerarquía de la home lo permite; si no, H2): *"Portes, mini mudanzas, envío de paquetes y transporte con furgoneta en Albacete"*
  - Párrafos: qué es ClicyVoy, oferta a profesionales/tiendas, entregas geolocalizadas con la app.
  - Lista "Nuestros servicios" (portes, mini mudanzas, recogidas en tiendas, compras Wallapop/Marketplace, paquetes, objetos voluminosos, servicio profesional a tiendas).
  - **H2** *"Reserva una furgoneta con conductor en minutos"* · **H3** *"¿Por qué elegir ClicYVoy?"* (lista de beneficios) · **H2** *"El transporte que necesitas, cuando lo necesitas"*.
  - Enlaces internos desde el texto a las 4 landings de servicio (refuerzo SEO).

### 1.8 Reseñas de Google — 🆕

- Al final de la home, sección con las reseñas reales del negocio (https://maps.app.goo.gl/CEs2fNnTqzqcBkb4A).
- **Implementación recomendada:** Google Places API (Place Details, campo `reviews`) llamada desde el servidor con caché de 24 h (ISR), mostrando estrellas, nombre, avatar y texto + enlace "Ver en Google" / "Déjanos tu reseña".
- **Alternativa sin coste/API:** volcado estático de las 3 reseñas actuales con enlace a Google (se actualiza a mano). Se decide según si se quiere dar de alta la API key de Places.

### 1.9 "Quiero ser conductor"

- ✅ Ya existe `/ser-conductor` con formulario → `driver_applications`.
- 🔧 Colocación propuesta: enlace en navbar ("Quiero conducir"), CTA en el footer y la sección `DriversSection` reubicada tras las reseñas, justo antes del footer. Los badges de Google Play de esa sección se conectarán a la ficha real de Play Store cuando la app se publique (hoy apuntan a `/ser-conductor`).

### 1.10 Limpieza incluida en la fase

- 🔧 Eliminar la doble instancia del navbar y las inconsistencias de naming.
- 🔧 `final_price`: empezar a escribirlo al cerrar el servicio (necesario para los extras de la app: horas excedidas, ayuda añadida).

---

## 2. FASE 2 — APP ANDROID CLIENTE (700 €, 10-20 días, hito: finales de septiembre)

Un único binario Expo SDK 52 (React Native 0.76+, Expo Router v3) que muestra experiencia de cliente o conductor según el rol del perfil. Publicación en Play Store (cuenta Google Play Console del cliente, ~25 $ único).

### 2.1 Onboarding y cuenta
- 🔧 Login/registro con **email** y **Google** (ya existen en Supabase Auth) adaptados a nativo.
- 🆕 **OTP por SMS** (Twilio Verify) para verificar el teléfono en el registro (antifraude). El teléfono verificado se guarda en `profiles`.

### 2.2 Asistente de pedido
- 🔧 Mismos servicios y tarifario que la web (fuente única).
- 🆕 **Autocompletado de direcciones** (Google Places/Mapbox) + **pin en mapa** ajustable + botón "usar mi ubicación".
- 🆕 Cámara nativa (react-native-vision-camera): multi-captura, **compresión automática** antes de subir.
- 🆕 **Borradores offline** (WatermelonDB): si el usuario abandona a mitad, el pedido se guarda localmente y se recupera al volver a abrir.
- 🆕 **Pedidos programados**: fecha/hora futura (`scheduled_at`), recordatorio push al cliente y oferta a conductores con antelación.

### 2.3 Seguimiento en vivo
- 🔧 Mapa con posición del conductor (Supabase Realtime, ya montado en web).
- 🆕 **ETA por carretera** (OSRM, ya usado en web) recalculado en movimiento.
- 🆕 **Indicador de frescura**: "actualizado hace Xs" a partir de `location_updated_at`; si la posición es vieja, se atenúa el marcador.

### 2.4 Notificaciones push — 🆕
- Firebase Cloud Messaging (expo-notifications) para **todos** los cambios de estado: aceptado, en camino, recogido, entregado, cancelado, mensaje de chat, recordatorio de programado, enlace de pago. Tabla `push_tokens` + envío desde Edge Functions (matriz completa en `FUNCIONALIDADES-APP-ANDROID.md` §6).

### 2.5 Chat nativo
- 🔧 Sobre `chat_messages` + Realtime (unificando el polling actual del lado conductor).
- 🆕 **Fotos** en el chat (comprimidas), **badge de no leídos**, sonido/vibración, push al recibir.

### 2.6 Pagos
- 🔧 Stripe nativo (`@stripe/stripe-react-native`) — pasar las claves de test a **producción**.
- 🆕 **Google Pay** y **tarjetas guardadas** (Stripe Customer + SetupIntent).
- 🆕 **Pagar con tarjeta un pedido en efectivo**: aunque el cliente eligiera efectivo, al finalizar el servicio recibe push/email con enlace a `/payment/[id]` (web o app) para pagarlo con tarjeta si prefiere. El pedido queda `pending_payment` hasta que el conductor marque "cobrado en efectivo" o llegue el pago online.

### 2.7 Post-servicio
- 🔧 Valoración con estrellas (ya existe el modelo).
- 🆕 **Propina** al conductor (cargo adicional Stripe, columna `tip_amount`, 100 % para el conductor).
- 🆕 **Recibo/factura PDF** descargable (Edge Function que genera el PDF con los datos del servicio).

### 2.8 Historial
- 🔧 Historial con **filtros avanzados** (estado, servicio, fechas).
- 🆕 **Repetir pedido con un toque** (precarga direcciones + carga + servicio).

---

## 3. FASE 3 — APP ANDROID CONDUCTOR (700 €, 10-20 días, hito: finales de octubre)

Mismo APK; tras el login, si `role = driver`, se carga la experiencia conductor.

### 3.1 Verificación documental
- 🔧 Los 7 documentos actuales (selfie, carnet, DNI, seguro, recibo autónomo, situación censal, fotos del vehículo) subidos desde cámara nativa con **escaneo de bordes y compresión automática**.
- 🆕 **Caducidad inteligente**: campo `expires_at` por documento; push **15 días antes** del vencimiento; al vencer, **bloqueo automático del perfil** (`is_available = false` + no recibe ofertas) mediante job `pg_cron` diario. El admin ve el estado de caducidades en su panel.

### 3.2 Trabajo diario
- 🔧 Toggle **Disponible / No disponible** (ya existe en web).
- 🆕 **Ofertas por push inmediato** con sonido distintivo al crearse un pedido compatible (hoy es email). Pantalla de oferta con origen/destino/precio/servicio.
- 🆕 **GPS en segundo plano**: foreground service (expo-location + expo-task-manager) que se **activa solo con trabajo activo o disponible=ON** y se apaga al terminar. Escribe `current_lat/lng` + `location_updated_at`.
- 🔧 **Navegación integrada**: deep-links a Google Maps/Waze (ya existen en web) **sin perder el tracking** (el foreground service sigue vivo).

### 3.3 Ejecución del servicio
- 🔧 Avance de estados con **botones grandes** (aceptado → en camino → recogido → entregado). Cancelación con motivo solo antes de recoger (ya existe).
- 🆕 **Prueba de entrega**: foto del paquete + **firma digital del receptor** en pantalla (`proof_photo_url`, `proof_signature_url`). **Obligatoria** en paquetes y portes para tiendas; **opcional** en portes/mudanzas. La firma aparece en el recibo PDF del cliente.
- 🆕 **Detección de exceso de horas** (extra solicitado): cronómetro del servicio desde "recogido"; si supera las horas incluidas, la app avisa al conductor y **recalcula el precio** (25 €/h mini mudanza) actualizando `final_price`. El cliente recibe push con el desglose. Ajuste registrado en tabla `price_adjustments` (auditable por el admin).
- 🆕 **Añadir "ayuda del conductor" sobre la marcha** (extra solicitado): si el cliente no contrató ayuda pero el conductor la realiza, puede añadir el cargo (+39 €) desde la app → el cliente recibe push y **lo aprueba con un toque** (o queda registrado con foto como evidencia si se opta por aplicación directa — a decidir; recomendado: con aprobación del cliente para evitar disputas).

### 3.4 Panel de ganancias
- 🔧 Ganancias hoy/semana/mes con gráficos nativos.
- 🆕 Datos calculados por **RPC en servidor** (hoy se calculan en el cliente), usando `final_price` real, propinas incluidas.

### 3.5 Chat con cliente
- 🔧 Chat Realtime unificado (se elimina el polling), push al recibir, fotos.

### 3.6 Sistema de niveles — 🆕 (extra solicitado)
- 🥉 **Bronce** · 🥈 **Plata** · 🥇 **Oro** · 💎 **Diamante**, según valoración media y nº de servicios. Propuesta inicial (umbral editable por admin en `app_settings`):
  - Bronce: por defecto · Plata: ≥25 servicios y media ≥4,2 · Oro: ≥75 y ≥4,5 · Diamante: ≥150 y ≥4,8.
- Insignia visible en el perfil del conductor, en la pantalla de seguimiento del cliente y en el mapa de la home. Cálculo automático (trigger sobre el actual `sync_driver_rating`).

### 3.7 Viabilidad de los 4 extras dentro del presupuesto

| Extra | Esfuerzo | ¿Entra? |
|---|---|---|
| Niveles de conductor | Bajo (cálculo + insignia) | ✅ Sí |
| Efectivo → pago con tarjeta a posteriori | Bajo (reutiliza `/payment/[id]` + push) | ✅ Sí |
| Exceso de horas con recálculo | Medio (cronómetro + `price_adjustments` + push) | ✅ Sí |
| Ayuda añadida por el conductor | Medio (flujo de aprobación del cliente) | ✅ Sí, en versión "con aprobación"; sin aprobación automática de disputas |

Los cuatro entran manteniendo el alcance simple descrito. Lo que **no** entra en este presupuesto: cupones/referidos, Stripe Connect con payouts automáticos, iOS.

---

## 4. Cambios de backend transversales (Supabase)

Consolidado de todas las fases (amplía el §7 de `FUNCIONALIDADES-APP-ANDROID.md`):

| Cambio | Fase |
|---|---|
| `service_type` con valores reales (`porte`, `mini_mudanza`, `porte_tienda`, `paquete`) + `destination_zone` | 1 |
| Tarifario por servicio en `app_settings.tariffs` (jsonb reestructurado) | 1 |
| `transport_requests.stops jsonb` (paradas adicionales) | 1 |
| Campos de ascensor/plantas por dirección + recargos desglosados (`price_breakdown jsonb`) | 1 |
| `signature_required boolean` | 1 |
| Escribir `final_price` al cerrar el servicio | 1 |
| `scheduled_at` + recordatorios | 2 |
| `push_tokens` + envío push desde Edge Functions | 2 |
| `tip_amount` + cargo Stripe de propina | 2 |
| Edge Function de recibo/factura PDF | 2 |
| `driver_profiles.location_updated_at` | 3 |
| `*_expires_at` por documento + job `pg_cron` de bloqueo | 3 |
| `proof_photo_url`, `proof_signature_url` | 3 |
| `price_adjustments` (horas extra, ayuda añadida, con estado de aprobación) | 3 |
| `driver_level` calculado + umbrales en `app_settings` | 3 |
| Fotos en `chat_messages` (`attachment_url`) + `read_at` para no-leídos | 2-3 |

---

## 5. Hitos y pagos

Total 1.700 € (300 + 700 + 700), sin IVA, en 4 pagos de 425 €:

| Pago | Importe | Cuándo | Condición |
|---|---|---|---|
| 1º | 425 € | Inicio del proyecto | — |
| 2º | 425 € | Hasta finales de agosto | Rediseño web concluido |
| 3º | 425 € | Hasta finales de septiembre | **App Cliente** concluida *(la propuesta escrita dice "app Conductor" en el 3º y 4º pago; se asume errata: 3º = Cliente, 4º = Conductor — confirmar)* |
| 4º | 425 € | Hasta finales de octubre | App Conductor concluida |

---

## 6. Decisiones tomadas durante la Fase 1

1. **"Compra en tienda" = "Portes para tiendas"** — son el mismo servicio (`porte_tienda`, 30 €, subida con ascensor y firma obligatoria), con dos nombres según a quién se le vende: "Compra en tienda" en el selector de la home (particular) y "Portes para tiendas" en la landing B2B `/portes-para-tiendas`. Encajan uno a uno con la lista de cuatro servicios del encargo.
2. **Recargo por plantas** — 15 €/planta **por dirección sin ascensor** (recogida y/o entrega) y **solo si se contrata la ayuda del conductor**: sin ayuda el servicio es a pie de calle y nadie sube nada. El servidor lo fuerza (`set_request_price` pone las plantas a 0 si no hay ayuda).
3. **Reseñas de Google** — la sección lee la ficha real con la Places API cuando estén configuradas las variables `GOOGLE_PLACES_API_KEY` y `GOOGLE_PLACE_ID`; sin ellas muestra el enlace al perfil sin inventarse testimonios.

## 7. Pendiente de confirmar con el propietario

1. **Ayuda añadida por el conductor** (Fase 3): ¿con aprobación del cliente en la app (recomendado) o aplicación directa con foto como evidencia?
2. **Fotos de la furgoneta grande** para la landing de mini mudanzas: pendiente de recibirlas.
3. **Reseñas de Google**: dar de alta la Places API y facilitar el `place_id` de la ficha, o dejar solo el enlace.
4. **Stripe**: activar claves de producción y completar la verificación de la cuenta antes de la Fase 2.
5. Errata de la condición del 3º pago (ver tabla de hitos).
