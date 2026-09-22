# Publicar ClicyVoy en Google Play — runbook completo

> Escrito el **2026-09-22** para dos lectores a la vez: **Claude Code en otra
> sesión, sin contexto**, y **Luis**, que tiene que saber qué le toca a él.
> Léelo entero antes de tocar nada. Documentos hermanos:
> [BRIEF-CLAUDE-CHROME-PLAY.md](BRIEF-CLAUDE-CHROME-PLAY.md) (lo que hace el
> agente del navegador), [PUSH-NOTIFICACIONES.md](PUSH-NOTIFICACIONES.md)
> (avisos) y [`mobile/store/`](../mobile/store/) (textos y gráficos de la ficha).

---

## 1. Estado (2026-09-22)

### Listo en código

- [x] `mobile/app.json`: versión **1.0.0**, permisos sin duplicados,
      `RECORD_AUDIO` fuera de la lista (solo en `blockedPermissions`), plugin
      `expo-notifications` con icono y sonido propios.
- [x] `mobile/app.config.js`: engancha el `google-services.json` de Firebase
      cuando exista (fichero local **o** variable de entorno de EAS). Sin él, la
      build sale igual, solo que sin push.
- [x] `mobile/.gitignore`: credenciales (Firebase, Play, keystores) fuera del repo.
- [x] `mobile/eas.json`: `submit.production` apunta a `./play-service-account.json`,
      pista `internal`, estado `draft`.
- [x] Sonido propio del aviso de oferta: `mobile/assets/sounds/oferta.wav`
      (`node scripts/generate-notification-sound.mjs`) + canales Android con
      sonido, vibración y visibilidad en pantalla de bloqueo
      (`mobile/lib/push.js`).
- [x] **Divulgación destacada** de ubicación en segundo plano antes del permiso
      (`mobile/lib/locationDisclosure.js`, mostrada desde
      `mobile/app/(conductor)/job/[id].js`). Es requisito de política, no un
      detalle de UX.
- [x] Borrado de cuenta en la app (`mobile/components/DeleteAccount.js`, RPC
      `delete_own_account`) **y** página pública `https://clicyvoy.es/eliminar-cuenta`.
- [x] Icono de notificación, icono 512 y gráfico de cabecera
      (`node scripts/generate-store-assets.mjs`).
- [x] Textos de la ficha con el recuento de caracteres: `mobile/store/listing.es.md`.

### Lo que bloquea la publicación (nada de esto es código)

| # | Bloqueo | De quién depende |
|---|---|---|
| 1 | **Cuenta de Play Console** (25 USD, pago único) | Luis paga; Claude Chrome rellena |
| 2 | **Proyecto de Firebase** + `google-services.json` + clave FCM V1 | Claude Chrome |
| 3 | **Consent screen de Google Cloud** publicada (hoy en *Testing*) | Claude Chrome |
| 4 | **Claves Stripe live** (hoy son de prueba) | Decisión de Luis |
| 5 | **Capturas de pantalla** en un móvil real | Luis (con adb) |
| 6 | **Cuentas de prueba** para los revisores de Google | Claude Code (SQL) |

---

## 2. Cuentas y quién hace qué

Todo se hace con la cuenta del negocio **portemaniafurgo@gmail.com**. Nada con
cuentas personales: una app publicada desde una cuenta personal no se puede
mover después sin pelearse con el soporte de Google.

| Quién | Hace |
|---|---|
| **Claude Chrome** (agente en el navegador de Luis) | Consolas de Google: Firebase, Google Cloud, Play Console. Formularios, subidas y descargas. |
| **Claude Code** (terminal, este repo) | Código, builds de EAS, credenciales por CLI, commits. Prepara los ficheros que sube Claude Chrome. |
| **Luis** | Paga los 25 USD, instala el APK/AAB, hace las capturas en su Xiaomi y decide cuándo se pasa Stripe a live. |

### ⚠️ Cuenta PERSONAL vs cuenta de ORGANIZACIÓN — decidir ANTES de pagar

