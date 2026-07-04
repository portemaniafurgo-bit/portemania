# ClicyVoy 🚐

> Antes **PorteManía** — renombrado el 2026-07-04. La carpeta del proyecto y el repo conservan el nombre técnico original.

Plataforma web **responsive** de transporte y portes **on-demand** ("un Uber de furgonetas") para **Albacete capital**. Conecta a clientes que necesitan mover mercancía con conductores autónomos verificados.

- **Producción:** https://clicyvoy.vercel.app (también responde https://pontemania.vercel.app)
- **Repositorio:** https://github.com/portemaniafurgo-bit/portemania
- **Seguimiento del proyecto** (cronología, estado, roadmap): [docs/SEGUIMIENTO.md](./docs/SEGUIMIENTO.md)
- **Estado:** portado, funcional y desplegado (2026-07-01); migrado a infraestructura propia (Supabase `dnehzwrqphqpkcdjwqfi` + repo oficial) el 2026-07-02. Preparado para ampliación.

---

## 1. Contexto y objetivo del proyecto

Este proyecto **nació en Base44** (un constructor de apps con IA). La versión original vive en https://portemania-on-demand.base44.app/ y su código fuente exportado (React + Vite) se conserva en la carpeta [`base44/`](./base44) **como referencia**.

El objetivo fue **rehacerlo "como merece"**: código fuente propio, profesional y organizado, con un stack estándar y sostenible (Next.js + Supabase + Vercel), **sin depender de Base44 AI**, manteniendo el **diseño exactamente igual** al original y dejándolo **100% funcional** para poder **ampliarlo** después.

Criterios de éxito que guiaron el trabajo:
1. **Diseño idéntico** a la referencia.
2. **Completamente funcional** (no solo fachada).
3. **Código organizado**.
4. **Probado**.

> La carpeta `base44/` es SOLO referencia local (diseño y comportamiento): no está en el repo (`.gitignore`) ni en el build (`.vercelignore`). No se usa Base44 en tiempo de ejecución.

---

## 2. ¿Qué hace la aplicación?

Servicio de portes dentro de Albacete capital (CP 02001–02008). Dos tamaños de furgoneta (tarifa por 2h + extras; precios editables en Admin → Ajustes):

| Vehículo | Base (2h) | Con ayuda del conductor |
|---|---|---|
| Furgoneta pequeña | 40 € | 70 € |
| Furgoneta grande | 60 € | 90 € |

Hora extra: **15 €/h**. Seguro de mercancía: **12 €**. Ayuda del conductor (subir/bajar): **+30 €**. Sin ayuda, la mercancía debe estar preparada a pie de calle. Pago con **tarjeta** (Stripe) o **efectivo** al conductor.

### Roles y áreas
- **Público**: landing, solicitud como invitado (sin cuenta), candidatura de conductor (`/ser-conductor`), páginas legales.
- **Cliente**: panel, nueva solicitud (asistente de 4 pasos con fotos), mis pedidos, detalle con **seguimiento en tiempo real + chat + mapa**, pago, perfil.
- **Conductor**: panel, solicitudes disponibles, trabajo activo, historial, ganancias, perfil (documentación + fotos del vehículo).
- **Admin**: dashboard, usuarios, conductores, pedidos, incidencias, ajustes, alta de trabajadores/conductores.

### Ciclo de vida de un pedido
`pending` → `accepted` → `in_transit` → `picked_up` → `delivered` (o `cancelled`).

---

## 3. Stack técnico

- **Next.js 16** (App Router, JavaScript/JSX). ⚠️ Es una versión con cambios de convenciones — ver [`AGENTS.md`](./AGENTS.md) (p. ej. `middleware` → `proxy`). Consultar `node_modules/next/dist/docs/` antes de tocar convenciones del framework.
- **Tailwind CSS v3.4** — fijado a v3 a propósito para replicar **exactamente** los tokens de la referencia (Next 16 trae Tailwind v4, que cambiaría el sistema de diseño).
- **Supabase** — Auth, Postgres (con RLS), Realtime y Storage.
- **Vercel** — hosting/deploy.
- **Mapas**: **Leaflet + OpenStreetMap** (gratis, sin API key) + **Geolocation API** + **Supabase Realtime** para la posición del conductor en vivo. Se evitó Google Maps (de pago). Centro por defecto: Albacete (39.0, -1.86).
- UI: **shadcn/ui** (Radix) + **framer-motion** + **lucide-react**. Datos: **@tanstack/react-query**. Pagos: **Stripe**.

### Sistema de diseño (idéntico a la referencia)
- Primario azul `hsl(217 91% 60%)`, radius `0.75rem`, tokens HSL en `src/app/globals.css`.
- Fuentes: **Space Grotesk** (display/heading) e **Inter** (body).
- Marca: Clic**yVoy** (la segunda mitad en color primario).

---

## 4. Estructura del proyecto

