# Brief para Claude en Chrome — publicar ClicyVoy en Google Play

> Para el agente que maneja el **navegador de Luis**, con la sesión de Google
> **portemaniafurgo@gmail.com** ya iniciada. Escrito el **2026-09-22**.
> Complemento de [PLAY-STORE.md](PLAY-STORE.md), que es el runbook técnico.
> Todo lo que hay que escribir en los formularios **ya está redactado**: se copia,
> no se reescribe.

---

## Objetivo

Dejar ClicyVoy (`com.clicyvoy.app`) lista para una **prueba interna** en Google
Play: proyecto de Firebase creado, consent screen de Google publicada, cuenta de
Play Console y app creadas, ficha completa, formularios de contenido
respondidos y el AAB subido a la pista de pruebas internas.

**No se publica en producción.** Eso lo decide Luis después.

---

## Reglas (no negociables)

1. **No pagar nada sin que Luis lo confirme en pantalla.** Los 25 USD de Play
   Console los aprueba él, mirando. Si aparece cualquier otro cobro, **parar y
   preguntar**.
2. **No publicar en producción.** Solo *Pruebas internas*. Si una pantalla
   ofrece «Enviar a producción», no se toca.
3. **No cambiar el nombre de paquete.** Es `com.clicyvoy.app`, exacto, en
   minúsculas. Un paquete mal escrito no se puede corregir después: habría que
   crear otra app.
4. **No crear un segundo proyecto de Firebase** si ya hay uno de ClicyVoy:
   buscar primero en la lista de proyectos y reutilizarlo.
5. **No pegar claves ni JSON descargados en chats, documentos compartidos ni
   capturas.** Son credenciales.
6. **Cada fichero que se descargue se deja en la carpeta de Descargas** y se
   informa de su **nombre exacto** (p. ej. `google-services.json`,
   `clicyvoy-firebase-adminsdk-xxxxx.json`), para que Claude Code lo mueva a su
   sitio.
7. Si un paso pide un dato que no está en este brief (un CIF, un DUNS, un
   teléfono), **parar y pedírselo a Luis**. No inventar datos de empresa.

---

## T1 — Firebase (proyecto + app Android + credenciales de push)

**Dónde**: https://console.firebase.google.com

1. Comprobar si ya existe un proyecto llamado *ClicyVoy*. Si existe, **usarlo** y
   saltar al punto 3.
2. *Crear un proyecto* → nombre **`ClicyVoy`** → Google Analytics: **desactivado**
   (no hace falta) → *Crear proyecto*.
3. En la pantalla del proyecto, icono de **Android** («Añadir una app») →
   - Nombre del paquete: **`com.clicyvoy.app`** (copiar tal cual)
   - Alias de la app: `ClicyVoy Android`
   - Certificado SHA-1: **dejar vacío** (no se usa)
   - *Registrar app*.
4. **Descargar `google-services.json`**. No hace falta seguir con los pasos de
   Gradle que muestra Firebase: pulsar *Siguiente* hasta *Ir a la consola*.
5. Engranaje ⚙ → *Configuración del proyecto* → pestaña **Cuentas de servicio** →
   **Generar nueva clave privada** → *Generar clave*. Se descarga un JSON con un
   nombre largo (`clicyvoy-firebase-adminsdk-….json`).

**ENTREGABLE**: los dos ficheros en Descargas + sus nombres exactos:
`google-services.json` y el JSON de la cuenta de servicio.

---

## T2 — Google Cloud: publicar la pantalla de consentimiento

**Dónde**: https://console.cloud.google.com/apis/credentials/consent

1. Seleccionar arriba el **proyecto del negocio** (el que usa Supabase para el
   login con Google; si hay varios, el que tenga el ID de cliente OAuth con el
   dominio de Supabase).
2. En *Branding* / *Pantalla de consentimiento*: si el **nombre de la aplicación**
   dice `PorteManía` o `portemania`, cambiarlo a **`ClicyVoy`** y guardar. Es el
   nombre que ve el usuario al iniciar sesión.
3. Correo de asistencia y de contacto: **portemaniafurgo@gmail.com**.
   Página principal: `https://clicyvoy.es`. Política de privacidad:
   `https://clicyvoy.es/privacidad`. Condiciones del servicio:
   `https://clicyvoy.es/terminos` (Google no deja publicar sin las dos primeras).