**Si la cuenta de Play Console se crea como cuenta PERSONAL, Google exige una
prueba cerrada con 12 testers o más, participando durante 14 días seguidos,
antes de poder siquiera solicitar la publicación en producción.** Con una cuenta
de **ORGANIZACIÓN** ese requisito no aplica.

- **Recomendado**: crear la cuenta como **organización** si el negocio tiene CIF.
  Google pide el nombre legal, el CIF/NIF, la dirección fiscal y un **número
  DUNS** (gratis, lo emite Dun & Bradstreet; tarda de días a un par de semanas,
  así que **hay que pedirlo el primer día**).
- **Alternativa** si no hay CIF o corre prisa: cuenta personal, y entonces hay
  que juntar **12 correos de Google reales** (familia, amigos, conductores) que
  instalen la app desde la prueba cerrada y la tengan 14 días. No vale con 12
  cuentas inventadas: Google mide dispositivos e instalaciones activas.
- En los dos casos, la **prueba interna** (hasta 100 testers) funciona desde el
  primer día y no cuenta para esos 14 días: sirve para que Luis y los
  conductores prueben la app real ya.

---

## 3. Push: el proyecto de Firebase

### Cómo funciona, en seis líneas

1. La app pide un **token de Expo Push** al arrancar (`mobile/lib/push.js`).
2. Expo solo puede emitir ese token si la build lleva el `google-services.json`
   del proyecto de Firebase: Expo entrega los avisos a Android **a través de
   FCM**.
3. El token se guarda en la tabla `push_tokens` de Supabase (con el usuario y el
   dispositivo).
4. La Edge Function **`send-push`** es la única puerta de salida: recibe un
   `mode`, lee el pedido en la base de datos y decide a quién avisar.
5. `send-push` manda el `channelId` (`ofertas` o `estado`); el **sonido y la
   vibración** los pone el canal de Android, definido en `ensureChannels()` de
   `mobile/lib/push.js`.
6. Sin Firebase, `getExpoPushTokenAsync` falla, no hay tokens y `send-push`
   responde `{"sent":0,"total":0}`: no es un bug, es una credencial que falta.

### Pasos exactos

1. **Crear el proyecto** en https://console.firebase.google.com con el nombre
   **ClicyVoy** (Analytics: opcional, se puede decir que no).
2. **Añadir una app Android** con el nombre de paquete exacto
   **`com.clicyvoy.app`**. El SHA-1 no hace falta (el login con Google entra por
   navegador vía Supabase, no por el SDK nativo).
3. **Descargar `google-services.json`** y guardarlo en **`mobile/google-services.json`**
   (está en `.gitignore`: nunca al repo).
4. **Subirlo también a EAS** como variable de entorno de tipo fichero, para que
   las builds en la nube lo tengan:
   ```bash
   cd mobile
   npx eas-cli@latest env:create --scope project --name GOOGLE_SERVICES_JSON \
     --type file --value ./google-services.json \
     --environment production --visibility secret
   npx eas-cli@latest env:create --scope project --name GOOGLE_SERVICES_JSON \
     --type file --value ./google-services.json \
     --environment preview --visibility secret
   ```
   `mobile/app.config.js` usa la variable si existe y, si no, el fichero local.
5. **Clave de cuenta de servicio para FCM V1**: en Firebase →
   *Configuración del proyecto* → *Cuentas de servicio* → **Generar nueva clave
   privada** (descarga un JSON). Subirla a EAS:
   ```bash
   cd mobile
   npx eas-cli@latest credentials -p android
   # → production → "Google Service Account Key for Push Notifications (FCM V1)"
   # → "Set up a Google Service Account Key" → subir el JSON descargado
   ```
6. **Recompilar**: el `google-services.json` es nativo, no viaja por OTA.

### Cómo comprobar que funciona

```sql
-- 1. ¿El móvil registró token? (con la app abierta y sesión iniciada)
select user_id, platform, device_name, created_date
from push_tokens order by created_date desc limit 5;
```

```bash
# 2. Aviso de prueba con un pedido pendiente real
curl -X POST "$SUPABASE_URL/functions/v1/send-push" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"mode":"new_request","order_id":"<id de un pedido pendiente>"}'
# Esperado: {"sent":N,"total":N} con N > 0
```