```
pontemania/
├─ base44/                    # 📁 REFERENCIA local (export original de Base44 — no está en el repo)
├─ supabase/
│  ├─ migrations/             # Esquema completo versionado (tablas, RLS, triggers, buckets)
│  └─ functions/invite-user/  # Edge Function: alta de usuarios por el admin
├─ src/
│  ├─ app/
│  │  ├─ page.js              # Landing público
│  │  ├─ layout.js            # Layout raíz + <Providers>
│  │  ├─ globals.css          # Tokens de diseño (idénticos a la referencia)
│  │  ├─ terminos|privacidad|cookies/   # Legales
│  │  ├─ bienvenida|login|login-clientes|login-conductores/  # Auth
│  │  ├─ register/            # Registro (page.jsx + RegisterContent.jsx por Suspense)
│  │  ├─ forgot-password|reset-password/
│  │  ├─ solicitar/           # Solicitud como INVITADO (GuestRequestContent.jsx)
│  │  ├─ ser-conductor/       # Candidatura pública de conductor (furgoneta, autónomo, disponibilidad)
│  │  ├─ solicitud-enviada/
│  │  └─ (app)/               # Grupo de rutas AUTENTICADAS
│  │     ├─ layout.jsx        # Guard de sesión + AppLayout (sidebar por rol)
│  │     ├─ dashboard | new-request | my-orders | order/[id] | payment/[id] | profile/   # Cliente
│  │     ├─ driver | driver/requests | driver/job/[id] | driver/history | driver/earnings | driver/profile/
│  │     └─ admin | admin/users | admin/drivers | admin/orders | admin/incidents | admin/settings | admin/workers/
│  ├─ components/
│  │  ├─ ui/                  # Primitivas shadcn (button, input, dialog, select, ...)
│  │  ├─ common/              # Logo, VehicleCard, StatusBadge, Rating*, StatsCard, PhotoLightbox, DriverTrackingMap
│  │  ├─ landing/             # LandingNavbar, HeroSection, HowItWorks, VehiclesSection, Footer
│  │  ├─ layout/AppLayout.jsx # Shell con sidebar (cliente/conductor/admin)
│  │  ├─ AuthLayout.jsx, GoogleIcon.jsx
│  │  └─ Providers.jsx        # AuthProvider + QueryClient + Toasters
│  ├─ lib/
│  │  ├─ supabase/            # client.js, server.js, middleware.js, config.js
│  │  ├─ entities.js          # Factory de entidades sobre Supabase (.list/.filter/.get/.create/.update/.delete/.subscribe)
│  │  ├─ AuthContext.jsx      # Sesión Supabase + perfil/rol
│  │  ├─ query-client.js
│  │  └─ utils.js             # cn()
│  ├─ api/base44Client.js     # 🔑 SHIM de compatibilidad Base44 → Supabase
│  └─ proxy.js                # Refresco de sesión (Next 16: sustituye a middleware)
├─ tailwind.config.js, postcss.config.mjs, next.config.mjs
└─ .env.local                 # Variables (no versionado)
```

### La pieza clave: el shim `src/api/base44Client.js`
Para portar las ~30 páginas **sin reescribir su lógica de datos**, se creó un objeto `base44` que **imita la API del SDK de Base44** pero funciona contra Supabase:

- `base44.entities.{TransportRequest, DriverProfile, ChatMessage, Incident, User}` → cada uno con `.list / .filter / .get / .create / .update / .delete / .subscribe` (Realtime).
- `base44.integrations.Core.UploadFile` → sube a Supabase Storage y devuelve `{ file_url }`.
- `base44.integrations.Core.SendEmail` → best-effort vía Edge Function (hoy no-op si no hay proveedor).
- `base44.auth.{ me, logout, updateMe, loginViaEmailPassword, loginWithProvider, register, verifyOtp, resendOtp, resetPasswordRequest, resetPassword }`.
- `base44.users.inviteUser(email, role)` → crea usuarios vía Edge Function con service role.

Así, las páginas portadas solo cambiaron: `react-router` → App Router de Next, y siguen usando `import { base44 } from "@/api/base44Client"`.

---

## 5. Base de datos (Supabase)

Proyecto Supabase: (`dnehzwrqphqpkcdjwqfi`, región eu-west-2, cuenta portemaniafurgo-bit).
URL: `https://dnehzwrqphqpkcdjwqfi.supabase.co`

> El esquema completo está **versionado** en [`supabase/migrations/`](./supabase/migrations) y la Edge Function en [`supabase/functions/`](./supabase/functions) — la BD se puede recrear desde cero con ese SQL (Management API o SQL Editor). El proyecto original del port (`onivkquggfshyjqfpuuw`, eu-west-1) queda como copia histórica.

**6 tablas** (todas con RLS activado):

