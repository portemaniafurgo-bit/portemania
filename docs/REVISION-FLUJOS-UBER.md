# Revisión de flujos frente a Uber y Cabify (19/08/2026)

No estamos inventando la rueda: estos recorridos ya están resueltos en el
sector. He recorrido los dos flujos paso a paso comparándolos con lo que hacen
Uber, Cabify, Bolt e inDrive, y anotando **solo** dónde nos separamos de ellos y
por qué.

---

## Pedir un servicio (cliente)

| Momento | Cómo lo resuelven ellos | Nosotros |
|---|---|---|
| Elegir servicio | Lista con precio «desde» | ✅ Igual |
| Dirección | **Recientes y favoritas a un toque** | ✅ **corregido hoy**: recientes en recogida y entrega |
| Ver precio antes de pedir | Precio cerrado o rango antes de confirmar | ✅ Paso 4 con desglose |
| Elegir precio | inDrive: el cliente propone | ✅ Con suelo de 30 € y color de aceptación |
| Programar | Selector nativo de fecha y hora | ✅ **corregido ayer** |
| Pago | Método elegido antes de publicar | ✅ Con descuento por tarjeta |

## Esperar y seguir

| Momento | Ellos | Nosotros |
|---|---|---|
| Buscando conductor | Contador y opción de cancelar | ✅ Respuestas en vivo + caducidad |
| Conductor asignado | Ficha, llamar, chat | ✅ Igual |
| Seguimiento | Mapa en vivo con ETA | ✅ Probado en vivo, con marca de frescura |
| **Compartir el viaje** | Enlace para quien te espera | ✅ **corregido hoy** (`/seguimiento/<token>`) |
| Llegada | Aviso «tu conductor está llegando» | ✅ **corregido ayer** (radio de 150 m) |
| Cancelar ya asignado | Permitido, con penalización | ✅ **hecho**: gratis 2 min, después 5 € |

## Cerrar el servicio

| Momento | Ellos | Nosotros |
|---|---|---|
| Entrega | Prueba de entrega | ✅ Foto y firma, visibles para el cliente |
| Valoración | Estrellas + comentario | ✅ Con etiqueta viva |
| Propina | Importes fijos, 100 % al conductor | ✅ Igual |
| Recibo | Factura descargable y por email | ✅ Factura del autónomo con numeración |
| Repetir | «Repetir viaje» | ✅ Repite el pedido con sus datos |

## Conductor

| Momento | Ellos | Nosotros |
|---|---|---|
| Conectarse | Interruptor de disponibilidad | ✅ Igual |
| Recibir trabajo | Tarjeta con distancia, ruta e importe | ✅ Con mapa de la recogida siempre visible |
| Negociar | inDrive: aceptar o contraofertar | ✅ Con motivos de un toque |
| Navegar | Google Maps / Waze | ✅ Con la posición emitiendo en segundo plano |
| Saber cómo cobra | Efectivo o tarjeta, bien visible | ✅ **corregido ayer** |
| Cancelar | Libre antes de recoger, después no | ✅ Con registro del motivo |
| Ganancias | Totales y detalle por servicio | ✅ Con propinas incluidas |

---

## Cancelación del cliente: cómo queda

| Momento | Coste | Qué ve el cliente |
|---|---|---|
| Sin conductor todavía (pendiente o programado) | **Gratis** | «No tiene ningún coste» |
| Con conductor, primeros **2 minutos** | **Gratis** | «Todavía estás a tiempo» |
| Con conductor, pasados 2 minutos | **5 €** | «Cancelar ahora tiene una penalización de 5 €» **antes** de confirmar |
| Carga ya recogida | No se puede | Se resuelve con el conductor o con la empresa |

- El importe (`cancel_fee`) y el margen (`cancel_grace_minutes`) están en las
  tarifas: se cambian desde el panel sin tocar código.
- **Lo decide el servidor**, no la pantalla: si lo calculara la app, bastaría
  con cambiar la hora del móvil para cancelar gratis siempre.
- Al conductor le llega aviso al momento, que para eso ha dejado lo que estaba
  haciendo.
### Cómo se cobra la penalización (decisión tomada el 19/08)

**No se cobra sola con la tarjeta guardada.** Cobrar fuera de sesión en Europa
exige un mandato SCA, falla a menudo y convierte una deuda de 5 € en una
discusión con el banco y un posible chargeback. Por 5 €, no compensa.

Se hace como Uber con los saldos pendientes: **la penalización se suma al
siguiente servicio de ese cliente**.

- Al cancelar queda anotada en el pedido.
- El asistente se la enseña **antes de publicar** el siguiente pedido, en una
  tarjeta ámbar y sumada en el total: nadie se entera al ver la factura.
- Al crearse ese pedido, el servidor la añade como línea del desglose
  («Penalización por cancelación anterior») y la da por saldada apuntando al
  pedido donde se cobró — rastro completo para Finanzas.
- Se cobra con el mismo pago del servicio, en efectivo o con tarjeta. Sin
  infraestructura nueva y sin cobros por sorpresa.

Probado de punta a punta contra producción: cancelar pasados 10 minutos deja 5 €
de deuda, el siguiente porte de 40 € se crea por 45 € con su línea en el
desglose, y la deuda queda a 0 apuntando al pedido que la saldó.

Probado contra producción los cinco casos, incluidos los que deben fallar:
cancelar un pedido ajeno y cancelar con la carga ya recogida.

## Lo que queda, y por qué no lo he hecho solo

1. **Chat con respuestas rápidas** («voy llegando», «estoy en la puerta»). Uber
   las tiene porque nadie escribe conduciendo. Es media hora de trabajo, pero
   conviene que las frases las decidáis vosotros.
3. **Favoritas con nombre** («casa», «almacén»). Las recientes ya cubren el 80 %;
   las favoritas con etiqueta piden una tabla y una pantalla de gestión.
4. **Web = app.** La web tiene el pedido, el seguimiento y la negociación, pero
   la experiencia buena hoy es la app. Antes de invertir en igualarlas, decidid
   si la web es para captar (landing + pedir) o para operar también.
