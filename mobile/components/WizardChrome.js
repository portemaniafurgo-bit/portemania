import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Caption, Display, Heading } from "./ui";
import { colors, spacing } from "../theme";

/**
 * Armazón de los pasos del asistente, calcado del canvas (1b–1f):
 *
 *   cabecera BLANCA fija  → barras de progreso, «Paso X de 5» y título
 *   cuerpo GRIS que rueda → las tarjetas del paso
 *   pie BLANCO fijo       → un único botón de 54, siempre a la vista
 *
 * Antes todo iba dentro de un mismo scroll y el botón quedaba al final del
 * contenido: por eso «no se parecía» aunque los textos fueran los mismos.
 */
export default function WizardChrome({
  step,
  total,
  title,
  subtitle,
  showStepLabel = false,
  onBack,
  cta,
  ctaIcon,
  ctaLoading,
  onCta,
  children,
  footerExtra,
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.bars}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[styles.bar, { backgroundColor: i <= step ? colors.primary : colors.hairline }]}
            />
          ))}
        </View>

        <View style={styles.titleRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.back} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, gap: 6 }}>
            {showStepLabel ? (
              <Text style={styles.stepLabel}>
                Paso {step + 1} de {total}
              </Text>
            ) : null}
            {showStepLabel ? <Display>{title}</Display> : <Heading>{title}</Heading>}
            {subtitle ? <Caption style={{ fontSize: 13.5, lineHeight: 20 }}>{subtitle}</Caption> : null}
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={styles.footer}>
        {footerExtra}
        <Button title={cta} iconAfter={ctaIcon} loading={ctaLoading} onPress={onCta} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: 18,
  },
  bars: { flexDirection: "row", gap: 6, marginBottom: 16 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepLabel: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.subtle },
  body: { padding: 16, paddingHorizontal: spacing.screen, gap: 14, paddingBottom: spacing.xl },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.screen,
    paddingTop: 14,
    paddingBottom: 16,
    gap: spacing.md,
  },
});