4. Comprobar que en *Dominios autorizados* está **`clicyvoy.es`**.
5. En *Público* / *Audience*: si el estado de publicación es **En pruebas
   (Testing)** → **PUBLICAR APLICACIÓN** → confirmar.

Los ámbitos son solo `email`, `profile` y `openid`: no son sensibles y Google no
exige verificación. Si sale un aviso de verificación, **no bloquea**: informar y
seguir.

**ENTREGABLE**: confirmación de que el estado es «En producción» y de cómo
quedó el nombre de la app.

---

## T3 — Play Console: cuenta y app

**Dónde**: https://play.google.com/console

### Si NO hay cuenta de desarrollador

1. Empezar el alta y **parar en la pantalla de pago**: avisar a Luis de los
   **25 USD (pago único)** y esperar a que él lo confirme mirando la pantalla.
2. **Antes de elegir el tipo de cuenta, preguntar a Luis**: personal u
   organización. Explicarle lo que dice
   [PLAY-STORE.md §2](PLAY-STORE.md): **con cuenta personal, Google exige una
   prueba cerrada con 12 testers durante 14 días antes de poder publicar en
   producción**; con cuenta de organización, no — pero la organización pide CIF,
   datos fiscales y un **número DUNS** (gratuito, tarda días).
3. Completar el alta con los datos que dé Luis. No inventar ninguno.

### Crear la app

1. *Todas las aplicaciones* → **Crear aplicación**.
2. Valores exactos:
   - Nombre de la aplicación: **`ClicyVoy: portes y mudanzas`**
   - Idioma predeterminado: **Español (España) – es-ES**
   - Tipo: **Aplicación** (no juego)
   - Gratuita o de pago: **Gratuita** (⚠️ no se puede cambiar a gratuita después
     si se marca de pago)
   - Aceptar las declaraciones de directrices y de leyes de exportación de EE. UU.

**ENTREGABLE**: enlace de la app en Play Console y confirmación del tipo de
cuenta elegido.

---

## T4 — Ficha de Play Store

**Dónde**: Play Console → la app → *Crecimiento* → **Presencia en Play** →
*Ficha de Play Store principal*.

Los textos están en **`mobile/store/listing.es.md`**. **Copiar y pegar, sin
reescribir.** Claude Code los tendrá abiertos; si no se ven, pedírselos.

| Campo | De dónde sale |
|---|---|
| Nombre de la aplicación (≤30) | `listing.es.md` → *Nombre de la aplicación* |
| Descripción breve (≤80) | `listing.es.md` → *Descripción breve* |
| Descripción completa (≤4000) | `listing.es.md` → *Descripción completa* |
| Icono de la app | fichero **`mobile/store/icon-512.png`** |
| Gráfico de cabecera | fichero **`mobile/store/feature-graphic-1024x500.png`** |
| Capturas de teléfono | ficheros de **`mobile/store/screenshots/`** (mínimo 2, mejor 6–8, en orden 01→08) |

> **Desde el 23/09/2026**, las tres últimas filas (icono, gráfico de cabecera y
> capturas) **las sube Claude Code por API** con `scripts/play-upload.mjs` en
> cuanto exista la cuenta de servicio de **T7**. Claude Chrome solo rellena los
> textos y la configuración; si las imágenes ya están puestas, se dejan como
> están.

En *Configuración de la tienda* → **Categoría**: `Mapas y navegación`.
Etiquetas: portes, mudanzas, transporte, furgoneta, mensajería, envíos.

**Datos de contacto**:

- Correo: `portemaniafurgo@gmail.com`
- Sitio web: `https://clicyvoy.es`

**ENTREGABLE**: captura o confirmación de que la ficha queda guardada sin
errores de validación (Play avisa si algún texto pasa del límite).

---

## T5 — Contenido de la aplicación (todos los formularios)

**Dónde**: Play Console → la app → *Política y programas* → **Contenido de la
aplicación**.

Las respuestas están en **[PLAY-STORE.md §7](PLAY-STORE.md)**. **Usarlas tal
cual**, incluidos los textos largos, que ya están dentro de los límites de
caracteres.

Orden recomendado:

