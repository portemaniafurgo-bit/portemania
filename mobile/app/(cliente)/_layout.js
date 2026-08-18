import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

/**
 * Experiencia de CLIENTE: pedir, seguir sus pedidos y su cuenta.
 * (El admin que entre en la app cae aquí: administrar sigue siendo web.)
 */
export default function ClienteLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.hairline },
        // Etiqueta del canvas: DM Sans 500 10,5.
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: "DMSans_500Medium" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Iconos EXACTOS del canvas (2f): la pestaña activa va en versión
          rellena y las demás en línea. */}
      <Tabs.Screen
        name="pedir"
        options={{
          title: "Pedir",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Mis pedidos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
          ),
        }}
      />
      {/* El detalle del pedido vive dentro de las pestañas para conservarlas al
          abrirlo, pero no es una pestaña: se entra desde "Mis pedidos". */}
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      {/* Ajustes del perfil (canvas 2i): se entra desde Perfil. */}
      <Tabs.Screen name="pagos" options={{ href: null }} />
      <Tabs.Screen name="ayuda" options={{ href: null }} />
    </Tabs>
  );
}
