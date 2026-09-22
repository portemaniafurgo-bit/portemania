# Material de la ficha de Google Play

Todo lo que hay que subir a Play Console para publicar ClicyVoy
(`com.clicyvoy.app`). El runbook de publicación, paso a paso, está en
[`../../docs/PLAY-STORE.md`](../../docs/PLAY-STORE.md).

## Qué hay aquí

| Fichero | Para qué | Requisito de Play |
|---|---|---|
| `icon-512.png` | Icono de la ficha | 512×512 PNG, 32 bits, **sin transparencia** |
| `feature-graphic-1024x500.png` | Gráfico de cabecera | 1024×500 PNG o JPEG, sin transparencia |
| `listing.es.md` | Textos de la ficha (nombre, descripciones, categoría, enlaces) | Con el recuento de caracteres al lado de cada límite |
| `screenshots/` | Capturas del móvil | Mínimo 2, recomendable 6–8 |

El icono de notificación de Android (`../assets/notification-icon.png`, silueta
blanca de 96×96) se genera con el mismo script, aunque no se sube a Play: va
dentro del APK.

## Cómo regenerar los gráficos

```bash
node scripts/generate-store-assets.mjs   # desde la RAÍZ del repo
```

Usa el `sharp` de `node_modules` de la raíz y los trazados del logo de
`scripts/generate-app-assets.mjs`, así que la ficha de Play y la app siempre
llevan el mismo logotipo. Si la máquina no tiene Poppins instalada, el reclamo
del gráfico de cabecera sale con Arial: se ve bien igual.

## Capturas de pantalla (hay que hacerlas en un móvil REAL)

Play no acepta maquetas generadas: son pantallazos de la app funcionando. Lo
que exige:

- **Mínimo 2**, recomendable **6–8** (las tres primeras son las que se ven sin
  deslizar: que cuenten la historia solas).
- **PNG o JPEG**, sin transparencia.
- **Relación 9:16** (vertical), con cada lado entre **320 y 3840 px**. Un móvil
  actual da 1080×2400, que vale tal cual.
- **Sin marcos de móvil, sin texto engañoso** y sin datos personales reales a la
  vista: usar el cliente y el conductor de prueba.

### Las 8 capturas, en orden

| # | Fichero | Qué tiene que verse |
|---|---|---|
| 01 | `01-onboarding.png` | Pantalla de bienvenida / login con el logo |
| 02 | `02-pedir.png` | Asistente de pedido con el precio calculado en vivo |
| 03 | `03-seguimiento.png` | Seguimiento del conductor en el mapa |
| 04 | `04-chat.png` | Chat entre cliente y conductor |
| 05 | `05-ofertas-conductor.png` | Lista de ofertas del conductor |
| 06 | `06-servicio-conductor.png` | Servicio activo del conductor con la ruta |
| 07 | `07-ganancias.png` | Pantalla de ganancias con el gráfico |
| 08 | `08-perfil.png` | Perfil (con «Eliminar mi cuenta» a la vista) |

### Cómo capturarlas con adb

`adb` ya está en el PATH. Con el móvil conectado por USB:

```bash
adb devices                                                   # que aparezca "device", no "unauthorized"
adb exec-out screencap -p > mobile/store/screenshots/01-onboarding.png
adb exec-out screencap -p > mobile/store/screenshots/02-pedir.png
adb exec-out screencap -p > mobile/store/screenshots/03-seguimiento.png
adb exec-out screencap -p > mobile/store/screenshots/04-chat.png
adb exec-out screencap -p > mobile/store/screenshots/05-ofertas-conductor.png
adb exec-out screencap -p > mobile/store/screenshots/06-servicio-conductor.png
adb exec-out screencap -p > mobile/store/screenshots/07-ganancias.png
adb exec-out screencap -p > mobile/store/screenshots/08-perfil.png
```

Se navega a la pantalla en el móvil y se ejecuta la línea correspondiente; el
fichero se escribe en el PC.

> **Móvil Xiaomi (MIUI)**: hay que activar *Opciones de desarrollador* y, dentro,
> **«Depuración USB»**, **«Instalar vía USB»** y **«Depuración USB (ajustes de
> seguridad)»** — esta última exige tener metida una SIM y una cuenta Mi. Sin
> ellas, `adb devices` muestra el móvil como `unauthorized` o directamente no
> deja instalar el APK.

Comprobar el tamaño de lo capturado antes de subirlo:

```bash
node -e "const b=require('fs').readFileSync(process.argv[1]);console.log(b.readUInt32BE(16)+'x'+b.readUInt32BE(20))" mobile/store/screenshots/01-onboarding.png
```
