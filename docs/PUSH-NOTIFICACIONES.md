# Avisos push de ClicyVoy

Qué se avisa, a quién, quién lo dispara y qué falta para que lleguen de verdad
al móvil. Actualizado el 18/08/2026.

> **Estado hoy:** todo el código está escrito y desplegable, pero **ningún aviso
> sale del servidor todavía**: falta el proyecto de Firebase (§4). Mientras
> tanto, la app funciona igual — los cambios llegan por Realtime cuando la
> pantalla está abierta; lo que no hay es el aviso con el móvil bloqueado.

---

## 1. La matriz completa

`send-push` es la única puerta de salida. Recibe un `mode`, lee el pedido de la
base de datos y decide a quién avisar: **nunca se fía de lo que diga quien
llama**, ni del importe ni del estado.

| # | Cuándo pasa | Quién lo recibe | `mode` | Quién lo dispara | Canal | Al tocarlo abre |
|---|---|---|---|---|---|---|
| 1 | Se publica un pedido (creado ya, o programado que llega a su hora) | Conductores verificados, disponibles y con furgoneta compatible | `new_request` | Trigger `zz_notify_new_request` (0015) + la app al crear | Ofertas | Ofertas |
| 2 | Un conductor acepta el servicio | Cliente (y confirmación al conductor) | `driver_assigned` | App conductor: aceptar / aceptar al precio del cliente | Estado | El pedido |
| 3 | El conductor llega a menos de 150 m | Cliente | `driver_arriving` | Seguimiento en segundo plano, **una vez por fase** | Estado | El pedido |
| 4 | Cambia el estado (en camino, recogido, entregado) | Cliente | `status_changed` | App conductor al avanzar de paso | Estado | El pedido |
| 5 | Mensaje nuevo en el chat | La otra parte | `chat_message` | Trigger `zz_notify_chat_message` (0015) + la app al enviar | Estado | **El chat** |
| 6 | Un conductor contraoferta | Cliente | `price_offer` | App conductor al enviar la contraoferta | Estado | El pedido |
| 7 | El cliente acepta una contraoferta | Conductor ganador | `offer_accepted` | App y web del cliente | Ofertas | El servicio |
| 8 | El cliente descarta una contraoferta | Ese conductor | `offer_rejected` | App cliente al descartar | Ofertas | Ofertas |
| 9 | El cliente sube su oferta | Conductores que ya habían respondido | `offer_raised` | App cliente en «Subir mi oferta a X €» | Ofertas | El pedido |
| 10 | El conductor cancela | Cliente | `driver_cancelled` | App conductor al cancelar | Estado | El pedido |
| 11 | El cliente cancela con conductor ya asignado | Ese conductor | `client_cancelled` | App cliente al cancelar | Estado | El servicio |
| 12 | El cliente paga con tarjeta | Conductor | `payment_received` | App cliente tras confirmar el cobro | Estado | El servicio |
| 13 | El cliente deja propina | Conductor | `tip_received` | App cliente tras confirmar la propina | Estado | El servicio |
| 14 | El cliente valora el servicio | Conductor | `rating_received` | App cliente al enviar la valoración | Estado | El servicio |
| 15 | A un documento le quedan 15, 7, 3, 1 o 0 días (o ya caducó) | Ese conductor | `docs_expiring` | Cron diario `notify-docs-expiring` a las 07:00 UTC | Estado | Su perfil |

### Reglas que se aplican solas

- **Reparto**: un pedido de furgoneta grande solo suena en móviles de
  conductores con furgoneta grande, y solo si están *disponibles*.
- **Nada de avisos zombis**: `new_request` no envía nada si el pedido ya dejó de
  estar pendiente; `price_offer` calla si la contraoferta ya no está viva;
  `offer_accepted` solo sale si el pedido quedó realmente aceptado.
- **Tokens muertos**: si Expo responde `DeviceNotRegistered` (app desinstalada o
  permiso revocado), el token se borra solo de `push_tokens`.
