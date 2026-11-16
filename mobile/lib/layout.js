import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Aire al final de cualquier lista o pantalla que ruede.
 *
 * Sin esto, el último botón queda pegado al borde: en móviles con barra de
 * gestos (todos los Xiaomi de ahora) la franja del sistema se le come, y en las
 * pantallas con pestañas hay que dejar sitio para no rozarlas. Es la clase de
 * detalle que no se ve en el emulador y se sufre en la mano.
 *
 * @param extra espacio adicional para pantallas con botón flotante o hoja.
 */
export function useBottomPadding(extra = 0) {
  const insets = useSafeAreaInsets();
  return insets.bottom + 32 + extra;
}

/**
 * Relleno inferior de una hoja que sale desde abajo (diálogos, contraoferta,
 * detalle de oferta). En iPhone la barra de inicio ocupa ~34 px al pie de la
 * pantalla y el último botón quedaba debajo de ella; en Android se devuelve
 * `base` tal cual, para no mover nada de lo que ya funciona allí.
 *
 * @param base el relleno que la hoja ya tenía.
 * @returns el estilo `{ paddingBottom }` a añadir, o null si no cambia nada.
 */
export function useSheetBottomPadding(base) {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "ios" || !insets.bottom) return null;
  return { paddingBottom: Math.max(base, insets.bottom + 12) };
}
