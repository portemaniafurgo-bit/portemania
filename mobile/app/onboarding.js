import { useRef, useState } from "react";
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { Button, Caption } from "../components/ui";
import { colors, radius, spacing } from "../theme";

/**
 * Introducción de 3 pantallas en el PRIMER arranque (canvas 2b del rediseño).
 * Solo se ve una vez: el flag queda en AsyncStorage y el guardia del layout
 * deja de traer aquí. «Saltar» siempre visible: nadie está obligado a leerla.
 */
export const ONBOARDING_KEY = "onboarding_seen_v1";

const SLIDES = [
  {
    icon: "cube-outline",
    title: "Pide en un minuto",
    text: "Portes, mini mudanzas y paquetes en Albacete. Eliges el servicio, haces fotos de la carga y listo: precio cerrado, sin sorpresas.",
  },
  {
    icon: "navigate-outline",
    title: "Síguelo en vivo",
    text: "Ve a tu conductor moverse en el mapa, con la hora de llegada real. Y habla con él por chat sin salir de la app.",
  },
  {
    icon: "pricetag-outline",
    title: "Tu precio, tu decisión",
    text: "¿Tienes un presupuesto? Propón tu precio: los conductores lo aceptan o te hacen una contraoferta, y cierras el trato tú.",
  },
];

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const router = useRouter();
  const { session, role } = useAuth();
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => {});
    // Al verla desde Perfil ya hay sesión: devolver al login sería echar a
    // alguien que estaba dentro.
    if (session) {
      router.replace(role === "driver" ? "/(conductor)/ofertas" : "/(cliente)/pedir");
      return;
    }
    router.replace("/(auth)/login");
  };

  const next = () => {
    if (page >= SLIDES.length - 1) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.skipRow}>
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.skip} onPress={finish}>
          Saltar
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map(slide => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.emojiWrap}>
              <Ionicons name={slide.icon} size={54} color={colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.text}>{slide.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Button title={page >= SLIDES.length - 1 ? "Empezar" : "Siguiente"} onPress={next} />
        <Caption style={{ textAlign: "center" }}>Albacete capital · CP 02001–02008</Caption>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  skipRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  logo: { width: 120, height: 34 },
  skip: { fontSize: 14, fontFamily: "DMSans_500Medium", color: colors.mutedForeground, padding: spacing.sm },
  slide: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  emojiWrap: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 56 },
  title: { fontSize: 26, fontFamily: "Poppins_700Bold", color: colors.foreground, textAlign: "center" },
  text: {
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  footer: { padding: spacing.lg, gap: spacing.md },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 22 },
});
