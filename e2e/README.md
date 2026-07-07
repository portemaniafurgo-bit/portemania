# Tests E2E (Playwright, contra producción)

Suites que verifican la app real en https://pontemania.vercel.app con las
credenciales de prueba del [README](../README.md#8-credenciales-de-prueba).
Crean sus propios datos, los verifican y los borran al terminar.

```bash
npm i -D playwright && npx playwright install chromium   # una vez
node e2e/flows.cjs    # invitado + conductor + cliente (18 checks)
node e2e/admin.cjs    # panel de administración (26 checks)
```

- Requieren `.env.local` en la raíz (leen la anon key para sembrar/limpiar por API).
- Las capturas se guardan en `./shots/`.
- Nota Playwright: `isVisible()` NO espera — usar el helper `visible()` de las suites.
