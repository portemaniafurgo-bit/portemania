# ClicyVoy en iPhone — guía para publicarla en la App Store

Rama `feat/ios` (copia de trabajo `pontemania-partners`). Escrita el 16-nov-2026.

**Lo importante en tres líneas**

- El código de la app ya está preparado para iPhone y empaqueta sin errores para
  iOS y para Android. **Nada de esto se ha podido probar en un iPhone**: aquí no
  hay Mac ni iPhone. Todo lo marcado con ⚠️ es una suposición razonada que hay
  que confirmar con la primera versión de TestFlight.
- La app Android que está en prueba cerrada no cambia: no se ha añadido ninguna
  pieza nativa nueva y la configuración de Android es idéntica (comprobado con
  `npx expo config`). Lo nuevo de iPhone va detrás de «si es iPhone».
- Lo que falta es trabajo de cuentas y paneles (Apple, Supabase, EAS) que solo
  puede hacer el titular, en el orden de esta guía.

---

## 0. Qué cambia en la app (resumen para el titular)

| Qué | En iPhone | En Android |
|---|---|---|
| Entrar con Apple | Botón negro «Continuar con Apple», encima del de Google, en *Entrar* y *Crear cuenta* | No aparece |
| Nombre al registrarse | Si Apple no da el nombre, se pide en «Un último dato» junto al teléfono | Igual que antes |
| Seguimiento del conductor | Funciona con «Al usar la app» + indicador azul; «Siempre» se pide como mejora | Igual que antes («Permitir todo el tiempo» obligatorio) |
| Aviso previo de ubicación | Solo explica y tiene un único «Continuar» (Apple no admite «Ahora no» antes del permiso) | El mismo de siempre, con «Ahora no» (lo exige Google Play) |
| Elegir día y hora | Hoja propia con calendario y hora (antes no hacía nada en iPhone) | Los diálogos de siempre |
| Volver atrás | Flecha en la cabecera de Ayuda, Pagos, Facturación, Tu pedido y Mis facturas | Botón atrás del sistema, como siempre |
| Pago con tarjeta | Se llama «Tarjeta» (sin Google Pay; Apple Pay apagado) | «Tarjeta o Google Pay» |
| Ayuda del conductor | Ajustes del iPhone (Ubicación «Siempre», Notificaciones) | Ajustes de Android y batería |

---

## 1. Cuenta de Apple Developer (1–15 días)

1. Darse de alta en el **Apple Developer Program** (99 USD/año) en
   <https://developer.apple.com/programs/enroll/> con el Apple ID que vaya a ser
   el titular (con verificación en dos pasos activada).
2. **¿Particular u organización?**
   - **Organización** (recomendado si ClicyVoy factura como sociedad): en la App
     Store sale el nombre de la empresa como vendedor. Pide el número
     **D-U-N-S** de la sociedad (gratis; se solicita desde el propio proceso de
     Apple o en dnb.com; puede tardar de 5 a 14 días laborables) y que quien
     se da de alta pueda obligar a la empresa.
   - **Particular**: alta en uno o dos días, pero en la tienda aparece el nombre
     y apellidos de la persona como vendedor. Pasar después a organización es
     un trámite con Apple, no un botón.
3. Anotar el **Team ID** (10 caracteres, en *Membership*). Va a `mobile/eas.json`.

## 2. Ficha de la app en App Store Connect

1. <https://appstoreconnect.apple.com> → Apps → **+** → Nueva app:
   - Plataforma iOS · Nombre «ClicyVoy» (si está cogido, «ClicyVoy - Portes») ·
     Idioma principal **Español (España)** · ID de paquete
     **`com.clicyvoy.app`** (si no aparece en la lista, se crea en el paso 3.1
     o lo crea EAS en la primera build) · SKU `clicyvoy-ios`.
2. Anotar el **Apple ID numérico de la app** (*Información de la app* → Apple
   ID, solo dígitos).
3. Rellenar en `mobile/eas.json` → `submit.production.ios`:
   - `appleId`: el email del Apple ID del titular.
   - `ascAppId`: el número del punto 2.
   - `appleTeamId`: el Team ID.
   Hasta que se rellenen, `eas submit -p ios` falla a propósito (son textos de
   ejemplo); `eas submit -p android` no se ve afectado.

## 3. «Iniciar sesión con Apple» (Apple + Supabase, ~30 min)

La app usa el **flujo web** de Supabase (como Google), no el módulo nativo de
Apple. Por eso hace falta un *Services ID* y una clave, y **no** hace falta
activar nada en la app.

### 3.1 En Apple Developer → Certificates, IDs & Profiles

