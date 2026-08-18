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
| Cancelar ya asignado | Permitido, con penalización | ⚠️ **Pendiente de tu decisión** (ver abajo) |

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

## Lo que queda, y por qué no lo he hecho solo

1. **Cancelación del cliente con conductor ya asignado.** Uber, Bolt y Cabify la
   permiten cobrando una penalización a partir de X minutos. El código está
   listo (aviso al conductor incluido), pero **el importe y el plazo son
   decisión de negocio**: dime «5 € pasados 2 minutos» o lo que sea y lo activo.
2. **Chat con respuestas rápidas** («voy llegando», «estoy en la puerta»). Uber
   las tiene porque nadie escribe conduciendo. Es media hora de trabajo, pero
   conviene que las frases las decidáis vosotros.
3. **Favoritas con nombre** («casa», «almacén»). Las recientes ya cubren el 80 %;
   las favoritas con etiqueta piden una tabla y una pantalla de gestión.
4. **Web = app.** La web tiene el pedido, el seguimiento y la negociación, pero
   la experiencia buena hoy es la app. Antes de invertir en igualarlas, decidid
   si la web es para captar (landing + pedir) o para operar también.