Si `sent` y `total` son 0, no hay tokens: falta el paso 3/4 o el móvil no dio
permiso. La matriz completa de avisos está en
[PUSH-NOTIFICACIONES.md](PUSH-NOTIFICACIONES.md).

---

## 4. Firma de la app y Play App Signing

- **No hay que generar ningún keystore a mano.** EAS ya creó uno para este
  proyecto al hacer las builds `preview`, y usará **el mismo** para la build
  `production`.
- **Play App Signing es obligatorio** para toda app nueva. Al subir el primer
  AAB, Google toma el certificado del keystore de EAS como **clave de subida**
  (la que valida que el AAB lo mandas tú) y genera **su propia clave de firma**,
  que es con la que se firma lo que llega a los móviles. No hay nada que
  configurar: se acepta la pantalla y listo.
- **El login con Google no se ve afectado**: ClicyVoy autentica con Supabase
  abriendo el navegador, no con el SDK nativo de Google Sign-In, así que no hace
  falta registrar huellas SHA-1 en ningún sitio.
- Si alguna vez hace falta ver la huella del keystore (solo lectura):
  ```bash
  cd mobile && npx eas-cli@latest credentials -p android
  ```

---

## 5. Build de producción

**Prerrequisitos** (los tres, o no tiene sentido lanzarla):

- [x] `google-services.json` subido a EAS (§3, paso 4). *(22/09/2026, `production` y `preview`)*
- [ ] `mobile/app.json` y `mobile/package.json` en **1.0.0**.
- [ ] `cd mobile && npm run check` en verde y
      `npx expo export --platform android` sin errores.

```bash
cd mobile
npx eas-cli@latest build -p android --profile production
```

- Sale un **AAB** (`buildType: app-bundle`), que es lo que acepta Play.
- El `versionCode` lo lleva EAS en remoto (`autoIncrement: true` +
  `appVersionSource: remote`): no se toca a mano.
- Al terminar, **descargar el `.aab`** del enlace que da EAS.

> ⚠️ **Regla del proyecto: NO se lanza ninguna build de EAS sin el OK explícito
> de Luis.** Las builds cuestan minutos de cola y ensucian el historial de
> versiones.

---

## 6. Primera subida y pistas de publicación

**La primera subida de una app nueva se hace A MANO en Play Console.** Google no
habilita la API de publicación hasta que existe al menos una versión subida por
la consola, así que `eas submit` **no funciona la primera vez** (falla con un
error de permisos que despista mucho).

1. Play Console → **Pruebas** → **Pruebas internas** → *Crear versión*.
2. Subir el `.aab`, poner las **novedades** (el texto de `listing.es.md`).
3. **Testers**: crear una lista con el correo de Luis y el del negocio (y los
   conductores que vayan a probar). Hasta 100.
4. *Revisar versión* → **Publicar**. La prueba interna suele estar disponible en
   minutos; copiar el **enlace de participación** y abrirlo en el móvil.
5. Solo después: pruebas cerradas (si la cuenta es personal, aquí van los 12
   testers / 14 días) y producción.

A partir de la **segunda** versión ya se puede automatizar:

1. Google Cloud → *IAM y administración* → **Cuentas de servicio** → crear una →
   **Claves** → *Añadir clave* → JSON → guardarla como
   **`mobile/play-service-account.json`** (ignorada por git).
2. Play Console → **Usuarios y permisos** → *Invitar usuario* → el correo de esa
   cuenta de servicio → permisos de *Publicar versiones* en la app.
3. ```bash
   cd mobile
   npx eas-cli@latest submit -p android --profile production --latest
   ```

---

## 7. Formularios de Play Console, con las respuestas propuestas

Están en **Política y programas** → *Contenido de la aplicación*. Hay que
completarlos TODOS o la versión no sale de revisión.

### 7.1 Acceso a la aplicación

> **Respuesta: «Todo o parte de la app está restringida»** (hay que iniciar
> sesión).