1. **Identifiers → App IDs → `com.clicyvoy.app`** (créalo si no existe: *App*,
   descripción «ClicyVoy», Bundle ID explícito `com.clicyvoy.app`). Marca
   **Sign In with Apple** → *Enable as a primary App ID*. Guarda. Marca también
   **Push Notifications** (EAS lo activa solo, pero no estorba).
2. **Identifiers → + → Services IDs**:
   - Descripción: «ClicyVoy acceso web» · Identificador: **`com.clicyvoy.app.web`**.
   - Marca **Sign In with Apple** → *Configure*:
     - *Primary App ID*: `com.clicyvoy.app`.
     - *Domains and Subdomains*: `dnehzwrqphqpkcdjwqfi.supabase.co`
     - *Return URLs*: `https://dnehzwrqphqpkcdjwqfi.supabase.co/auth/v1/callback`
   - Guarda y *Continue* → *Register*.
3. **Keys → +**: nombre «ClicyVoy Sign in with Apple», marca **Sign in with
   Apple** → *Configure* → Primary App ID `com.clicyvoy.app`. Registra y
   **descarga el fichero `.p8`** (solo se puede descargar una vez; guárdalo
   fuera del repositorio). Anota el **Key ID**.

### 3.2 La «clave secreta» que pide Supabase

Supabase no acepta el `.p8` tal cual: pide un **secreto firmado (JWT)** que se
genera con el Team ID, el Key ID, el Services ID (`com.clicyvoy.app.web`) y el
`.p8`. La guía de Supabase de *Login with Apple* trae un generador; también se
puede generar con un script propio. ⚠️ **Caduca como mucho a los 6 meses**: al
generarlo, poner un recordatorio en el calendario 5 meses después. Si caduca,
el botón de Apple deja de funcionar (Google y contraseña siguen bien) hasta
generar otro y pegarlo.

### 3.3 En Supabase (proyecto `dnehzwrqphqpkcdjwqfi`)

1. **Authentication → Sign In / Providers → Apple** → activar.
   - **Client IDs**: `com.clicyvoy.app.web` (el Services ID). Se puede añadir
     separado por coma `com.clicyvoy.app` por si algún día se usa el módulo
     nativo; hoy no hace falta.
   - **Secret Key (for OAuth)**: el JWT del paso 3.2.
   - Guardar.
2. **Authentication → URL Configuration → Redirect URLs**: comprobar que está
   `clicyvoy://auth` (ya debería estar, es la que usa Google en Android). Si no
   está, añadirla; sin ella Supabase devuelve a la web en vez de a la app.

### 3.4 Correos a direcciones ocultas de Apple ⚠️

Quien elige «Ocultar mi correo» recibe una dirección
`…@privaterelay.appleid.com`. Apple **solo reenvía** correos de remitentes
registrados. En Apple Developer → *Services* → **Sign in with Apple for Email
Communication** hay que dar de alta los dominios / direcciones desde los que
salen los correos de ClicyVoy (el dominio de `send-email` y el remitente de
los correos de Supabase Auth; comprobar cuáles son en los paneles) y que ese
dominio tenga SPF. Sin esto, esas personas no reciben recibos ni avisos.

### 3.5 Aviso para conductores ⚠️

La app reconoce a un conductor buscando su ficha **por el email con el que
entra**. Un conductor que entre con Apple y elija «Ocultar mi correo» tendrá un
email de reenvío que no coincide con su ficha y entrará como cliente. Decirles a
los conductores que en iPhone entren con **Google o con su contraseña**, o con
Apple **compartiendo** su email real. (Arreglarlo de verdad es un cambio del
servidor, fuera de esta rama.)

## 4. Notificaciones (APNs)

- En la primera build de iOS, EAS pregunta si configura las notificaciones push:
  responder **sí** y dejar que genere y guarde la **clave APNs**. También se
  puede hacer antes con `cd mobile && eas credentials -p ios` → *Push
  Notifications* → crear o subir clave.
- No hay que tocar nada en Supabase: la función `send-push` usa el servicio de
  Expo, que reparte a Android y a iPhone.
- ⚠️ En iPhone suena el **sonido normal**, no la melodía de «pedido nuevo»: los
  avisos salen con `sound: "default"` desde `send-push`, y en iOS el sonido no
  va por canal sino en cada aviso. Para la melodía hay que cambiar `send-push`
  (enviar `"oferta.wav"` en los avisos de ofertas); el fichero ya entra en la
  app de iOS. Es un cambio de servidor, fuera de esta rama.
