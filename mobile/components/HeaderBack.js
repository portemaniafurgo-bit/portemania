import { Platform, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Flecha «atrás» para las cabeceras de las pantallas que viven dentro de las
 * pestañas sin ser pestaña (ayuda, métodos de pago, facturación, detalle del
 * pedido, facturas).
 *
 * En Android se vuelve con el botón o el gesto del sistema; un iPhone no tiene
 * ninguno de los dos en una pestaña (el gesto de deslizar solo existe en una
 * pila), y sin esta flecha la única salida era adivinar que hay que tocar otra
 * pestaña. Lleva a la pantalla de la que se entra siempre (`to`), no a
 * `router.back()`: en las pestañas «atrás» salta a la primera pestaña.
 */
function HeaderBack({ to }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate(to)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      style={{ paddingHorizontal: 12 }}
    >
      <Ionicons name="chevron-back" size={26} color={colors.foreground} />
    </Pressable>
  );
}

/**
 * Opciones de cabecera con la flecha, SOLO en iOS: en Android se devuelve un
 * objeto vacío y la cabecera queda exactamente como estaba.
 *
 * @param {string} to ruta a la que vuelve la flecha, p. ej. "/(cliente)/profile".
 */
export function iosBackHeader(to) {
  if (Platform.OS !== "ios") return {};
  return { headerLeft: () => <HeaderBack to={to} /> };
}