- **Preferencias del usuario** (Perfil → avisos): tres interruptores que respeta
  el manejador de la app —  *Estado del pedido* (incluye el chat), *Ofertas y
  contraofertas* y *Novedades*. Los avisos del servicio en curso no se pueden
  silenciar por completo, igual que en Uber.
- **Canales de Android**: `ofertas` (máxima prioridad, vibra), `estado` (alta) y
  `novedades` (baja). Así el conductor puede dejar las ofertas sonando fuerte
  sin que le suene igual cada mensaje.

---

## 2. Por qué algunos avisos los dispara la base de datos

Tres cosas ocurren cuando no hay ninguna app mirando, y por eso viven en la
migración `0015_avisos_push.sql`:

1. **Pedidos programados.** El cron de `0012` los pasa a pendientes a su hora.
   Antes cambiaba el estado en silencio y ningún conductor se enteraba.
2. **Pedidos creados desde la web o como invitado.** La app avisaba al crear el
   pedido; la web no. Con el trigger da igual por dónde entre.
3. **Documentación caducada.** El job diario bloqueaba al conductor sin decirle
   por qué se le habían acabado las ofertas.

El trigger de chat existe por lo mismo: un mensaje escrito desde la web tenía
que avisar al móvil, y no lo hacía.

---

## 3. Qué falta para que lleguen (bloqueado por accesos)

Expo entrega los push a Android **a través de Firebase Cloud Messaging**. Sin
proyecto de Firebase, `registerPushToken` devuelve `null` y nadie recibe nada:
no es un fallo del código, es una credencial que falta.

Pasos, en orden:

1. **Crear el proyecto en Firebase** (console.firebase.google.com) con el
   paquete `com.clicyvoy.app`. Sale gratis.
2. Descargar **`google-services.json`** y dejarlo en `mobile/`.
3. En Firebase → Configuración → Cuentas de servicio: **generar una clave
   privada** (JSON).
4. Subirla a Expo: `eas credentials` → Android → *Google Service Account Key for
   Push Notifications (FCM V1)*.
5. **Recompilar el APK** (el `google-services.json` es nativo, no viaja por OTA).
6. ~~Crear los dos secretos en Vault~~ **HECHO** (25/08/2026): `project_url` y
   `service_role_key` ya están guardados.
7. ~~Aplicar `0015_avisos_push.sql`~~ **HECHO**: los triggers y el cron están
   activos y **probados** — al crear un pedido, la base de datos llama sola a
   `send-push` y responde 200. Devuelve `sent: 0` únicamente porque todavía no
   hay ningún móvil registrado, y eso es lo que desbloquea Firebase.

**Solo quedan los pasos 1 a 5**: crear el proyecto de Firebase, subir la clave a
Expo y recompilar el APK. Todo lo demás está montado y funcionando.

### Comprobación después de configurarlo

```bash
# 1. Que el móvil registra token (con la app abierta e iniciada la sesión)
select user_id, platform, device_name, created_date from push_tokens order by created_date desc limit 5;

# 2. Un aviso de prueba, con un pedido pendiente real
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"mode":"new_request","order_id":"<id de un pedido pendiente>"}'
# Respuesta esperada: {"sent":N,"total":N} con N > 0
```

Si `sent` es 0 y `total` es 0, no hay tokens: la app no llegó a registrarse
(permiso denegado, emulador, o falta el paso 4).

---

## 4. Lo que sigue sin cubrir, y por qué

- **Avisos a la empresa** (incidencia abierta por un cliente, conductor que
  cancela en viaje): hoy van por email. El panel de administración es web y no
  hay app de administrador donde recibir un push.
- **Recordatorio de valoración** al día siguiente si el cliente no valoró: es
  fácil de añadir (un cron más), pero cansa al usuario; lo dejo propuesto, no
  hecho, para decidirlo con datos.
- **Aviso de pedido programado al cliente** («mañana a las 9 recogemos»): tiene
  sentido, pero conviene decidir con qué antelación antes de escribirlo.
- **iOS**: nada de esto está probado en iPhone; el proyecto es Android hoy.