- ⚠️ La configuración deja el entorno de notificaciones en su valor por defecto
  (`development` en el fichero de permisos). Al exportar para TestFlight / App
  Store, Xcode lo cambia a `production`. Si en TestFlight no llega ningún
  aviso, lo primero es añadir `"mode": "production"` a las opciones de
  `expo-notifications` en `app.json` (solo afecta a iOS) y volver a construir.

## 5. Apple Pay (opcional, apagado)

- El pago con tarjeta va por la hoja de Stripe y en iPhone **no** ofrece Apple
  Pay. La app ya lleva el identificador de comerciante
  `merchant.com.clicyvoy.app`, así que el permiso de Apple Pay entra en la app.
- ⚠️ Por eso, **antes de la primera build**, crear en Apple Developer →
  Identifiers → **Merchant IDs** el identificador `merchant.com.clicyvoy.app`
  (EAS puede intentar crearlo solo; si la build falla por «in-app-payments»,
  es esto). La alternativa es quitar `merchantIdentifier` de `app.json` (solo
  afecta a iOS) y Apple Pay quedaría fuera del todo.
- Para encenderlo más adelante: certificado de Apple Pay en el panel de Stripe
  (Configuración → Métodos de pago → Apple Pay → certificados iOS) y añadir
  `applePay: { merchantCountryCode: "ES" }` en `initPaymentSheet`
  (`components/PayButton.js` y `components/TipCard.js`). No requiere build
  nueva: el permiso ya va dentro.

## 6. Primera build y TestFlight

Desde `mobile/` con la sesión de EAS del equipo (`eas login`):

1. **Build de tienda**: `eas build -p ios --profile production`
   - EAS pide entrar con el Apple ID (código de doble factor) y ofrece
     gestionar certificados y perfiles: responder que sí a todo.
   - El número de build lo lleva EAS en remoto (`appVersionSource: remote` +
     `autoIncrement`); el `buildNumber: "1"` de `app.json` es solo el punto de
     partida y EAS puede ignorarlo. La versión visible sigue siendo 1.0.0.
   - Cada build gasta cuota de EAS: hacer una, probarla y no repetir por probar.
2. **Subirla**: `eas submit -p ios --profile production --latest` (con
   `eas.json` ya rellenado, paso 2.3). Tarda ~10–30 min en procesarse.
3. **TestFlight**: en App Store Connect → TestFlight:
   - *Pruebas internas*: hasta 100 personas del equipo de App Store Connect,
     sin revisión de Apple. Es lo primero.
   - *Pruebas externas*: con enlace público, pero pasa una revisión beta de
     Apple (1–2 días). Pide los mismos datos de la sección 7.
   - Responder la pregunta de cifrado: la app ya declara que **no** usa cifrado
     propio (solo HTTPS), así que no debería preguntar.
4. **Build `preview`** (instalación directa sin TestFlight): solo sirve con
   iPhones registrados (`eas device:create`, se abre un enlace en el iPhone).
   Sin iPhone a mano, saltarse este paso y usar TestFlight.

**Actualizaciones por OTA**: iPhone y Android comparten versión 1.0.0 y el canal
`production`. Desde que exista la app de iPhone, cada `eas update --channel
production` llega a los dos salvo que se ponga `--platform android` o
`--platform ios`. El código de esta rama funciona en ambos.

## 7. Revisión de Apple — lista de comprobación

1. **Acceso (guía 4.8)**: con «Continuar con Google» hay que ofrecer «Continuar
   con Apple» (hecho, en *Entrar* y *Crear cuenta*, igual de visible).
2. **Borrar la cuenta (5.1.1(v))**: dentro de la app, *Perfil → Borrar cuenta*
   (cliente y conductor), y en la web <https://clicyvoy.es/eliminar-cuenta>.
   ⚠️ Apple pide además que, en cuentas creadas con Apple, se **revoque el
   acceso de Apple** al borrar (llamada a la API de Apple desde el servidor).
   Hoy no se hace; rara vez lo comprueban, pero es un riesgo de rechazo y un
   trabajo de servidor pendiente.
3. **Ubicación en segundo plano**: en *Información para la revisión → Notas*,
   pegar (en inglés, lo leen en inglés):

   > ClicyVoy connects customers with van drivers in Spain. When a driver
   > accepts a job, the app shares the driver's location so the customer can
   > see on a map where the driver is and when they will arrive. Drivers drive
   > with the phone locked or while using a navigation app, so location must
   > keep updating in the background. Background location runs only while a
   > job is active (blue location indicator visible) and stops when the job is
   > delivered or cancelled. Customers never share location in the background.
   > The service operates in Albacete (Spain): addresses outside the service
   > area cannot be booked. To review the driver flow, log in with the driver
   > demo account and open the active job prepared for review.

