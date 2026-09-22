# Ficha de Google Play — ClicyVoy (es-ES)

Textos listos para copiar y pegar en Play Console → Presencia en Play → Ficha
de Play Store principal. Cada apartado lleva el límite de Play y el recuento
real (medido con `node`, ver el final del documento). **No reescribir al
copiar**: estos son los textos aprobados.

Idioma de la ficha: **español (España)**. Es el único idioma que se publica.

---

## Nombre de la aplicación — límite 30 caracteres · actual: 27

```
ClicyVoy: portes y mudanzas
```

Alternativa si Play lo rechaza por duplicar palabras clave: `ClicyVoy`.

---

## Descripción breve — límite 80 caracteres · actual: 77

```
Portes y mini mudanzas en Albacete: precio al instante y pago desde el móvil.
```

---

## Descripción completa — límite 4000 caracteres · actual: 3046

```
ClicyVoy es la aplicación de portes, mini mudanzas y envíos de Albacete. Dices qué hay que mover y a dónde, ves el precio antes de confirmar y un conductor autónomo de la ciudad se encarga.

SI NECESITAS MOVER ALGO

- Cuatro servicios con su precio calculado al instante: porte (un mueble, un electrodoméstico, unas cajas), mini mudanza (una habitación o un piso pequeño), porte para tiendas (recogida en el comercio y entrega a domicilio) y envío de paquetes.
- El precio, antes de pedir. El asistente lo calcula según el servicio, lo que hay que mover, las plantas, si hay ascensor y si necesitas ayuda para cargar. Lo ves en pantalla mientras rellenas el pedido.
- Propón tu precio. Si el calculado no te encaja, ofreces el tuyo: los conductores responden aceptándolo o con su contraoferta, y tú eliges con quién vas.
- Sigue al conductor en el mapa, en vivo, y mira cuánto le falta para llegar.
- Chat con el conductor dentro de la app, con fotos: así sabe exactamente qué tiene que recoger y por dónde se entra.
- Paga como prefieras: tarjeta o Google Pay desde la app, o en efectivo o por Bizum directamente al conductor. Siempre te queda el recibo con el detalle.
- Valora el servicio al terminar y deja propina si te ha echado una mano de más.
- Pedidos programados: eliges día y hora, y la app te avisa cuando se acerca el momento.
- Historial de tus servicios, con la opción de repetir un pedido igual en dos toques.

SI ERES CONDUCTOR AUTÓNOMO CON FURGONETA

- Los pedidos te llegan con un aviso sonoro propio, también con el móvil bloqueado.
- Aceptas al precio del cliente o mandas tu contraoferta con el importe que te cuadra.
- Solo ves los pedidos que puedes hacer: se reparten según el tamaño de tu furgoneta y si estás disponible en ese momento.
- Navegas hasta la recogida y la entrega con Google Maps o Waze, sin salir del servicio.
- Avanzas el servicio paso a paso (en camino, he llegado, carga recogida, entregado) y lo cierras con foto y firma de quien recibe.
- Cobras con tarjeta, en efectivo o por Bizum, y consultas tus ganancias y tus facturas en la propia app.
- Subes tu documentación (carnet, seguro, recibo de autónomo, fotos del vehículo) desde el móvil con la cámara, y la app te avisa antes de que caduque.

ZONA DE SERVICIO

ClicyVoy trabaja hoy en Albacete capital y su entorno. La app comprueba el código postal al hacer el pedido y te avisa si la recogida o la entrega quedan fuera de la zona.

UBICACIÓN EN SEGUNDO PLANO

Solo en el modo conductor: mientras tienes un servicio activo, ClicyVoy envía tu posición para que el cliente pueda seguirte en el mapa y saber cuándo llegas, también cuando la app está cerrada o no la estás usando. Se detiene en cuanto terminas el servicio o lo cancelas.

TUS DATOS

Puedes borrar tu cuenta y tus datos cuando quieras desde Perfil - Eliminar mi cuenta, o siguiendo las instrucciones de https://clicyvoy.es/eliminar-cuenta. Los pagos con tarjeta los procesa Stripe: ClicyVoy no guarda los datos de tu tarjeta.

CONTACTO

portemaniafurgo@gmail.com
https://clicyvoy.es
```

---

## Novedades de la versión 1.0.0 — límite 500 caracteres · actual: 470

```
Primera versión pública de ClicyVoy. Pide portes, mini mudanzas, portes para tiendas y envíos con el precio al instante, propón tu precio y negocia con los conductores, sigue el servicio en el mapa y chatea. Pago con tarjeta, Google Pay, efectivo o Bizum, con recibo. Para conductores: ofertas con aviso sonoro propio, contraofertas, navegación, prueba de entrega con foto y firma, ganancias y facturas. Avisos con el móvil bloqueado y borrado de cuenta desde el perfil.
```

---

## Clasificación y metadatos

| Campo | Valor |
|---|---|
| Categoría (app) | **Mapas y navegación** (alternativa: *Empresa*) |
| Tipo | Aplicación (no juego) |
| Precio | Gratuita |
| Etiquetas | portes, mudanzas, transporte, furgoneta, mensajería, envíos, Albacete |
| Correo de contacto | portemaniafurgo@gmail.com |
| Sitio web | https://clicyvoy.es |
| Política de privacidad | https://clicyvoy.es/privacidad |
| URL de borrado de cuenta | https://clicyvoy.es/eliminar-cuenta |
| Teléfono de contacto | (opcional; el fijo del negocio si se quiere publicar) |

La categoría se propone **Mapas y navegación** porque el uso real gira en torno
al mapa y la ruta. *Empresa* es defendible si el negocio prefiere aparecer entre
servicios profesionales; se puede cambiar después sin volver a pasar revisión.

---

## Gráficos que acompañan a estos textos

- Icono: `icon-512.png` (512×512, sin transparencia).
- Gráfico de cabecera: `feature-graphic-1024x500.png`.
- Capturas: `screenshots/` (mínimo 2, recomendable 6–8 — ver `README.md`).

---

## Cómo se recontaron los caracteres

```bash
node -e "const t=require('fs').readFileSync('mobile/store/listing.es.md','utf8');const b=[...t.matchAll(/```\n([\s\S]*?)\n```/g)].map(m=>m[1]);b.forEach((x,i)=>console.log(i,x.length))"
```
