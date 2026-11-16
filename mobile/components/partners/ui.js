import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Caption, Card, Title } from "../ui";
import { colors, radius, spacing } from "../../theme";

/** Piezas compartidas de las pantallas de «Gana con ClicyVoy». */

/** Tarjeta con título (y un icono opcional) y una acción a la derecha. */
export function Section({ title, icon, action, children, style }) {
  return (
    <Card style={style}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitle}>
          {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
          <Title style={{ flexShrink: 1 }}>{title}</Title>
        </View>
        {action}
      </View>
      {children}
    </Card>
  );
}

export function LoadingBox({ label = "Cargando…" }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.primary} />
      <Caption>{label}</Caption>
    </View>
  );
}

export function ErrorBox({ text = "No se ha podido cargar.", onRetry }) {
  return (
    <View style={styles.errorBox}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
        <Text style={styles.errorText}>{text}</Text>
      </View>
      {onRetry ? <Button title="Reintentar" icon="refresh" variant="plain" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyBox({ text }) {
  return <Caption style={styles.empty}>{text}</Caption>;
}

/** Aviso de color (bloqueado, en pausa, hecho). tone: "danger" | "warning" | "success". */
export function Notice({ tone = "warning", icon, children }) {
  const palette =
    tone === "danger"
      ? { bg: colors.secondary, fg: colors.destructive, border: colors.destructive }
      : tone === "success"
        ? { bg: colors.successBg, fg: colors.ink, border: colors.success }
        : { bg: colors.warningBg, fg: colors.ink, border: colors.warning };
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
      <Text style={[styles.noticeText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

/** Cifra del resumen: etiqueta, importe y una línea opcional debajo. */
export function Tile({ label, value, subtitle, icon }) {
  return (
    <View style={styles.tile}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon ? <Ionicons name={icon} size={15} color={colors.primary} /> : null}
        <Caption style={{ flexShrink: 1 }}>{label}</Caption>
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      {subtitle ? <Caption>{subtitle}</Caption> : null}
    </View>
  );
}

const COMMISSION_STATUS = {
  pending: { label: "En espera", fg: colors.warning, bg: colors.warningBg },
  awaiting_payment: { label: "Pendiente de pago", fg: colors.warning, bg: colors.warningBg },
  available: { label: "Disponible", fg: colors.success, bg: colors.successBg },
  held: { label: "En revisión", fg: colors.destructive, bg: colors.warningBg },
  requested: { label: "Solicitada", fg: colors.primary, bg: colors.primarySoft },
  paid: { label: "Cobrada", fg: colors.mutedForeground, bg: colors.muted },
  reversed: { label: "Anulada", fg: colors.destructive, bg: colors.muted },
};

const PAYOUT_STATUS = {
  requested: { label: "Solicitado", fg: colors.primary, bg: colors.primarySoft },
  paid: { label: "Pagado", fg: colors.success, bg: colors.successBg },
  rejected: { label: "Rechazado", fg: colors.destructive, bg: colors.muted },
};

function Pill({ config, status }) {
  const c = config[status] || { label: String(status || "—"), fg: colors.mutedForeground, bg: colors.muted };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function CommissionStatusBadge({ status }) {
  return <Pill config={COMMISSION_STATUS} status={status} />;
}

export function PayoutStatusBadge({ status }) {
  return <Pill config={PAYOUT_STATUS} status={status} />;
}

export const KIND_LABEL = { first: "Primer servicio", repeat: "Servicio siguiente" };

/** Fila de lista: dos columnas (texto a la izquierda, cifra a la derecha). */
export function ListRow({ left, right, last }) {
  return (
    <View style={[styles.listRow, !last && styles.listDivider]}>
      <View style={{ flex: 1, gap: 2 }}>{left}</View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  loadingBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  errorBox: {
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.destructive, fontSize: 13, fontFamily: "DMSans_400Regular", lineHeight: 18 },
  empty: { textAlign: "center", paddingVertical: spacing.lg },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: "DMSans_400Regular", lineHeight: 18 },
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  tileValue: { fontSize: 19, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 11.5, fontFamily: "DMSans_500Medium" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  listDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
});
