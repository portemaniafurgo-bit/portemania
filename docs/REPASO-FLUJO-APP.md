# Repaso del flujo de la app (18/08/2026)

Repaso pantalla a pantalla de los dos recorridos completos, buscando huecos como
el de la prueba de entrega. Lo que sale aquí **ya está corregido** salvo lo que
aparece marcado como pendiente al final.

---

## Recorrido del cliente

| Paso | Qué pasa | Estado |
|---|---|---|
| Pedir (5 pasos) | Servicio, direcciones, carga, precio, resumen | ✅ |
| Publicar | El pedido entra como pendiente; los conductores reciben aviso | ✅ (trigger 0015) |
| Buscando conductor | Respuestas en vivo, aceptar, descartar y subir la oferta | ✅ |
| Conductor asignado | Mapa en vivo, ETA, chat, llamar | ✅ (probado en vivo) |
| En camino / recogido | Estados y avisos | ✅ |
| **Entregado** | Hora, **foto y firma de la entrega**, valoración, propina, recibo | ✅ **corregido hoy** |
| Historial | Filtros, fecha, importe y **marca de que hay prueba de entrega** | ✅ **corregido hoy** |
| Perfil | Datos, avisos, método de pago, recibos, ayuda, introducción | ✅ |

### Huecos encontrados y corregidos

1. **La prueba de entrega no se veía.** El conductor subía foto y firma, el
   cliente tenía permiso para verlas, pero ninguna pantalla las mostraba. Ahora
   salen en el pedido entregado (app y web) y se marcan en el historial.
2. **Cancelar dejaba al conductor a ciegas.** Si el cliente cancelaba con
   conductor ya asignado, este podía seguir conduciendo hacia la recogida.
   Ahora recibe aviso (`client_cancelled`).
3. **Descartar una contraoferta era un silencio.** El conductor se quedaba
   esperando. Ahora se le avisa (`offer_rejected`).
4. **Subir la oferta no servía de nada.** Los conductores que ya la habían visto
   no volvían a mirar. Ahora se les avisa (`offer_raised`).
5. **Propina y valoración no llegaban al conductor.** Ahora sí
   (`tip_received`, `rating_received`).

---

## Recorrido del conductor

| Paso | Qué pasa | Estado |
|---|---|---|
| Ofertas | Disponibilidad, avisos de documentación, ofertas cercanas con mapa | ✅ |
| Negociar | Aceptar el precio del cliente o contraofertar con motivo | ✅ |
| Servicio activo | Banda de estado, mapa, ETA, navegación, chat, **cómo se cobra** | ✅ **corregido hoy** |
| Avanzar | En camino → recogido → entregado, con prueba de entrega | ✅ |
| Cancelar | Libre antes de salir; en viaje queda registrado; con carga, no | ✅ |
| Ganancias | Totales, semana, gráfico y últimos servicios (propinas incluidas) | ✅ |
| Perfil | Verificación, valoración, servicios y los 10 documentos con caducidad | ✅ |

### Huecos encontrados y corregidos

6. **El conductor no sabía cómo se cobra.** Ni en la oferta ni en el servicio
   activo aparecía si era efectivo o tarjeta. Podía pedir en mano un servicio ya
   pagado, o marcharse sin cobrar. Ahora se ve **antes de aceptar** (etiqueta en
   la oferta) y **durante el servicio** (aviso en color con el importe exacto).
7. **Pedido programado que se publica solo.** El cron lo pasaba a pendientes en
   silencio: nadie se enteraba de que había trabajo. Ahora dispara aviso.
8. **Documentación caducada sin explicación.** El job diario bloqueaba al
   conductor y sus ofertas desaparecían sin motivo aparente. Ahora se le avisa
   con 15, 7, 3 y 1 día de antelación, y el día que caduca.
9. **«Tu conductor está llegando» no lo disparaba nadie.** El aviso existía en el
   servidor desde el principio, pero ninguna parte de la app lo llamaba. Ahora
   lo lanza el seguimiento al entrar en un radio de 150 m, una sola vez por fase
   (una al llegar a recoger, otra al llegar a entregar).
10. **El chat escrito desde la web no avisaba al móvil.** Ahora el aviso lo
    dispara la base de datos, así que da igual desde dónde se escriba.

---

## Pendiente (decisión o accesos, no código)

- **Los avisos no salen todavía**: falta el proyecto de Firebase. Todo lo demás
  está listo — ver [PUSH-NOTIFICACIONES.md](PUSH-NOTIFICACIONES.md) §3.
- **El cliente no puede cancelar una vez asignado el conductor**. Hoy solo puede
  antes de que alguien lo acepte. Uber y Bolt permiten cancelar después con
  penalización; hay que decidir si se cobra algo y cuánto antes de programarlo.
- **Avisos a la empresa** (incidencias, cancelaciones en viaje): van por email
  porque el panel es web y no hay app de administrador.
- **Guía del conductor**: conviene un texto corto explicando que en Xiaomi hay
  que poner ClicyVoy en batería «Sin restricciones» y conceder «Permitir todo el
  tiempo» a la ubicación; si no, la posición se congela al bloquear el móvil.
