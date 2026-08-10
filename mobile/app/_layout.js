import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { usePushNotifications } from "../lib/push";
import { Loading } from "../components/ui";
import { colors } from "../theme";

/**
 * Guardia de navegación: decide, según la sesión y el rol, en qué grupo de
 * rutas debe estar el usuario. Es el equivalente de `postLogin.js` + el layout
 * protegido `(app)` de la web, pero aquí basta un efecto porque el enrutado es
 * de cliente.
 */
function RootNavigation() {
  const { session, role, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications({ userId: session?.user?.id, role });

  useEffect(() => {
    if (loading) return;

    const group = segments[0];
    const inAuth = group === "(auth)";

    if (!session) {
      if (!inAuth) router.replace("/(auth)/login");
      return;
    }

    // El rol tarda un instante más que la sesión: sin él no se puede decidir
    // grupo, y mandar a todo el mundo a cliente haría parpadear al conductor.
    if (!role) return;

    const target = role === "driver" ? "(conductor)" : "(cliente)";
    if (inAuth || (group !== target && group !== undefined)) {
      router.replace(role === "driver" ? "/(conductor)" : "/(cliente)");
    }
  }, [session, role, loading, segments, router]);

  if (loading) return <Loading label="Abriendo ClicyVoy…" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(cliente)" />
      <Stack.Screen name="(conductor)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigation />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
