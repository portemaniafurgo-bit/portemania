# ClicyVoy — Descripción completa de la app actual (base para el rediseño)

> Escrito el **2026-08-12** para la **IA de diseño** que creará la nueva
> interfaz de la app móvil. Describe TODO lo que la app hace hoy (v0.1.3 +
> actualización OTA del 12/08, probada en dispositivo real), la identidad
> visual vigente y la funcionalidad nueva que viene (negociación de precio),
> para que el rediseño la contemple desde el principio.

---

## 1. Qué es ClicyVoy

Plataforma de **portes, mini mudanzas y envío de paquetes on-demand** en
Albacete capital (España) — un "Uber de furgonetas". Tres patas:

- **Web** (clicyvoy.es): landing + SEO + flujo de cliente + panel de
  administración. Next.js. **La landing es la referencia visual de la marca.**
- **App Android** (React Native/Expo): UNA sola app con **dos experiencias
  según el rol** de la cuenta — cliente o conductor — como Uber. El admin no
  usa la app.
- **Backend común** (Supabase): el precio SIEMPRE lo calcula el servidor; la
  app solo lo muestra. Estados del pedido: `scheduled → pending → accepted →
  in_transit → picked_up → delivered` (o `cancelled`).

Servicios y precios base actuales (editables por el admin): Porte 40 € ·
Mini mudanza 99 € (2 h incluidas, extras por hora/ayuda/plantas/paradas) ·
Compra en tienda 30 € (con firma) · Envío de paquete 4,99/7,99/9,99 € por
tramos de peso (+ Villarrobledo 19,99 €, entrega 24 h, con firma).

## 2. Identidad visual VIGENTE (fuente de verdad para el rediseño)

El rediseño puede evolucionarla, pero esto es lo que hay y de dónde sale:

### Colores (de `mobile/theme.js`, tomados de la landing actual)

| Token | Hex | Uso |
|---|---|---|
| primary | `#7145d6` | Morado de marca: botones, enlaces, activo, mapa-ruta |
| primaryPressed | `#5a35b0` | Hover/pulsado del morado |
| primarySoft | `#FAF5FF` | Fondos suaves de selección/estado activo |
| accent | `#F5B400` | **Amarillo del logo**: estrellas, stepper, acentos |
| foreground | `#1a1b20` | Texto principal (negro de la landing) |
| background | `#F7F7FA` | Fondo de pantalla |
| card | `#FFFFFF` | Tarjetas |
| border | `#E5E7EB` | Bordes suaves |
| success / successBg | `#10B981` / `#ECFDF5` | Disponible, entregado, verificado |
| warning / warningBg | `#F59E0B` / `#FFFBEB` | Avisos, caducidades próximas |
| destructive | `#EF4444` | Errores, cancelado, borrar |

### Logo y tipografía