4. **Cuentas de prueba para Apple** (en *Información para la revisión*):
   - Un **cliente** con email y contraseña.
   - Un **conductor verificado** con email y contraseña y un servicio aceptado
     de prueba para que vean el seguimiento.
   Crearlas y prepararlas es una escritura en producción: lo decide el titular.
   No poner cuentas personales.
5. **Etiquetas de privacidad** (App Store Connect → *Privacidad de la app*),
   sacadas de `docs/PLAY-STORE.md` §7.6. Para todo: **no se usa para rastreo**,
   **vinculado a la identidad**, finalidad **Funcionalidad de la app** (y
   *Gestión de la cuenta* donde aplique):

   | Categoría de Apple | Dato | ¿Se recoge? |
   |---|---|---|
   | Información de contacto | Nombre, correo, teléfono, dirección física | Sí |
   | Ubicación | Ubicación precisa | Sí (conductores, con servicio activo; clientes al usar «Mi ubicación») |
   | Contenido del usuario | Fotos o vídeos (carga, prueba de entrega, documentos) | Sí |
   | Contenido del usuario | Otro contenido (mensajes del chat del servicio) | Sí |
   | Identificadores | ID de usuario; ID de dispositivo (token de avisos) | Sí |
   | Compras | Historial de compras (servicios y recibos) | Sí |
   | Información financiera | Información de pago (la tarjeta la procesa Stripe dentro de la app) | Sí, declarar por prudencia ⚠️ |
   | Información financiera | Otra información financiera (IBAN de los comerciales de ClicyVoy Partners) | Sí |
   | Diagnóstico | Fallos / rendimiento | No (no hay Sentry) |
   | Uso, navegación, anuncios | — | No |

6. **Pagos (3.1)**: se pagan **servicios físicos** que se prestan fuera de la
   app (portes), así que Stripe está permitido y **no** se usa compra dentro de
   la app de Apple. Las propinas son al conductor por ese mismo servicio. El
   programa de comerciales cobra comisiones por transferencia (IBAN), sin nada
   digital que comprar dentro de la app.
7. **No nombrar otras plataformas (2.3.10)**: en iPhone ya no aparece «Google
   Pay» ni «Android». El botón «Google Maps» del conductor es el nombre de una
   app de navegación y se puede quedar.
8. **iPad**: la app es solo de iPhone (`supportsTablet: false`). Así Apple no
   exige capturas ni revisa el diseño en iPad (en iPad se abre en modo
   iPhone). Ojo: una vez publicada **con** iPad, Apple no deja quitarlo; sin
   iPad, añadirlo después sí se puede.
9. **Google en modo de prueba** ⚠️: si la pantalla de consentimiento de Google
   del negocio sigue en *Testing*, el revisor que pulse «Continuar con Google»
   recibirá `access_denied` y puede rechazar la app. Publicarla en Google Cloud
   antes de enviar a revisión.
10. **«Un último dato»** ⚠️: tras entrar con Apple se pide nombre (si Apple no
    lo dio) y un **móvil español**. Apple a veces rechaza pedir de nuevo el
    nombre o datos que no hacen falta. Añadir en las notas: *"A phone number is
    required so the customer and the driver can call each other during a
    delivery; the service only operates in Spain, so a Spanish mobile number is
    required. Demo accounts already have one."*
11. **Manifiestos de privacidad** ⚠️: tras subir la build, Apple puede mandar un
    correo pidiendo declarar «APIs con motivo obligatorio» de alguna librería.
    Se arregla con la clave `ios.privacyManifests` de `app.json` (solo iOS) y
    una build nueva.
12. **Ficha**: capturas de iPhone 6,9" (1320 × 2868) obligatorias; URL de
   privacidad <https://clicyvoy.es/privacidad>; URL de soporte
   <https://clicyvoy.es>; categoría sugerida *Viajes* o *Empresa*; cuestionario
   de edad (sin contenido sensible → 4+).

## 8. Lo que solo un iPhone puede confirmar — plan de la primera prueba

Probar con la build de TestFlight, en este orden, y apuntar lo que falle:

1. **Instalación y arranque**: splash morado, introducción, pantalla de entrar.
   La barra de estado y la muesca no tapan nada.
2. **Entrar con Apple** (cuenta nueva): sale el aviso del sistema «ClicyVoy
   quiere usar supabase.co para iniciar sesión», se entra y aparece «Un último
   dato» pidiendo nombre (si Apple no lo dio) y teléfono. Repetir con «Ocultar
   mi correo». Pulsar «Cancelar» en la hoja de Apple: no debe salir ningún
   mensaje de error. ⚠️
