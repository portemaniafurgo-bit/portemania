# ClicyVoy — Informe de entrega

> Resumen legible del estado de la plataforma y del trabajo de calidad previo a la entrega.
> Fecha: **2026-07-07 (noche)**. El registro técnico detallado y cronológico está en [SEGUIMIENTO.md](SEGUIMIENTO.md).

---

## 1. Estado general

La plataforma está **en producción, operativa y verificada** en https://clicyvoy.es,
desplegada en la infraestructura del negocio (GitHub `portemaniafurgo-bit`, Supabase
`dnehzwrqphqpkcdjwqfi`, Vercel de `portemaniafurgo@gmail.com`).

La última verificación es del 7 de julio por la noche: **64 de 64 comprobaciones
automáticas superadas contra la web real** (flujo de invitado completo, conductor
aceptando y gestionando un servicio con mapa y rutas, cliente con seguimiento, chat y
valoración, y el panel de administración entero), además de pruebas de ataque reales
que quedaron todas bloqueadas. La base de datos contiene solo datos reales.

## 2. Qué hace la plataforma (resumen)

- **Cliente**: pide un porte (con cuenta o como invitado), elige furgoneta pequeña (40€) o
  grande (60€), ayuda de carga opcional (+30€), sube fotos, ve al conductor en el mapa,
  chatea, paga con tarjeta o efectivo, valora y puede reportar incidencias.
- **Conductor**: se da de alta por invitación (email), completa su perfil y documentos
  (selfie, carnet, DNI, seguro, **recibo de autónomo**, **situación censal**, fotos del
  vehículo — los documentos caducados se pueden volver a subir con «Cambiar»), ve y acepta
  trabajos compatibles con su furgoneta, navega con Google Maps/Waze, puede cancelar con
  motivo, reportar incidencias y deja su opinión al finalizar.
- **Administración** (`/admin`): operaciones y KPIs, detalle de pedidos con cronología,
  tarifas editables, finanzas y liquidaciones con exportación, estadísticas, gestión de
  conductores (documentación incluida), incidencias, y editor de blog con SEO.

## 3. Cómo probarlo (guía rápida)

### Como cliente invitado (sin cuenta)
1. Entra en https://clicyvoy.es → «Solicitar transporte» → «Continuar como invitado».
2. Rellena los 4 pasos (las direcciones deben llevar un CP de Albacete capital,
   02001–02008; mínimo una foto de la carga). El precio que ves es el que queda
   registrado — lo calcula el servidor con las tarifas vigentes.
3. Al enviar, la administración y los conductores compatibles reciben el aviso por email.

### Como cliente con cuenta
1. «Crear cuenta» → entra directamente (sin código) → pide un porte igual que el invitado.
2. En «Mis pedidos» → abre el pedido: seguimiento en vivo, chat con el conductor,
   valoración al entregar, «Reportar un problema», y si elegiste tarjeta y no pagaste,
   el botón **«Pagar ahora»**.
3. **Pago con tarjeta**: Stripe está en modo PRUEBA — usa la tarjeta `4242 4242 4242 4242`
   (cualquier fecha futura y CVC). Las tarjetas reales NO funcionarán hasta pasar a
   claves live.

### Como conductor
1. Entra en https://clicyvoy.es/driver con tu correo. Si falta algún documento, la
   pantalla «Completa tu perfil» te dice exactamente cuál (a Renato solo le falta
   **su recibo de autónomo**; Sergio tiene que subir toda su documentación).
2. Con el perfil completo y verificado: «Solicitudes» → aceptar → pantalla del trabajo
   (mapa con ruta, Google Maps/Waze, chat, estados recogido → entregado, opinión final).
3. Los documentos se abren desde «Subido» y se reemplazan con «Cambiar» (admiten PDF).

### Como administración
1. Entra con tu cuenta de siempre → aterrizas directamente en `/admin`.
2. Prueba: detalle de un pedido (reasignar, marcar pagado, cancelar — ahora todo avisa
   si algo falla), alta de un conductor (le llega email de invitación para crear su
   contraseña), ficha con documentación, tarifas en Ajustes, finanzas, incidencias y blog.

