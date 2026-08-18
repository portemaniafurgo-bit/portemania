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
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="pedir"
        options={{
          title: "Pedir",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Mis pedidos",
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      {/* El detalle del pedido vive dentro de las pestañas para conservarlas al
          abrirlo, pero no es una pestaña: se entra desde "Mis pedidos". */}
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      {/* Chat a pantalla completa (canvas 2g): sin barra de pestañas, que el
          teclado y la conversación ocupen todo. */}
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