3. **Entrar con Google** y **con contraseña**: igual que en Android.
4. **Cliente**: «Mi ubicación» (aviso de «Al usar la app»), crear un pedido,
   elegir día y hora en la hoja nueva, adjuntar fotos de la galería (no debe
   pedir permiso de fotos) y de la cámara, ajustar en el mapa (el título no
   queda bajo la muesca), escribir en todos los campos con el teclado abierto
   (el campo activo debe verse).
5. **Conductor**: aceptar un servicio → aviso «Tu ubicación durante el
   servicio» con un solo «Continuar» → permiso «Al usar la app» → el iPhone
   ofrece «Cambiar a Siempre». Probar las dos respuestas. ⚠️
6. **Seguimiento con la pantalla bloqueada**: con el servicio activo, bloquear
   el iPhone 10 minutos y, en otro móvil, ver al conductor moverse en el mapa
   del cliente. Repetir navegando con Google Maps. Debe verse el indicador
   azul. Probar también qué pasa si se cierra la app deslizándola (esperado:
   se para; con «Siempre» puede volver a arrancar). ⚠️
7. **Firma del receptor**: firmar con el dedo sin que la pantalla se desplace. ⚠️
8. **Contraoferta**: la hoja sube con el teclado al escribir el motivo.
9. **Avisos push**: pedido nuevo al conductor con la app cerrada y con la app
   abierta, mensaje de chat, cambio de estado; tocar el aviso abre la pantalla
   correcta. Comprobar que suena (sonido normal de iPhone).
10. **Pago con tarjeta**: hoja de Stripe, tarjeta real de bajo importe o
    reembolsable; con tarjeta que pida 3DS. ⚠️ Si 3DS abre una web, puede no
    cerrarse sola (la app no le da a Stripe una dirección de vuelta para iOS);
    cerrándola a mano el pago sigue siendo válido.
11. **Recibo PDF**: «Guardar en Archivos» desde la hoja de compartir.
12. **Ayuda del conductor**: textos de iPhone y el botón abre los Ajustes de
    ClicyVoy.
13. **Flechas atrás**: Ayuda, Métodos de pago, Datos de facturación, Tu pedido,
    Mis facturas.
14. **ClicyVoy Partners**: abrir el panel, «Copiar enlace» (debe copiar), datos
    de cobro (IBAN), compartir.
15. **Borrar cuenta**: con una cuenta de prueba.

## 9. Lista de suposiciones sin comprobar (⚠️)

- Que el «Cancelar» dentro de la página de Apple vuelva con un error que
  contenga «cancel» o «denied» (si no, saldría «Apple no devolvió una sesión
  válida»).
- Que Supabase guarde el nombre que Apple da en el primer acceso (si no, se pide
  en «Un último dato», que ya lo exige).
- Que con solo «Al usar la app» el seguimiento siga con la pantalla bloqueada
  (así lo indica el código de `expo-location` en iOS: solo exige el permiso de
  primer plano y el modo de fondo «location», que ya se activa).
- Los textos exactos de los botones del permiso de ubicación en iOS en español.
- Que el entorno de notificaciones quede en `production` al exportar (§4).
- Que EAS cree solo el Merchant ID de Apple Pay (§5).
- Que la firma no se corte al desplazar la pantalla.
- El comportamiento de 3DS sin dirección de vuelta (§8.10).
- Que Apple no pida revocar el acceso de Apple al borrar la cuenta (§7.2).
- Que los diálogos del sistema (permisos, hoja de Apple, selector de fotos, hoja
  de Stripe) salgan en español: la app declara español como único idioma en
  `ios.infoPlist`; sin probar.
- La espera de 350 ms antes de abrir la hoja de fecha del conductor cuando se
  llega desde un diálogo (iOS no abre una ventana mientras otra se cierra).
- Que la hoja de fecha (calendario + hora) quepa en iPhones pequeños (SE).
- El teclado: los campos se desplazan para verse, pero el botón fijo del pie
  del asistente de pedido queda bajo el teclado hasta cerrarlo.
- Frecuencia de envío de la posición con la app delante: iOS da una posición
  por segundo y con la app abierta no se agrupan (en segundo plano sí, cada
  4 s). Más escrituras que en Android mientras el conductor mira la app.
- Que el botón de créditos del mapa (OpenStreetMap) se vea en iOS: la app no
  lo desactiva y MapLibre lo muestra por defecto.