Dar dos juegos de credenciales al revisor, con instrucciones:

| Perfil | Correo | Contraseña | Nota para el revisor |
|---|---|---|---|
| Cliente | `cliente.test@portemania.es` | `Cliente2026!` | Pide un porte; el pago puede quedarse en la pantalla de pago |
| Conductor | `conductor.test@portemania.es` | `Conductor2026!` | Verificado, furgón grande, disponible: ve las ofertas |

Instrucciones que se pegan en el formulario:

```
La app tiene dos perfiles segun el tipo de cuenta. Con la cuenta de cliente:
pestana Pedir -> elegir "Porte" -> direcciones de Albacete -> ver el precio ->
confirmar. Con la cuenta de conductor: pestana Ofertas -> aceptar el pedido ->
al aceptar se muestra el aviso de ubicacion en segundo plano y despues el
permiso "Permitir todo el tiempo".
```

⚠️ **Las dos cuentas hay que crearlas justo antes de mandar a revisión y
borrarlas al terminar** (regla de `e2e/README.md`). El conductor debe quedar
**verificado** desde `/admin/drivers` y con la documentación completa, o no verá
ninguna oferta y el revisor pensará que la app está vacía.

### 7.2 Anuncios

> **No**, la app no contiene anuncios.

### 7.3 Clasificación de contenido (cuestionario IARC)

- Categoría: **Utilidad / Productividad / Comunicación / Otros**.
- Violencia: **no**. Contenido sexual: **no**. Lenguaje soez: **no**.
  Sustancias: **no**. Juegos de azar: **no**.
- ¿Permite comunicación entre usuarios? **Sí** (chat cliente ↔ conductor).
- ¿Comparte la ubicación del usuario con otros usuarios? **Sí** (el conductor
  con su cliente, solo durante el servicio).
- ¿Permite comprar productos o servicios? **Sí** (servicios físicos de
  transporte, pagados con tarjeta a través de Stripe; no hay compras dentro de
  la app de contenido digital).

Resultado esperado: **PEGI 3 / apta para todos** con avisos de interacción entre
usuarios y de compartir ubicación.

### 7.4 Público objetivo y contenido

- Grupos de edad: **18 y más**.
- ¿Va dirigida a niños? **No**. (No se marca ninguna franja infantil: la app
  contrata un servicio y cobra.)

### 7.5 Declaraciones sueltas

| Formulario | Respuesta |
|---|---|
| Aplicación de noticias | **No** |
| Aplicación relacionada con la COVID-19 | **No** |
| Aplicación gubernamental | **No** |
| Funciones financieras | **No** — los pagos son de servicios físicos y los procesa Stripe; no es una app de préstamos, inversión ni criptomonedas |
| Salud | **No** |

### 7.6 Seguridad de los datos (Data Safety)

Vale para **toda** la tabla: finalidad *funcionalidad de la aplicación* y
*gestión de la cuenta*; **cifrado en tránsito: sí**; **el usuario puede pedir el
borrado: sí** (desde la app y desde `https://clicyvoy.es/eliminar-cuenta`);
**no se vende ningún dato**; nada se usa para publicidad.

| Tipo de dato | ¿Se recoge? | ¿Se comparte? | Obligatorio | Notas |
|---|---|---|---|---|
| Nombre | Sí | Sí, con el conductor/cliente del servicio | Sí | Para identificarse en el servicio |
| Correo electrónico | Sí | No | Sí | Cuenta y avisos |
| Número de teléfono | Sí | Sí, con la otra parte del servicio | Sí | Para llamarse si hay un problema en la entrega |
| Dirección | Sí | Sí, con el conductor asignado | Sí | Recogida y entrega |
| **Ubicación precisa** | Sí | Sí, con el cliente de ese servicio | Sí (conductores) | **En segundo plano** solo en el modo conductor y solo con servicio activo |
| Fotos | Sí | No | No | Fotos de la carga, prueba de entrega y documentación del conductor |
| Mensajes en la app | Sí | Sí, con la otra parte | No | Chat del servicio |
| Información de pago | No se almacena | — | — | La procesa **Stripe**; ClicyVoy no guarda datos de tarjeta |
| ID de usuario | Sí | No | Sí | Identificador de cuenta |
| ID de dispositivo | Sí | No | Sí | Token de notificaciones push |
| Historial de pedidos / compras | Sí | No | Sí | Servicios realizados y recibos |
| Registros de fallos / diagnóstico | No | — | — | Sentry aún no está activado (T8) |