- **Logotipo**: pin de ubicación negro+amarillo con punto amarillo + wordmark
  «Clicy» (negro) «Voy» (amarillo #F5B400). SVG canónico en
  `src/components/landing/Logo.jsx`; los assets de la app (icono, splash
  apilado, logo del login) se generan de él con
  `scripts/generate-app-assets.mjs`.
- **Títulos**: Poppins 600/700 (la de la landing). Cuerpo: fuente del sistema.
- **Radios**: tarjetas 16 px, inputs 12 px, **botones totalmente redondeados**
  (rounded-full, como los CTA de la landing). Botón primario morado con texto
  blanco; secundario blanco con borde y texto morado; el de Google con su G
  multicolor oficial sobre blanco.
- **Iconos**: Ionicons (outline) en las pestañas.

## 3. Navegación actual

- **Sin sesión**: Login → Registro → Recuperar contraseña.
- **Cliente** (tabs): **Pedir** · **Mis pedidos** · **Perfil**.
- **Conductor** (tabs): **Ofertas** · **Servicios** (historial) · **Ganancias**
  · **Perfil**.
- Pantallas de detalle fuera de tabs: pedido del cliente, trabajo del
  conductor. Splash con el logo apilado al arrancar.

## 4. Módulos del CLIENTE (lo que hay hoy, pantalla a pantalla)

### 4.1 Acceso
Login con email+contraseña y **Google** (botón oficial); registro (nombre,
teléfono, email, contraseña) con detección de email existente; recuperar
contraseña por email. Sesión persistente cifrada.

### 4.2 Pedir (asistente de 5 pasos)
1. **Servicio**: 4 tarjetas con emoji, tagline y precio "desde" EN VIVO (lee
   las tarifas reales; si el admin las cambia, cambian aquí).
2. **Contacto y direcciones**: teléfono; recogida y entrega con
   **autocompletado** (sugerencias con CP incluido; las de fuera de zona se
   marcan, no desaparecen), **«Mi ubicación»** y **«Ajustar en el mapa»**
   (mapa a pantalla completa, pin fijo al centro, se arrastra el mapa — patrón
   Uber). El paquete elige zona de entrega: Albacete / Villarrobledo.
3. **La carga**: descripción, **fotos con cámara o galería** (comprimidas,
   multi-captura, quitar tocando), ayuda del conductor (+ ascensores y plantas
   si la hay), confirmación "a pie de calle" si no hay ayuda, aceptación de
   términos.
4. **Detalles según servicio**: peso del paquete / nº de objetos / horas extra
   / seguro / destinatario / notas.
5. **Resumen**: qué-dónde-cuánto con **desglose de precio línea a línea**;
   **¿Cuándo?** (lo antes posible o **programado** con día/hora — se publica
   solo a su hora); **pago**: efectivo o **tarjeta/Google Pay**.

Extras del asistente: **borrador local** (si sales, al volver continúas),
aviso de **pedido duplicado** (<30 min), barra de progreso morada.

### 4.3 Mis pedidos
Filtros **Activos / Entregados / Cancelados** (chips redondeados), tarjetas con
servicio, estado con color, direcciones, precio, **badge 💬 de mensajes sin
leer**, y **«Repetir este pedido»** en los terminados.

### 4.4 Detalle del pedido (la pantalla estrella)
- **Timeline de estados** con puntos morados.
- **Mapa en vivo**: el conductor moviéndose (Realtime, sin refrescar), ruta
  por carretera, ETA con minutos y km, e **indicador de frescura** («Posición
  en vivo» verde / «hace X min» ámbar) — nunca se presenta una posición vieja
  como actual.
- **Ficha del conductor**: foto, nombre, furgoneta, matrícula, valoración ★ y
  **llamada directa**.
- **Pago pendiente** con tarjeta (PaymentSheet con Google Pay) si eligió
  tarjeta.
- **Chat** con burbujas (mías moradas), **fotos** en el chat, errores en línea;
  tras la entrega queda de solo lectura.
- Postventa: **valoración con estrellas amarillas + reseña**, **propina**
  (1/2/5 €, cargo aparte, 100 % para el conductor), **recibo en PDF**
  (generado en el móvil) y **recibo por email**, **cancelar** (solo
  pendiente/programado), **reportar incidencia** (tipo + urgencia).

### 4.5 Perfil
Datos de la cuenta, cerrar sesión y **eliminar cuenta** (doble confirmación).

## 5. Módulos del CONDUCTOR

### 5.1 Ofertas
- **Toggle Disponible/No disponible** (tarjeta verde cuando está activo).
- Avisos de bloqueo: perfil sin verificar, documentación incompleta,
  **documentación caducada** (rojo).
- Aviso destacado de **servicio en curso** con «Continuar».
- **Tarjetas de oferta**: chip del servicio con emoji (fondo morado suave),
  **precio grande en morado Poppins**, direcciones, chips «a X km de ti» /
  furgoneta / «con ayuda» (ámbar). **Al tocar se expande con un mapa de la
  recogida** (dónde está el trabajo antes de aceptar). Botón «Aceptar
  servicio» (con protección anti-carrera: si otro se adelantó, aviso).
- La lista se actualiza **en tiempo real** (sin tirar para refrescar).
- Estado vacío con el isotipo y mensaje útil.

### 5.2 Trabajo activo (estilo Uber)
- **Banda de estado morada** arriba: estado actual grande + «Siguiente: …» +
  stepper de progreso amarillo.
- **Mapa embebido**: MI posición en vivo (GPS del móvil), pin del destino
  (recogida → entrega según fase), ruta morada, distancia y ETA.
- Datos del servicio, petición de ayuda, **llamar al cliente**.
- «Navegación paso a paso»: botones **Google Maps / Waze** (el GPS de fondo
  sigue emitiendo aunque se salga de la app o se bloquee el móvil).
- **Avance con un botón**: Iniciar viaje → He llegado y he recogido → Trabajo
  finalizado.
- **Prueba de entrega**: foto de lo entregado + **firma del receptor con el
  dedo** + nombre. Obligatoria en paquete/tienda (y la foto en paquete),
  opcional en portes.
- **Cancelación con motivo** (solo antes de recoger; el pedido vuelve a
  pendientes).
- **Chat** con el cliente (Realtime, fotos), **opinión final** para la empresa
  (chips + texto).

### 5.3 Servicios (historial)
Trabajos entregados/cancelados con fecha, importe en Poppins, estrellas
recibidas y acceso al detalle (chat e info en solo lectura).

### 5.4 Ganancias
Tarjeta **«Total ganado» destacada en morado**, Este mes / Esta semana /
Servicios, **gráfico de barras de 7 días** (morado), nota de comisión («Recibes
el 85 %…», editable por el admin).

### 5.5 Perfil
**Avatar** (foto o inicial sobre morado suave), chip **«✓ Verificado»** verde,
furgoneta y matrícula; **los 10 documentos** (selfie, carnet, DNI, seguro,
autónomo, censal, 4 fotos de furgoneta) con punto de estado
(verde/ámbar/rojo), **subir/sustituir con cámara o galería** y **fecha de
caducidad** editable por documento (avisos a ≤15 días; al vencer, un job
diario lo saca del reparto). Cerrar sesión y eliminar cuenta.

## 6. Transversales

- **Notificaciones push** (listas; se activan al conectar Firebase): canal
  «Ofertas» con sonido propio para conductores, canal «Estado» para el resto;
  tocar la notificación abre el pedido. Mientras tanto, email de respaldo.
- **Actualizaciones OTA**: los cambios de interfaz llegan solos al reabrir la
  app — relevante para iterar el rediseño rápido.
- Estados vacíos con el isotipo; pantallas de carga con spinner morado;
  errores siempre en texto rojo en línea (no toasts del sistema).

## 7. LO QUE VIENE: negociación de precio (contexto imprescindible del rediseño)

**Decisión de producto en análisis** (el diseño DEBE reservarle sitio): el
cliente podrá **proponer su precio** al pedir, y los conductores podrán
**aceptarlo o contraofertar**; cliente y conductores negocian hasta que una de
las partes acepta (modelo inDrive).

Impacto de diseño previsible — pantallas/estados nuevos:

1. **Cliente — paso de precio del asistente**: además del precio calculado,
   campo «tu oferta» (con mínimo razonable) y explicación del modelo.
2. **Cliente — pedido pendiente**: lista VIVA de respuestas de conductores —
   tarjetas con foto, valoración, furgoneta y su contraoferta — con
   **Aceptar** / rechazar cada una; contador de tiempo.
3. **Conductor — tarjeta de oferta**: precio propuesto por el cliente +
   botones **Aceptar por X €** / **Contraofertar** (selector de importe).
4. **Ambos**: historial de la negociación en el pedido y push por cada
   movimiento («Tienes 2 contraofertas», «El cliente aceptó tu precio»).
5. El pedido pasa a `accepted` con el **precio pactado** — el desglose del
   recibo, las ganancias del conductor y las finanzas del admin usan ese
   importe.

El análisis técnico completo (BD, RLS, web, panel de admin, expiraciones,
anti-abuso) se hará como documento aparte antes de programarlo; para el
rediseño basta con contemplar estas superficies.

## 8. Qué se espera del rediseño

- Sistema de diseño (tokens de color/tipografía/espaciado/radios) partiendo de
  la identidad del §2 — puede evolucionar el morado/amarillo, no abandonarlos.
- Las ~18 pantallas de los §4–§5 + las superficies de negociación del §7.
- Estados: normal, vacío, cargando, error, deshabilitado, y los avisos de
  bloqueo del conductor.
- Mobile-first Android; los mapas son parte central de la identidad (cliente Y
  conductor) — diseñar CON el mapa, no como accesorio.
- Entregar especificación aplicable a React Native (nada de efectos
  imposibles: blurs pesados, sombras complejas multiplataforma).
