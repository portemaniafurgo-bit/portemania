# Arreglo de noviembre 2026: conductores tratados como clientes y mapa a saltos

Rama `fix/rol-conductor-y-mapa` (base `ota/pk-live` = origin/master + clave pk_live).
**Sin publicar**: Luis pidio no subir nada a la app mientras duran las pruebas.

## 1. Conductores a los que la app trataba como clientes
- Causa A: `mobile/lib/auth.js` convertia un fallo/timeout de la consulta del rol en
  "client" y lo guardaba en cache. Ahora "no se sabe" conserva el rol anterior,
  reintenta y nunca se cachea; cache por usuario (`cached_role_v2:<uid>`).
- Causa B: `fetchMyDriverProfile` (movil y web) ignoraba errores = "sin perfil".
  Ahora lanza y las pantallas muestran "No se pudo cargar" con reintento.
- Causa C (Alejandro): rol `admin` con ficha de conductor = cliente en el movil.
  Ahora `isDriver` = rol driver, o admin/staff con ficha de conductor.
- Web: AuthContext y postLogin ya no suponen "client" ante un error.

## 2. Mapa del cliente
- Captura: precision High, 4 s, sin filtro de distancia (latido cada ~20 s parado).
- Filtro de posiciones (`mobile/lib/geo.js`): buenas hasta 65 m; rescate hasta
  150 m tras 15 s y hasta 1 km tras 90 s; fuera saltos > 180 km/h y fixes viejos.
- `location_updated_at` es ahora la hora del fix.
- Cliente: un canal realtime por conductor, sondeo de rescate, marcador que se
  desliza, ruta OSRM solo al cambiar destino, desviarse > 150 m o cada 45 s.
- La linea es una ruta orientativa; lo que se corrige es el icono.

## Para publicar (solo con OK de Luis)
1. Web: fast-forward de origin/master a esta rama (Vercel despliega).
2. Movil: OTA desde este arbol (`eas update --branch production --environment production`).
3. Despues, fusionar en `master` local (lleva Stripe Connect sin publicar).
No hacer OTA desde origin/master sin la pk_live ni desde master local.

## Prueba en movil real (pendiente)
Un trayecto por ciudad y otro por autovia con dos moviles: el icono debe ir por
las calles reales y deslizarse; parado debe seguir "en vivo"; al desviarse > 150 m
la linea se recalcula en 10-15 s; vigilar bateria del conductor.
No probado en dispositivo: solo comprobaciones de codigo, empaquetado y 45 casos
de los filtros.