| Tabla | Descripción |
|---|---|
| `profiles` | Usuarios (1:1 con `auth.users`). Campos: role (`client`/`driver`/`admin`), full_name, phone, photo_url. |
| `driver_profiles` | Datos del conductor: estado (verified…), vehículo, documentación, fotos, `current_lat/lng`, rating, viajes. |
| `transport_requests` | Pedidos: ruta, coordenadas, carga+fotos, vehículo, precio, pago, estado, conductor, valoración, tiempos. |
| `chat_messages` | Chat cliente↔conductor por pedido. |
| `incidents` | Incidencias (tipo, prioridad, estado, resolución). |
| `driver_applications` | Candidaturas de `/ser-conductor` (alta vía RPC anónima; las gestiona el admin en Conductores). |

> Las entidades `Worker` y `AppSettings` del original de Base44 no se usaban en ninguna página, así que se eliminaron del shim y del esquema (limpieza 2026-07-02).

**Convenciones** (heredadas de Base44): cada fila tiene `id`, `created_date`, `updated_date`, `created_by`, `created_by_id`.

**Automatismos (triggers/functions):**
- `handle_new_user` → crea el `profiles` automáticamente al registrarse (lee `role` de metadata).
- `set_created_by` → rellena `created_by_id = auth.uid()` en cada insert (clave para que la RLS deje ver "lo mío").
- `set_updated_date` → mantiene `updated_date`.
- `is_admin()` → usada por las políticas RLS (rol admin o email maestro `renato.0550.calero@gmail.com`).

**Realtime** activado en: `transport_requests`, `chat_messages`, `driver_profiles` (seguimiento en vivo + chat).

**Storage** (buckets públicos): `cargo-photos`, `avatars`, `driver-docs`.

**Edge Function** `invite-user`: crea usuarios (conductor/trabajador) con service role; incluye bootstrap para el admin maestro.

> Todo lo anterior (tablas, triggers, funciones, RLS, realtime y buckets) se crea con [`supabase/migrations/0001_init_portemania_schema.sql`](./supabase/migrations/0001_init_portemania_schema.sql).

---

## 6. Puesta en marcha (local)

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # build de producción (32 rutas)
```

### Variables de entorno (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://dnehzwrqphqpkcdjwqfi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publishable del dashboard>
# Opcional para pago real:
# NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_...
```
> Nota: hay un **fallback embebido** de estas claves *publishable* (públicas por diseño; los datos están protegidos por RLS) en `src/lib/supabase/config.js`, para que el build funcione aunque falten las env vars. Los datos sensibles nunca están en el cliente.

---

## 7. Despliegue (Vercel)

Desplegado en la cuenta **rodriguezmartinezlw** (team `luis-projects`). El CLI ya está autenticado en esta máquina.

```bash
npx vercel deploy --prod --yes
```
Producción: **https://pontemania.vercel.app**

---

## 8. Credenciales de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `renato.0550.calero@gmail.com` | `PorteMania2026!` |
| Conductor | `conductor.test@portemania.es` | `Conductor2026!` |
| Cliente | `cliente.test@portemania.es` | `Cliente2026!` |

Flujo probado end-to-end (respetando RLS): cliente crea pedido → ve el suyo → conductor ve pendientes → acepta → chat → admin gestiona.

---

## 9. Pendiente de configurar (no bloquea el núcleo)

Ajustes de dashboard/entorno para activar funciones secundarias:

1. ~~**Google OAuth**~~ ✅ provider activo (proyecto Google "portemania", cuenta portemaniafurgo@gmail.com). ⚠️ La pantalla de consentimiento está en modo *Testing*: solo los test users añadidos en Google Cloud pueden usar "Continuar con Google" hasta publicarla.
2. ~~**Registro por email**~~ ✅ registro instantáneo (Confirm email desactivado).
3. ~~**Reset password** — Redirect URLs~~ ✅ configurado (site URL + allowlist con prod y localhost, 2026-07-02).
4. ~~**Edge Function `invite-user`**~~ ✅ desplegada (con `verify_jwt` activado; autoriza solo admins). Código versionado en `supabase/functions/invite-user/`.
5. ~~**Stripe**~~ ✅ `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` configurada (clave **de test** `pk_test_`; cambiar a `pk_live_` al ir a producción real).
6. ~~**Emails a conductores**~~ ✅ Edge Function `send-email` con **Resend** (allowlist de destinatarios: admins + conductores verificados). ⚠️ Sin dominio verificado en Resend se envía desde `onboarding@resend.dev` y solo entrega al email del negocio; verificar dominio para entregar a conductores.

---

## 10. Próximos pasos / ampliación

- ~~Geocoding y rutas reales~~ ✅ el detalle del pedido muestra **ETA en vivo** (Nominatim geocodifica la dirección + OSRM calcula la ruta; fallback aproximado si el router no responde). Pendiente: usar lo mismo para la distancia del precio.
- Reemplazar la distancia simulada del precio por cálculo real origen→destino.
- Llamada cliente↔conductor con número fijo enmascarado (Twilio/Zadarma) — decidido empezar sin ello.
- Emails transaccionales (proveedor real).
- Endurecer el flujo de pagos (webhook de Stripe, confirmación server-side).
- Tests automatizados (unit/e2e).
