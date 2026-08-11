# Mejoras UX — experiencia de conductor "estilo Uber" + pulido visual

> Escrito el **2026-08-11** a partir del feedback del cliente probando la
> v0.1.3 en su móvil. Para que lo programe **otro agente de IA**. Antes de
> tocar nada, leer [HANDOFF-APP-PENDIENTES.md](HANDOFF-APP-PENDIENTES.md)
> (credenciales, reglas innegociables, cómo entregar) — este documento define
> las tareas UX-1 a UX-3 y se entrega POR OTA (todo es JavaScript: no hace
> falta APK nuevo ni tocar módulos nativos).

## El feedback del cliente, literal

1. «Esto debería tener algo de Uber, ¿no? El mapa en la app donde pueda ver
   dónde se encuentra mi pedido.» — El conductor hoy NO tiene mapa dentro de
   la app: solo botones que lo sacan a Google Maps/Waze.
2. «¿En Uber el mapa se abre en la app o en Google Maps y Waze?» — Respuesta
   de referencia: **en Uber el mapa vive DENTRO de la app** (viaje, posición
   propia y ruta siempre visibles) y la navegación giro a giro con apps
   externas es OPCIONAL. Ese es el patrón a imitar.
3. «Hay que mejorar el diseño usando los colores.» — Pulido visual con la
   paleta de la marca (ya centralizada en `mobile/theme.js`).

---

## UX-1 — Mapa embebido en el trabajo activo del conductor (PRIORITARIA)

**Pantalla**: `mobile/app/(conductor)/job/[id].js`.

**Qué construir**: un mapa DENTRO de la pantalla, arriba del todo (debajo de la
cabecera de estado), como ve Uber el conductor:

- **Reutilizar `mobile/components/TrackingMap.js`** — ya pinta MapLibre + ruta
  OSRM + ETA y es exactamente el mapa que ve el cliente. No crear otro mapa.
- `driverLocation` aquí NO se lee de la BD (es el propio móvil): usar
  `expo-location` en primer plano — `Location.watchPositionAsync` con
  `accuracy: Balanced`, ~5 s / 20 m — y pasar `{ lat, lng, updatedAt: ahora }`.
  El permiso foreground ya está concedido (lo pide el tracking al aceptar).
- `target`: hasta recoger, la RECOGIDA (`origin_lat/lng`); tras recoger, la
  ENTREGA (`destination_lat/lng`) — misma lógica `goingToPickup` que ya usa la
  pantalla del cliente. Si el pedido no tiene coordenadas (dirección tecleada a
  mano sin geocodificar), geocodificar una vez con `geocodeAlbacete` de
  `lib/eta.js` y cachear en estado; si tampoco, ocultar el mapa con elegancia.
- Bajo el mapa, línea con **distancia y ETA** («3,2 km · unos 9 min») — la da
  el propio TrackingMap; comprobar que se ve bien en este contexto.
- Los botones **Google Maps / Waze se quedan** justo debajo, como acción
  secundaria con el texto «Navegación paso a paso».

**Hecho cuando**: el conductor de prueba (`conductor.test@portemania.es` /
`Conductor2026!`) acepta un pedido y ve su posición moverse EN la app hacia el
pin de recogida, con ruta morada y ETA, sin abrir Google Maps.

## UX-2 — Mapa de contexto en la oferta (segunda prioridad)

**Pantalla**: `mobile/app/(conductor)/ofertas.js`.

Uber enseña DÓNDE está el trabajo antes de aceptarlo. Al tocar una oferta
(hoy la tarjeta no se expande): mostrar un mapa pequeño (~180 px de alto,
`TrackingMap` con `driverLocation=null` y `target=` la recogida) dentro de la
tarjeta expandida, con la distancia desde la posición actual del conductor
(`distanceKm` de `lib/eta.js` + `Location.getCurrentPositionAsync`). El botón
«Aceptar servicio» no cambia de reglas.

**Hecho cuando**: tocar una oferta muestra el pin de recogida en un mapa y
«a X km de ti» sin salir de la lista.

## UX-3 — Pulido visual con la paleta (ambos roles, foco en conductor)

Regla base intacta: **ningún color fuera de `mobile/theme.js`** (morado
`primary #7145d6`, `primaryPressed`, `primarySoft`, amarillo `accent #F5B400`,
negro `foreground #1a1b20`). Poppins ya está cargada (`typography.heading/title`).

Checklist concreto, pantalla a pantalla:

1. **Cabecera de estado del trabajo** (`job/[id]`): banda superior tipo Uber —
   tarjeta con fondo `primary`, texto blanco: estado actual en grande
   (Poppins) y la siguiente acción en pequeño («Siguiente: he llegado y he
   recogido»). El botón de avance de estado, grande y pegado abajo del bloque.
2. **Stepper visual de estados** en `job/[id]`: reutilizar el patrón de
   timeline de la pantalla del cliente (puntos morados rellenos hasta el
   estado actual) en vez de solo el texto del estado.
3. **Tarjetas de oferta** (`ofertas.js`): el precio como protagonista (grande,
   `primary`, Poppins); chip del servicio con su emoji sobre `primarySoft`;
   chip ámbar `warningBg` cuando `needs_help`; separación clara entre aviso de
   trabajo activo, toggle y lista.
4. **Toggle Disponible**: tarjeta con borde/fondo según estado — `successBg`
   disponible, `secondary` apagado — y el switch con `trackColor` primary (ya
   está) + texto de estado en el color correspondiente.
5. **Ganancias**: números grandes en Poppins; la tarjeta «Total» destacada con
   fondo `primary` y texto blanco (las otras tres, blancas); la nota de
   comisión ya usa `primarySoft` ✓.
6. **Perfil del conductor**: cabecera con avatar (foto o inicial sobre círculo
   `primarySoft`), nombre en Poppins y chip de estado («Verificado» en
   `successBg`); la lista de documentos ya tiene puntos de color ✓.
7. **Estados vacíos con personalidad** (ambos roles): «No hay pedidos ahora
   mismo» con el isotipo (assets/icon.png, pequeño, opacidad suave) y una
   frase útil, en vez de una línea gris seca.
8. **Cliente — pantalla del pedido**: la ficha del conductor con el avatar
   redondo y la valoración con estrella en `accent` (amarillo marca), no gris.
9. **Consistencia**: revisar que TODOS los `fontWeight: "700"` manuales en
   títulos usan `typography.heading/title` (Poppins) en su lugar; los que sean
   cifras (precios) pueden quedarse en system bold.

**Hecho cuando**: capturas de las 5 pantallas del conductor y las 4 del
cliente lado a lado con la landing no desentonan: misma paleta, misma
tipografía de títulos, mismos radios.

---

## Cómo entregar (importante: sin APK)

Todo lo de este documento es JavaScript → **OTA**:

```bash
cd mobile
npx expo export --platform android   # verificación mínima: no imports rotos
EXPO_TOKEN=<token del historial> npx eas-cli update --branch preview --message "UX conductor: mapa embebido + pulido visual"
```

La app instalada del usuario lo descarga al reabrirse (dos aperturas: en la
primera baja, en la segunda aplica). Verificar EN el móvil con
`adb shell screencap` comparando antes/después, y con el conductor de prueba
aceptando un pedido real de prueba.

**Prohibido en esta tanda**: añadir módulos nativos (obligaría a APK), tocar
reglas de negocio, o meter colores fuera de theme.js.