### 7.7 Permisos sensibles

**Ubicación en segundo plano (`ACCESS_BACKGROUND_LOCATION`)** — justificación
propuesta (≤ 500 caracteres):

```
ClicyVoy conecta clientes con conductores de furgoneta. Cuando un conductor
acepta un servicio, la app envía su ubicación para que el cliente vea en el mapa
dónde está y cuándo va a llegar. El conductor conduce con el móvil bloqueado o
usando el navegador, así que la ubicación debe seguir enviándose en segundo
plano: sin ella la posición se congela y el cliente no sabe si va de camino. Se
activa solo con un servicio aceptado y se detiene al entregarlo o cancelarlo.
```

**El vídeo de la declaración de permisos** (obligatorio, enlace de YouTube no
listado, ≤ 30 s; grabar con el móvil o con `adb shell screenrecord`). Tiene que
mostrar, en este orden y sin cortes:

1. El **diálogo de divulgación destacada** de la app: «Tu ubicación durante el
   servicio…» (el de `mobile/lib/locationDisclosure.js`), pulsando *Entendido,
   continuar*.
2. El **diálogo de permiso de Android** eligiendo **«Permitir todo el tiempo»**.
3. El **uso real**: la app del conductor en segundo plano o con la pantalla
   bloqueada, y el cliente viendo moverse el icono del conductor en el mapa.

**Servicios en primer plano (`FOREGROUND_SERVICE_LOCATION`)**: tipo
**`location`**; misma justificación, añadiendo que Android exige el servicio en
primer plano —con su notificación permanente «ClicyVoy · servicio en curso»—
para poder seguir emitiendo la posición.

### 7.8 Enlaces obligatorios

| Campo | Valor |
|---|---|
| Política de privacidad | `https://clicyvoy.es/privacidad` |
| Eliminación de la cuenta | `https://clicyvoy.es/eliminar-cuenta` |

En «Eliminación de la cuenta» hay que marcar que la app permite **borrar la
cuenta y los datos desde dentro de la app** *y* que existe una **URL pública**
para pedirlo sin instalarla.

---

## 8. Google Cloud: publicar la pantalla de consentimiento

Hoy la consent screen de OAuth está en modo **Testing**: solo entran con Google
los correos añadidos como *test users*, y el resto ve un aviso de app no
verificada. Eso rompería el «Continuar con Google» de cualquiera que instale la
app desde Play.

1. https://console.cloud.google.com → proyecto del negocio → *APIs y servicios* →
   **Pantalla de consentimiento de OAuth**.
2. Comprobar que el **nombre de la aplicación** dice **ClicyVoy** (si aún pone
   *PorteManía* o *portemania*, cambiarlo: es lo que ve el usuario al iniciar
   sesión), el correo de asistencia y el logo.
3. Dominios autorizados: `clicyvoy.es` y el dominio de Supabase que hace el
   callback.
4. **PUBLISH APP** → confirmar.

Los ámbitos que usa ClicyVoy son solo `email`, `profile` y `openid`: **no son
ámbitos sensibles ni restringidos**, así que Google no exige verificación de
seguridad ni auditoría. Si aparece un aviso de verificación, no bloquea el
inicio de sesión de los usuarios.

---

## 9. Stripe: de claves de prueba a claves live

Hoy **todo está en modo TEST** (tarjeta `4242 4242 4242 4242`). Antes de
publicar en producción hay que decidir el cambio, y son **tres sitios**:

