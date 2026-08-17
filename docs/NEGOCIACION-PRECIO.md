# Negociación de precio (modelo inDrive) — diseño técnico

> **2026-08-12.** El cliente puede proponer su precio al pedir; los conductores
> lo aceptan o contraofertan; el cliente acepta una contraoferta o espera.
> El pedido arranca con el **precio pactado**. Afecta a BD, pagos, web y app.
> El diseño visual de las pantallas está en el canvas de Claude Design
> (pantallas 1e, 1g, 1i, 1j) y su inventario en
> [DESCRIPCION-APP-PARA-REDISENO.md](DESCRIPCION-APP-PARA-REDISENO.md).

## 1. Reglas de producto

1. **Ofertar es opcional**: si el cliente no propone precio, el flujo actual
   (precio calculado, primer conductor que acepta) sigue intacto. Cero cambios
   para quien no negocia — incluido el invitado web y los programados.
2. El precio calculado (`compute_quote`) **sigue siendo la referencia**: la
   oferta del cliente no puede bajar de un suelo (60 % del calculado) para
   evitar ofertas basura; las contraofertas se mueven entre 5 y 500 €.
3. Un conductor tiene **una contraoferta viva por pedido** (puede cambiarla:
   reemplaza la anterior).
4. El conductor también puede **aceptar directamente el precio del cliente**.
5. Cuando una parte acepta: pedido → `accepted` con ese conductor y
   `final_price` = importe pactado; el resto de contraofertas quedan
   rechazadas. Las carreras se resuelven igual que hoy (update condicionado).
6. La negociación vive mientras el pedido esté `pending`; si se cancela o se
   acepta, muere con él.

## 2. Modelo de datos (migración 0014)

- `transport_requests.proposed_price numeric` — la oferta del cliente
  (NULL = sin negociación). Suelo validado por trigger: ≥ 60 % de
  `estimated_price`.
- **Tabla `price_offers`**: `id, request_id → transport_requests (cascade),
  driver_id (auth.users), driver_name, amount numeric (5–500), message text,
  status ('pending'|'accepted'|'rejected'|'superseded'), created_date,
  updated_date`. Única viva por (request_id, driver_id): al contraofertar de
  nuevo, la anterior pasa a `superseded`.
- Realtime activado en `price_offers` (el cliente ve llegar contraofertas en
  vivo).

### RLS de `price_offers`

- SELECT: el conductor ve las suyas; el dueño del pedido ve todas las de su
  pedido; staff todo.
- INSERT/UPDATE/DELETE directos: **nadie** (todo pasa por RPCs security
  definer, que validan estado y autoría). Es dinero: cero escrituras libres.

### RPCs (security definer; el trigger de protección de `final_price` permite
escribirlo a postgres)

1. `make_price_offer(p_request_id, p_amount, p_message)` — conductor
   verificado, no bloqueado por docs, pedido `pending`; 5 ≤ amount ≤ 500;
   marca `superseded` su oferta anterior e inserta la nueva.
2. `accept_price_offer(p_offer_id)` — SOLO el dueño del pedido; oferta y
   pedido vivos; transaccional: pedido → accepted + driver + accepted_at +
   `final_price = amount`; la oferta → accepted; las demás → rejected.
   Condicionado a `status='pending'` (anti-carrera).
3. `accept_at_client_price(p_request_id)` — el conductor acepta el precio
   propuesto del cliente: mismo update condicionado de hoy + `final_price =
   proposed_price`. (Necesita RPC porque un conductor normal no puede escribir
   `final_price` por el trigger de 0007.)
4. `reject_price_offer(p_offer_id)` — el dueño descarta una contraoferta.

## 3. Pagos — el único cambio delicado

`create-payment-intent` cobraba SIEMPRE `compute_quote`. Con precio pactado
debe cobrar el pactado: **`amount = final_price` si existe; si no,
`compute_quote`** (el pactado solo lo escriben las RPCs o el staff, así que no
es manipulable por el cliente). `confirm-payment` no cambia (verifica el cargo
real). Ganancias del conductor, recibo y finanzas ya usaban
`final_price || estimated_price` — el pactado fluye solo.

## 4. Superficies

**App cliente**: paso «Tu precio» del asistente (opcional, con el suelo
visible); en el pedido `pending`, panel vivo de contraofertas (foto,
valoración, furgoneta, importe, mensaje) con Aceptar/Rechazar; push
`price_offer` al recibir una.
**App conductor**: la oferta muestra el precio del cliente (si negocia);
botones «Aceptar por X €» y «Contraofertar» (hoja con +/− y motivo); push
`offer_accepted`/`offer_rejected`.
**Web cliente** (`/order/[id]` y asistente): mismo panel y campo opcional.
**Web conductor** (`/driver/requests`): precio propuesto + contraoferta.
**Admin**: los pedidos con negociación muestran propuesto/pactado (columna ya
existente `final_price`); nada estructural.
**send-push**: modos nuevos `price_offer` (→ cliente) y `offer_accepted`
(→ conductor), con las mismas garantías (el servidor deriva destinatarios).

## 5. Orden de implementación

1. ✅ Migración 0014 + RPCs + Realtime (este documento acompaña su commit).
2. `create-payment-intent` con precio pactado (+ verificación).
3. Web conductor + web cliente.
4. App: pantallas del canvas (1e, 1g, 1i, 1j) dentro del rediseño general.
5. Push de negociación cuando haya Firebase.
