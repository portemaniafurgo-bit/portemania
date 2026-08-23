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
