# Comprobaciones antes de publicar

Dos fallos llegaron al móvil del cliente por el mismo motivo: **la app usaba
algo que no existía**, y ni Metro ni el empaquetado lo detectan porque es
JavaScript perfectamente válido. Solo revienta cuando alguien abre esa pantalla.

- `Property 'bottomPad' doesn't exist` — variable usada y nunca declarada.
- `Property 'PHASE_GAP_SECONDS' doesn't exist` — lo mismo.
- `driver_profiles.rating` — columna pintada en tres pantallas que **nunca se
  creó**: la valoración salía vacía y nadie se enteraba.

Para que no vuelva a pasar, hay dos comprobaciones que se ejecutan en un
segundo. **Pásalas siempre antes de publicar una OTA o lanzar un APK:**

```bash
cd mobile
SUPABASE_PAT=<el token> npm run check
```

## Qué comprueba cada una

### `npm run check:code` — identificadores sin declarar

Recorre el árbol de sintaxis de `app/`, `components/` y `lib/`, recoge todo lo
declarado en cada fichero (imports, variables, funciones, parámetros,
desestructuraciones) y lo compara con todo lo referenciado. Si algo se usa sin
existir, lo dice con fichero y línea.

Entiende `<Stack.Screen>` (lo que hay que importar es `Stack`), los métodos de
objeto y las desestructuraciones anidadas, así que no da falsos positivos.

### `npm run check:db` — lo que la app le pide a la base de datos

Extrae del código **todas** las funciones (`.rpc("…")`), tablas (`.from("…")`) y
columnas (de los `select`, los filtros y los `order`) y las contrasta con el
esquema real de producción. Si la app pide una columna que no existe, sale
antes de que la vea un cliente.

## Pruebas en vivo que conviene repetir

Están escritas y se lanzan a mano cuando se toca esa parte:

| Qué prueba | Cuándo repetirla |
|---|---|
| Las seis fases y el margen de 2 minutos | Al tocar `advance_job_phase` o la pantalla del servicio |
| Cancelación con penalización (5 casos) | Al tocar tarifas o la política de cancelación |
| Seguimiento en vivo del cliente | Al tocar Realtime, canales o RLS |
| Dos suscripciones al mismo pedido | Al tocar `useOrder`, el chat o los canales |
| Enlace público de seguimiento | Al tocar `track_by_token` o la RLS |

La última existe porque el chat se rompió justo por ahí: dos pantallas abiertas
a la vez pedían el mismo canal y la segunda reventaba.
