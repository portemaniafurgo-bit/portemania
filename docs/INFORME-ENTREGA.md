# ClicyVoy — Informe de entrega

> Resumen legible del estado de la plataforma y del trabajo de calidad previo a la entrega.
> Fecha: **2026-07-07**. El registro técnico detallado y cronológico está en [SEGUIMIENTO.md](SEGUIMIENTO.md).

---

## 1. Estado general

La plataforma está **en producción y operativa** en https://clicyvoy.es, desplegada en la
infraestructura del negocio (GitHub `portemaniafurgo-bit`, Supabase `dnehzwrqphqpkcdjwqfi`,
Vercel de `portemaniafurgo@gmail.com`). Cada cambio se prueba, se corrige y se vuelve a
revisar hasta verificarlo funcionando.

Antes de esta fase la app funcionaba, pero una revisión a fondo encontró **fallos que un
cliente sí habría reportado** —incluidos algunos de dinero y de datos personales—. Están
corregidos y verificados con pruebas reales (no solo "debería funcionar").

## 2. Qué hace la plataforma (resumen)

- **Cliente**: pide un porte (con cuenta o como invitado), elige furgoneta pequeña (40€) o
  grande (60€), ayuda de carga opcional (+30€), sube fotos, ve al conductor en el mapa,
  chatea, paga con tarjeta o efectivo y valora.
- **Conductor**: se da de alta por invitación (email), completa su perfil y documentos
  (selfie, carnet, DNI, seguro, **recibo de autónomo**, **situación censal**, fotos del
  vehículo), ve y acepta trabajos compatibles con su furgoneta, navega con Google Maps/Waze,
  puede cancelar con motivo y deja su opinión al finalizar.
- **Administración** (`/admin`): operaciones y KPIs, detalle de pedidos con cronología,
  tarifas editables, finanzas y liquidaciones con exportación, estadísticas, gestión de
  conductores y empleados, y editor de blog con SEO.

## 3. Trabajo de calidad realizado en esta fase

### 3.1 Los tres fallos graves (corregidos y probados atacándolos)

1. **Escalada a administrador.** Un usuario normal podía convertirse en admin (al registrarse
   o editando su perfil) y acceder a tarifas, finanzas y todos los pedidos. Cerrado por las
   dos vías; probado que un cliente ya no puede, y que el paso legítimo de cliente a conductor
   sigue funcionando.

2. **Pedidos marcados como "pagado" sin cobrar.** La página de pago tenía un modo de reserva
   que daba el pedido por pagado aunque Stripe fallara o no estuviera configurado — pérdida de
   dinero directa. Eliminado: sin tarjeta se ofrece efectivo, nunca se marca pagado. Además el
   importe se recalcula en el servidor desde las tarifas (probado: un pedido de 90€ manipulado
   a 1€ cobra los 90€ correctos) y hay protección contra cobros duplicados.

3. **Datos personales de conductores expuestos.** DNI, teléfono, recibo de autónomo y
   situación censal eran visibles para cualquier usuario registrado, y los documentos estaban
   en un almacén público accesible por enlace. Ahora los documentos son **privados** y esos
   datos solo los ven el propio conductor, la administración y el cliente con un servicio
   asignado con él (relevante para el RGPD).

### 3.2 Robustez (el resto de correcciones)

- **Cliente**: pantallas que se quedaban cargando para siempre, acciones (valorar, cancelar,
  chatear) que fallaban en silencio, subida de fotos sin aviso de error, y validación de
  código postal más robusta.
- **Conductor**: la caja de "ganancias" ya no se infla con pedidos cancelados; dos conductores
  no pueden aceptar el mismo servicio a la vez; aviso claro cuando el GPS está desactivado; la
  comisión sale siempre de las tarifas configuradas.
- **Administración**: los empleados (rol staff) ya no ven finanzas; validación de tarifas y
  del blog; la reasignación de un conductor apunta al conductor correcto.
- **Avisos por email**: el aviso de "pedido nuevo" lo genera el servidor y llega a la
  administración **y a los conductores compatibles** con el tamaño del pedido (probado: 4 de 4
  correos entregados, incluido el del conductor real).

### 3.3 Antes de esta fase (misma sesión)

- **Alta de conductores por email estándar**: al crearlos reciben una invitación y crean su
  propia contraseña (se retiró el apaño de mostrar la contraseña en pantalla).
- **Documentos de autónomo**: añadidos recibo de autónomo y situación censal (obligatorios,
  admiten PDF) y la posibilidad de **volver a subir** cualquier documento cuando caduque.
- **Plan de la app Android** post-MVP documentado en [PLAN-APP-ANDROID.md](PLAN-APP-ANDROID.md).

## 4. Cómo se verificó

No se dio nada por bueno sin comprobarlo:

- **Ataques reales** contra la seguridad (registrarse como admin, editar el propio rol, leer
  datos de conductores, insertar pedidos ya pagados): todos bloqueados; el flujo legítimo
  cliente→conductor sigue funcionando.
- **Prueba de pago**: pedido con precio manipulado → el servidor cobró el importe correcto.
- **Prueba de email**: aviso de pedido nuevo entregado a los 4 destinatarios.
- **Build** sin errores, despliegue en Vercel confirmado, y páginas clave respondiendo (home,
  solicitar, logins, blog).

## 5. Segunda auditoría (en curso)

Se está ejecutando una **segunda revisión independiente** sobre el código actual: ocho frentes
en paralelo (verificación de los fixes, RLS/datos, funciones de servidor, integridad del
dinero, cliente, conductor, admin y transversal), cada hallazgo pasa por un verificador que
intenta refutarlo antes de darlo por válido. Sus conclusiones confirmadas se corregirán y se
añadirán a este informe y a SEGUIMIENTO.md.

## 6. Pendientes que dependen del negocio (no de código)

- **Stripe**: pasar de claves de prueba a claves reales (`live`) el día del lanzamiento.
- **Google**: publicar la pantalla de consentimiento de Google (login con Google) o añadir
  usuarios de prueba mientras tanto.
- **Imagen del banner**: sustituir el logo antiguo del hero por el nuevo de ClicyVoy (falta el
  archivo de imagen).
- **Proyecto Supabase antiguo** (cuenta personal): eliminarlo desde su panel.
