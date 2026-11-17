# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Trampa: copias de trabajo con node_modules compartido

Las copias de trabajo (`pontemania-ota`, `pontemania-partners`…) usan un enlace
(junction) al `mobile/node_modules` de `pontemania`, y la caché de Metro es
compartida. Sin `--clear`, `npx expo export` (y `eas update`) puede empaquetar
EN SILENCIO el código de OTRA copia. Antes de dar por buena una exportación o de
publicar una actualización: usar siempre `--clear` y comprobar en el log que las
rutas de `assets` salen de ESTA carpeta y que el paquete contiene un texto del
cambio (exportar con `--no-bytecode` para poder buscarlo).
