import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "./onboarding";
import { StatusBar } from "expo-status-bar";
import { useFonts, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import * as SplashScreen from "expo-splash-screen";

// El splash morado se queda ~900 ms (canvas 2a): sin esto se ocultaba en
// cuanto React pintaba el primer frame y parecía que no había splash.
SplashScreen.preventAutoHideAsync().catch(() => {});
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
  // null = aún leyendo el flag; true/false = decidido. Sin esperar a saberlo,
  // el primer arranque parpadearía login → onboarding.
  const [onboardingSeen, setOnboardingSeen] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(v => setOnboardingSeen(!!v))
      .catch(() => setOnboardingSeen(true)); // ante la duda, no bloquear
    // Se re-lee al navegar Y al cambiar la sesión: el cierre de sesión es el
    // momento en que el flag vuelve a importar.
  }, [segments[0], session]);

  usePushNotifications({ userId: session?.user?.id, role });

  useEffect(() => {
    if (loading || onboardingSeen === null) return;

    const group = segments[0];

    // De la introducción se sale con «Saltar» o «Empezar», nunca a empujones.
    // Sin esto, abrirla a propósito desde Perfil rebotaba al instante: el
    // guardia corría antes de que se releyera el flag y veía "ya vista".
    if (group === "onboarding") return;

    if (!session) {
      // Primer arranque: la introducción, una sola vez (canvas 2b).
      if (!onboardingSeen) {
        if (group !== "onboarding") router.replace("/onboarding");
        return;
      }
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
    // ⚠️ onboardingSeen DEBE estar en las dependencias: el guardia lo lee, y
    // sin escucharlo, cuando el flag se resolvía después que la sesión el
    // efecto no re-evaluaba — el onboarding se saltaba en silencio (bug real
    // reportado el 2026-08-18: "nunca vi las pantallas de introducción").
  }, [session, role, loading, segments, router, onboardingSeen]);

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
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    // 900 ms totales de marca en pantalla y transición al contenido.
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 550);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  // Mientras el splash nativo está visible no se pinta nada debajo: devolver
  // null evita el doble fondo blanco que delataba el cambio.
  if (!fontsLoaded) return null;

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
