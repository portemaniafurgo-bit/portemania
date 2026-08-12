import { Image, StyleSheet, View } from "react-native";
import { Caption, Title } from "./ui";
import { spacing } from "../theme";

/**
 * Estado vacío con personalidad: el isotipo suave + un mensaje útil, en vez de
 * una línea gris seca (UX-3.7 del documento de mejoras).
 */
export default function EmptyState({ title, hint }) {
  return (
    <View style={styles.wrap}>
      <Image source={require("../assets/icon.png")} style={styles.mark} resizeMode="contain" />
      <Title style={{ textAlign: "center" }}>{title}</Title>
      {hint ? <Caption style={{ textAlign: "center" }}>{hint}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  mark: { width: 72, height: 72, opacity: 0.35 },
});
