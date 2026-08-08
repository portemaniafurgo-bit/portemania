# Tests E2E (Playwright, contra producción)

Suites que verifican la app real en https://pontemania.vercel.app.
Crean sus propios datos, los verifican y los borran al terminar.

```bash
npm i -D playwright && npx playwright install chromium   # una vez
node e2e/flows.cjs    # invitado + conductor + cliente (34 checks)
node e2e/admin.cjs    # panel de administración (38 checks)
```

- Requieren `.env.local` en la raíz (leen la anon key para sembrar/limpiar por API).
- Admin: exportar `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASS` con un admin temporal
  (NO usar la cuenta del dueño; crear una y borrarla al acabar).
- Las capturas se guardan en `./shots/`.
- Nota Playwright: `isVisible()` NO espera — usar el helper `visible()` de las suites.

## Cuentas de prueba (no existen por defecto)

Las suites usan `cliente.test@portemania.es` / `Cliente2026!` y
`conductor.test@portemania.es` / `Conductor2026!`. Se BORRAN tras cada campaña
de pruebas; hay que recrearlas antes de correr (SQL vía Management API) y
borrarlas al terminar. Gotchas aprendidos (2026-08-08):

1. **Insert manual en `auth.users`**: las columnas de token (`confirmation_token`,
   `recovery_token`, `email_change*`, `phone_change*`, `reauthentication_token`)
   deben ser `''` y NO `NULL`, o el login devuelve 500 «Database error querying
   schema».
2. **El conductor necesita la documentación COMPLETA** en `driver_profiles`
   (selfie, carnet, 4 fotos del vehículo, marca+matrícula, recibo de autónomo y
   censal — URLs cualquiera valen) además de `status='verified'`,
   `vehicle_type='large'` e `is_available=true`; si falta algo, el panel muestra
   «Completa tu perfil» y no ve pendientes.
3. **Con ayuda contratada**, el asistente exige responder «¿Hay ascensor?» en
   ambas direcciones para poder continuar (las suites ya lo hacen).