| Dónde | Variable | Quién la escribe |
|---|---|---|
| Supabase → Edge Functions (secretos) | `STRIPE_SECRET_KEY` | Claude Code, **solo con autorización de Luis** |
| Vercel → proyecto de la web | `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | Claude Code, **solo con autorización de Luis** |
| App móvil | `EXPO_PUBLIC_STRIPE_PUBLIC_KEY`, con la `pk_test_…` incrustada como valor por defecto en **`mobile/lib/payments.js`** (líneas 19-21) | Claude Code (cambio de código + build nueva) |

⚠️ La clave publicable de la app está **dentro del bundle**: cambiarla exige una
build nueva (o pasarla como variable de entorno de EAS). No es un secreto —es
pública por diseño—, pero tiene que ser la del mismo modo que la clave secreta
del servidor, o los cobros fallan con «No such payment_intent».

> **Escrituras en producción (secretos de Supabase, variables de Vercel) solo
> con autorización explícita de Luis**, con vista previa antes y comprobación por
> lectura después.

**Google Pay**: en un Android real, Google Pay en modo producción exige además
solicitar **acceso de producción** en la Google Pay & Wallet Console (lo
documenta Stripe). Mientras no se pida, el botón de Google Pay puede no
aparecer; **el pago con tarjeta funciona igual** y no bloquea la publicación.

---

## 10. Después de publicar

- **Cambios solo de JavaScript** (textos, pantallas, lógica de la app): van por
  OTA, sin pasar por Play ni por revisión:
  ```bash
  cd mobile
  npx eas-cli@latest update --branch production --message "que se ha cambiado"
  ```
  La app instalada se lo descarga al reabrirse. El canal `production` lo fija
  `eas.json`; el `runtimeVersion` es la versión de la app, así que una OTA solo
  llega a las instalaciones con esa misma versión.
- **Cambios nativos** (permisos, plugins, iconos, sonidos del canal,
  dependencias con código nativo): **build nueva + versión nueva en Play**. Subir
  `version` en `mobile/app.json` y `mobile/package.json`, build `production` y
  subir el AAB.
- El **enlace de Play ya está puesto en la web**:
  `src/components/common/AppBanner.jsx`, constante `PLAY_URL`
  (`https://play.google.com/store/apps/details?id=com.clicyvoy.app`). Empezará a
  funcionar en cuanto la app esté publicada; hasta entonces da 404.

---

## 11. Checklist final

**Antes de mandar a revisión**

- [ ] Cuenta de Play Console creada y pagada (personal u organización — §2).
- [x] Proyecto de Firebase creado, `google-services.json` en `mobile/` y en EAS. *(22/09/2026: proyecto `clicyvoy`, nº 81320682561, app `com.clicyvoy.app`, FCM V1 habilitado)*
- [ ] Clave FCM V1 subida a EAS (`eas credentials`).
- [x] Consent screen de Google Cloud **publicada** y con el nombre *ClicyVoy*. *(22/09/2026, proyecto `portemania`; queda el aviso «marca sin verificar», que no bloquea)*
- [ ] Decidido qué se hace con Stripe (seguir en test = **no** cobrar de verdad).
- [ ] Build `production` (AAB) generada con el OK de Luis y descargada.
- [ ] Ficha rellena con los textos de `mobile/store/listing.es.md`.
- [ ] Icono 512, gráfico de cabecera y **al menos 2 capturas** subidos.
- [ ] Formularios de *Contenido de la aplicación* completos (§7).
- [ ] Vídeo de la ubicación en segundo plano subido a YouTube (no listado) y
      enlazado.
- [ ] Cuentas de prueba creadas, conductor **verificado**, credenciales en el
      formulario de acceso.
- [ ] `https://clicyvoy.es/privacidad` y `https://clicyvoy.es/eliminar-cuenta`
      responden 200 en producción.

**Después de publicar**

- [ ] Prueba interna instalada en el móvil de Luis desde el enlace de Play.
- [ ] Push recibido con la app **cerrada** (pedido nuevo → suena `oferta.wav`).
- [ ] Ciclo completo con dos móviles: pedir → aceptar → GPS con pantalla
      bloqueada → chat → firma → valoración → recibo.
- [ ] Cuentas de prueba **borradas**.
- [ ] `docs/SEGUIMIENTO.md` actualizado con la fecha de publicación.
