import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { STRIPE_MERCHANT_ID, STRIPE_PUBLISHABLE_KEY } from "../lib/payments";
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

    if (!session) {
      if (group !== "(auth)") router.replace("/(auth)/login");
      return;
    }

    // El rol tarda un instante más que la sesión: sin él no se puede decidir
    // grupo, y mandar a todo el mundo a cliente haría parpadear al conductor.
    if (!role) return;

    // Redirigir SIEMPRE que no se esté ya en el grupo correcto — incluido el
    // arranque en la raíz (group undefined): no redirigir ahí dejaba al usuario
    // con sesión mirando "Abriendo ClicyVoy…" para siempre (bug real, 0.1.1).
    // El destino es una pantalla CON NOMBRE, nunca el grupo a secas: tres
    // rutas index disputándose "/" era lo que provocaba el "Unmatched Route".
    const target = role === "driver" ? "(conductor)" : "(cliente)";
    if (group !== target) {
      router.replace(role === "driver" ? "/(conductor)/ofertas" : "/(cliente)/pedir");
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
  // La tipografía de la marca (la landing titula con Poppins). Si tarda o
  // falla, la app arranca igual con la del sistema: una fuente nunca puede
  // dejar la pantalla en blanco.
  const [fontsLoaded] = useFonts({ Poppins_600SemiBold, Poppins_700Bold });
  if (!fontsLoaded) return <Loading label="Abriendo ClicyVoy…" />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier={STRIPE_MERCHANT_ID}
        >
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigation />
          </AuthProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
