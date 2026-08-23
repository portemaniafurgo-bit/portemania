import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

/**
 * Experiencia de CONDUCTOR. Misma app que la del cliente: el rol de la cuenta
 * decide qué pestañas se ven (decisión de producto §1 — una sola app, como Uber).
 */
export default function ConductorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.hairline },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: "DMSans_500Medium" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Iconos EXACTOS del canvas (2j/2k): ofertas es un rayo, servicios una
          lista y ganancias una cartera. */}
      <Tabs.Screen
        name="ofertas"
        options={{
          title: "Ofertas",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flash" : "flash-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Servicios",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Ganancias",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} size={24} color={color} />
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
      {/* El trabajo activo no es una pestaña: se entra al aceptar una oferta o
          desde el aviso de "servicio en curso". */}
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
      {/* Se entra desde el perfil, no son pestañas. */}
      <Tabs.Screen name="facturas" options={{ href: null }} />
      <Tabs.Screen name="ayuda" options={{ href: null }} />
    </Tabs>
  );
}
