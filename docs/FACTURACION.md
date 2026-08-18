# Facturación: quién emite y con qué datos

Actualizado el 18/08/2026. Migración `0016_facturacion.sql` (aplicada y
verificada en producción).

---

## El planteamiento

El servicio lo presta el **conductor, que es transportista autónomo**. Por tanto
la factura del transporte **es suya**: él es el emisor, con su nombre fiscal y su
NIF. ClicyVoy es la plataforma que pone en contacto a las dos partes y gestiona
el cobro.

Eso obliga a tres cosas que antes no existían:

| Hacía falta | Antes | Ahora |
|---|---|---|
| Datos del **emisor** | El recibo salía a nombre de ClicyVoy | Nombre fiscal, NIF y dirección del conductor |
| Datos del **receptor** | Solo el nombre de pila del cliente | Razón social o nombre, NIF/CIF y dirección fiscal |
| **Numeración correlativa** | «Recibo 3f8a9c» (el id del pedido) | `A2026/001`, correlativo **por conductor y año** |

---

## Dónde se piden los datos

- **Cliente:** al registrarse puede rellenarlos, y siempre desde
  **Perfil → Datos de facturación**. Son opcionales: quien pide un porte para su
  casa no rellena nada y recibe un **recibo**; quien lo necesita para su empresa
  rellena NIF y dirección una vez y a partir de ahí recibe **factura**.
- **Conductor:** en **Perfil → Datos de facturación**, junto a su documentación.
  Sin NIF no puede emitir factura, y la app se lo advierte («Falta el NIF»).

---

## Cómo se numera

`assign_invoice_number(pedido)` asigna el número la primera vez que se descarga
la factura de un servicio **entregado**:

- Formato `<serie><año>/<correlativo>` — por ejemplo `A2026/014`.
- El correlativo es **por conductor**: dos autónomos no comparten numeración.
  Cada uno tiene su serie en `driver_profiles.invoice_series` (por defecto `A`).
- La fila del conductor se bloquea (`FOR UPDATE`) mientras se calcula, así que
  dos servicios terminados a la vez no pueden llevarse el mismo número.
- **Nunca renumera**: si el pedido ya tiene número, devuelve el que tiene.
  Probado: dos llamadas seguidas devuelven `A2026/001`.

---

## Qué sale en el documento

- Emisor (conductor autónomo): nombre fiscal, NIF, dirección.
- Receptor: los datos de facturación del cliente, si los tiene.
- Concepto: el servicio y el trayecto.
- **Base imponible, IVA y total.** El precio que ve el cliente ya lleva IVA
  incluido, así que la base se calcula hacia atrás. El tipo vive en las tarifas
  (`app_settings.tariffs.vat_rate`, hoy 21) y se cambia desde el panel sin tocar
  código.
- La propina se lista aparte y **no lleva IVA**: no es contraprestación del
  servicio.
- Forma de pago y si está cobrado.

Si el conductor todavía no ha puesto su NIF, el documento **se rotula como
recibo**, no como factura: un papel que dice «factura» sin NIF del emisor no vale
para nada y da una falsa seguridad al cliente.

---

## Pendiente de decidir contigo

1. **Retención de IRPF.** Un autónomo que factura a una empresa suele aplicar
   retención (15 %, o 7 % los dos primeros años). Hoy la factura no la incluye.
   Hay que decidir si ClicyVoy la calcula o si cada conductor lo lleva por su
   cuenta con su gestor.
2. **Quién cobra a quién.** Hoy el cliente paga a ClicyVoy y ClicyVoy liquida al
   conductor (comisión del 15 %). Fiscalmente eso significa que el conductor
   factura su servicio y ClicyVoy le factura su comisión: **falta la factura de
   la comisión**, que también hay que emitir.
3. **Copia para el conductor.** Ahora mismo la factura la descarga el cliente. Lo
   normal es que el conductor tenga también las suyas en la app, para su
   trimestre. Es una pantalla más («Mis facturas» en el perfil del conductor).
4. **Numeración ya existente.** Si algún conductor ya venía facturando por su
   cuenta con otra numeración, hay que darle su serie propia
   (`invoice_series`) para no romper su correlativo.