1. **Política de privacidad** → `https://clicyvoy.es/privacidad`
2. **Acceso a la aplicación** → «Todo o parte de la app está restringida» +
   las dos cuentas de prueba y las instrucciones de §7.1. ⚠️ Las credenciales las
   da **Claude Code** justo antes (las cuentas se crean para la revisión y se
   borran después): si no las tiene todavía, **parar y pedirlas**.
3. **Anuncios** → No.
4. **Clasificación de contenido** → cuestionario IARC con las respuestas de §7.3
   (utilidad/productividad; sin violencia ni contenido sexual; **sí** comunicación
   entre usuarios; **sí** compartir ubicación; **sí** compra de servicios).
5. **Público objetivo** → 18 y más; no dirigida a niños.
6. **Aplicación de noticias** → No. **COVID-19** → No. **Aplicación
   gubernamental** → No. **Funciones financieras** → No.
7. **Seguridad de los datos** → rellenar la tabla de §7.6 dato por dato. Marcar
   siempre: cifrado en tránsito **sí**, borrado de datos a petición **sí**, no se
   vende nada.
8. **Eliminación de la cuenta** → marcar que se puede borrar **desde la app** y
   además dar la URL `https://clicyvoy.es/eliminar-cuenta`.
9. **Permisos sensibles / Declaración de permisos** → ubicación en segundo plano
   con el texto de §7.7 y el **enlace del vídeo** (lo graba Luis; si aún no
   existe, dejar el formulario guardado como borrador y avisar).

**ENTREGABLE**: lista de los formularios que quedan en verde y de los que
faltan, con el motivo exacto de cada uno que falte.

---

## T6 — Prueba interna

> **Desde el 23/09/2026 el AAB y las imágenes los sube Claude Code por API**
> (hay que hacer **T7 primero**). Lo que queda para Claude Chrome en T6 es:
> descartar la versión sin guardar que quedó abierta en «Crear versión de prueba
> interna» (si Play la conserva), esperar el aviso de Claude Code, entrar en
> *Pruebas internas* → la versión **1.0.0** aparece como **borrador** → *Revisar
> versión* → **Iniciar lanzamiento en pruebas internas** → rellenar el formulario
> **5.9** → copiar el **enlace de participación**.

**Dónde**: Play Console → la app → *Pruebas* → **Pruebas internas**.

1. Pestaña **Testers** → *Crear lista de correos electrónicos* → añadir el correo
   de Luis y `portemaniafurgo@gmail.com` → guardar y marcar la lista.
2. Pestaña **Versiones**: si quedó abierta una versión sin guardar de un intento
   anterior, **descartarla**. No crear ninguna versión nueva a mano.
3. Aceptar **Play App Signing** cuando lo proponga (es obligatorio y no hay nada
   que configurar).
4. Esperar el aviso de Claude Code de que la versión está subida. El bundle y las
   **notas de la versión** (`1.0.0`, el texto de `listing.es.md`) ya van dentro:
   no hay que subir ni escribir nada.
5. La versión **1.0.0** aparece en la pista como **borrador** (Google no permite
   otra cosa mientras la app no se ha publicado nunca).
6. *Revisar versión* → **Iniciar lanzamiento en pruebas internas** → confirmar.
7. Volver a *Testers* → copiar el **enlace de participación** («Copiar enlace»).

**ENTREGABLE**: el enlace de participación (URL completa) y el estado de la
versión (en revisión / disponible).

---

## T7 — Cuenta de servicio de Google Play (para que Claude Code suba el AAB y las imágenes por API)

**No es opcional y va ANTES de T6.** Nadie puede usar el selector de ficheros del
navegador, así que el AAB (100 MB), el icono, el gráfico de cabecera y las
capturas los sube Claude Code con `scripts/play-upload.mjs` por la Google Play
Developer API. Para eso hace falta esta cuenta de servicio.

### 1. Habilitar la API en Google Cloud

1. Ir a https://console.cloud.google.com
2. Arriba, en el selector de proyecto, elegir el proyecto **`clicyvoy`** (el
   mismo de Firebase de T1). ⚠️ No crear otro.
3. Menú (☰) → **APIs y servicios** → **Biblioteca**.
4. Buscar **«Google Play Android Developer API»** → abrirla → **Habilitar**.
   (Si ya pone *Administrar*, es que está habilitada: seguir.)