### Avisos importantes durante las pruebas
- **«Continuar con Google»** solo funciona para usuarios de prueba autorizados hasta que
  se publique la pantalla de consentimiento en Google Cloud. Usad email y contraseña.
- Si olvidas la contraseña: «¿Olvidaste la contraseña?» → llega email de
  `noreply@clicyvoy.es`. También puedes cambiarla desde «Mi perfil» ya dentro.

## 4. Trabajo de calidad de esta fase (resumen)

### 4.1 Seguridad — probada con ataques reales, todos bloqueados
- **Escalada a administrador** (registro o edición del propio rol): cerrada.
- **Pedidos "pagados" sin cobrar**: ya no existe ningún camino — el pago lo confirma el
  servidor verificando el cargo real en Stripe; un cliente que intente marcarse el pedido
  como pagado por la API se queda en "pendiente" (probado).
- **Precio fijado por el cliente**: el servidor recalcula siempre (un pedido pedido con
  1€ entró con los 40€ correctos — probado).
- **Conductor auto-verificándose o inflando su valoración**: bloqueado (probado).
- **Documentos de identidad**: bucket privado con enlaces firmados; los antiguos se
  migraron y la URL pública vieja ya no sirve (RGPD).

### 4.2 Fallos de producto corregidos (los que un cliente habría reportado)
- La **distancia** del pedido era un número aleatorio; ahora es la ruta real.
- Un pedido con tarjeta abandonado **no se podía pagar nunca**; ahora hay «Pagar ahora»
  (y un pedido cancelado ya no se puede pagar).
- Registrarse con un email que ya tenía cuenta dejaba al usuario **atrapado** en una
  pantalla de código; ahora avisa y ofrece iniciar sesión o recuperar contraseña.
- Conductor o admin que entraba por el login de clientes caía en el panel de cliente
  **sin salida**; ahora cada rol aterriza en su panel.
- El conductor podía **valorarse a sí mismo** desde su historial; cerrado.
- Quien no tenía perfil de conductor veía un falso «Tu cuenta ha sido eliminada»; ahora
  ve «Completa tu perfil», y si está pendiente de verificación, un aviso claro.
- **Incidencias** estaba a medias (panel sin forma de crearlas); ahora cliente y
  conductor pueden reportar problemas desde su pedido.
- Decenas de detalles: errores visibles cuando falla una subida o un guardado, PDF en
  todos los documentos, nombre real del conductor (no su email), pestaña «Recogidos» en
  admin, footer y textos reales de Albacete, banner servido en local, etc.

## 5. Cómo se verificó

- **Suites automáticas contra producción**: 29/29 (invitado+conductor+cliente) y 35/35
  (panel de administración). Con cuentas de prueba creadas para la ocasión y **borradas
  al terminar** (sin tocar la contraseña del administrador).
- **Ataques por API contra la web real**: precio manipulado, pago falso, auto-rating —
  3/3 bloqueados.
- Build limpio, deploy verificado en Vercel, todas las páginas públicas respondiendo,
  emails reales por Resend (`noreply@clicyvoy.es`).

## 6. Pendientes que dependen del negocio (no de código)

- **Stripe**: pasar de claves de prueba a claves reales (`live`) el día del lanzamiento.
- **Google**: publicar la pantalla de consentimiento (login con Google) o añadir
  usuarios de prueba mientras tanto.
- **Arte del banner**: el hero ya se sirve desde la propia web (sin dependencia externa),
  pero el dibujo sigue siendo el heredado; cuando haya banner nuevo del negocio, se cambia
  en un minuto (`public/hero-banner.png`).
- **Proyecto Supabase antiguo** (cuenta personal): eliminarlo desde su panel.
- Mejoras futuras anotadas: avisos de caducidad de documentos con fechas (previsto para
  la app Android), liquidaciones ampliadas, búsqueda global.