### 2. Crear la cuenta de servicio

1. Menú (☰) → **IAM y administración** → **Cuentas de servicio**.
2. **Crear cuenta de servicio**.
3. Nombre de la cuenta de servicio: **`play-publisher-clicyvoy`** (el ID se
   rellena solo) → **Crear y continuar**.
4. *Conceder acceso a esta cuenta de servicio al proyecto*: **sin roles**, dejarlo
   vacío → **Continuar**.
5. *Conceder acceso a los usuarios*: vacío → **Listo**.

### 3. Descargar la clave JSON

1. En la lista, abrir **`play-publisher-clicyvoy`**.
2. Pestaña **Claves** → **Añadir clave** → **Crear clave nueva** → tipo **JSON**
   → **Crear**. El fichero se descarga a la carpeta **Descargas**.
3. **Anotar el nombre exacto del fichero** (tiene la forma
   `clicyvoy-xxxxxxxxxxxx.json`) y el **correo de la cuenta de servicio**, que
   tiene la forma **`play-publisher-clicyvoy@clicyvoy.iam.gserviceaccount.com`**
   y se ve en la pestaña *Detalles*.
   ⚠️ El JSON es una credencial: no pegarlo en ningún chat ni captura; se queda
   en Descargas y Claude Code lo mueve a su sitio.

### 4. Dar permisos en Play Console

1. Ir a https://play.google.com/console → **Usuarios y permisos** (menú de la
   izquierda, abajo).
2. **Invitar usuarios nuevos**.
3. En *Dirección de correo electrónico*, pegar el correo de la cuenta de servicio
   del paso 3.3.
4. Pestaña **Permisos de la app** → **Añadir aplicación** → **ClicyVoy**.
5. Marcar estos cinco permisos, y solo estos:
   - **Ver información de la app** (y descargar informes masivos)
   - **Editar y eliminar borradores de versiones**
   - **Publicar versiones en pistas de prueba**
   - **Gestionar pistas de prueba y editar listas de testers**
   - **Editar información de la ficha de Play Store, precios y distribución**
6. **Invitar usuario** → confirmar.
   ⚠️ Las cuentas de servicio **no aceptan la invitación** ni reciben correo:
   quedan activas en cuanto se invitan. No hay que esperar nada.

**ENTREGABLE**: el **nombre exacto del JSON** que ha quedado en Descargas y el
**correo de la cuenta de servicio**. Con eso Claude Code lo guarda como
`mobile/play-service-account.json`, comprueba los permisos con
`node scripts/play-upload.mjs --validate` y sube el AAB y los gráficos.

---

## Qué devuelve Claude Chrome a Claude Code

| Entregable | De qué tarea | Qué hace Claude Code con él |
|---|---|---|
| `google-services.json` | T1 | Lo mueve a `mobile/google-services.json` y lo sube a EAS (`env:create`) |
| JSON de cuenta de servicio de Firebase | T1 | `eas credentials -p android` → clave FCM V1 |
| Confirmación de consent screen publicada | T2 | Cierra el pendiente T3 del handoff |
| **JSON de la cuenta de servicio de Play** (nombre del fichero en Descargas) | **T7** | Lo guarda como `mobile/play-service-account.json` y sube el AAB, el icono, la cabecera y las capturas con `node scripts/play-upload.mjs` |
| **Correo de la cuenta de servicio** (`play-publisher-…@…gserviceaccount.com`) | **T7** | Comprueba con él los permisos (`--validate`) antes de subir nada |
| Enlace de participación de la prueba interna | T6 | Se lo pasa a Luis para instalar |

## Qué necesita Claude Chrome de Claude Code

| Necesita | Cuándo | Nota |
|---|---|---|
| El **aviso de que la versión ya está subida** | Antes de T6 | El `.aab` lo sube Claude Code por API: Claude Chrome **no** necesita el fichero |
| Las **credenciales de las cuentas de prueba** | Antes de T5.2 | Se crean para la revisión y se borran al terminar |
| El **enlace del vídeo** de ubicación en segundo plano | Antes de T5.9 | Lo graba Luis; YouTube, no listado, ≤30 s |

> El icono, el gráfico de cabecera y las **capturas** ya no se le piden a Claude
> Chrome: los sube Claude Code por API en cuanto Luis las haya hecho con `adb`.
