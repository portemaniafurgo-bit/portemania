import { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { euro } from "../lib/money";
import { Caption, Overline } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * «Proponer mi precio» del canvas (1e): interruptor para activarlo, importe
 * enorme en morado entre dos botones redondos de −/+, barra arrastrable con
 * sus topes rotulados y una pista debajo.
 *
 * El suelo (60 % de la tarifa) lo valida también el servidor; aquí solo evita
 * que se pueda arrastrar por debajo.
 */
/**
 * Probabilidad de que un conductor acepte, según lo que se aleje el importe de
 * la tarifa (idea de Renato, 18/08/2026): cuanto más baja la oferta más
 * difícil, y cuanto más sube, más fácil. Se pinta con color porque es lo que se
 * entiende sin leer: rojo cuesta, ámbar tardará, morado es lo normal, verde va
 * rápido.
 *
 * Los MISMOS tramos que la web (src/lib/acceptance.js): si se tocan aquí, hay
 * que tocarlos allí.
 */
export function acceptanceOf(value, closed) {
  const ratio = closed > 0 ? value / closed : 1;
  if (ratio < 0.75) {
    return {
      color: colors.destructive,
      label: "Difícil de aceptar",
      hint: "Muy por debajo de la tarifa: puede que ningún conductor lo coja.",
    };
  }
  if (ratio < 0.92) {
    return {
      color: colors.warning,
      label: "Puede tardar",
      hint: "Por debajo de la tarifa: alguno lo aceptará, pero esperarás más.",
    };
  }
  if (ratio < 1) {
    return {
      color: colors.primary,
      label: "Probable",
      hint: "Cerca de la tarifa: lo normal es que te lo acepten.",
    };
  }
  if (ratio === 1) {
    return {
      color: colors.primary,
      label: "Lo habitual",
      hint: "Justo la tarifa de ClicyVoy: se acepta casi siempre a la primera.",
    };
  }
  return {
    color: colors.success,
    label: "Muy fácil",
    hint: "Por encima de la tarifa: tendrás conductor enseguida.",
  };
}

export default function OfferControl({ value, min, max, closed, enabled, onToggle, onChange }) {
  const acceptance = acceptanceOf(value, closed);
  const width = useRef(0);
  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e, gesture) => setFromX(gesture.moveX - offsetX.current),
    }),
  ).current;

  const offsetX = useRef(0);
  const setFromX = x => {
    if (!width.current) return;
    const ratio = Math.min(1, Math.max(0, x / width.current));
    onChange(Math.round(min + ratio * (max - min)));
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Overline style={{ color: colors.primary }}>PROPONER MI PRECIO</Overline>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.primary, false: colors.hairline }}
          thumbColor="#FFFFFF"
        />
      </View>

      {enabled ? (
        <>
          <View style={styles.amountRow}>
            <Pressable
              onPress={() => onChange(Math.max(min, value - 1))}
              style={styles.round}
              hitSlop={6}
            >
              <Ionicons name="remove" size={22} color={colors.primary} />
            </Pressable>
            <View style={{ alignItems: "center", minWidth: 130 }}>
              <Text style={[styles.amount, { color: acceptance.color }]}>{euro(value)}</Text>
              <View style={[styles.badge, { backgroundColor: acceptance.color + "1A" }]}>
                <View style={[styles.badgeDot, { backgroundColor: acceptance.color }]} />
                <Text style={[styles.badgeText, { color: acceptance.color }]}>
                  {acceptance.label}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => onChange(Math.min(max, value + 1))}
              style={styles.round}
              hitSlop={6}
            >
              <Ionicons name="add" size={22} color={colors.primary} />
            </Pressable>
          </View>

          <View
            style={styles.track}
            onLayout={e => {
              width.current = e.nativeEvent.layout.width;
              offsetX.current = e.nativeEvent.layout.x + spacing.screen + 18;
            }}
            {...pan.panHandlers}
          >
            {/* La barra se tiñe según lo fácil que sea que lo acepten */}
            <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: acceptance.color }]} />
            <View style={[styles.thumb, { left: `${pct * 100}%`, backgroundColor: acceptance.color }]} />
          </View>

          <View style={styles.limits}>
            <Caption style={{ fontSize: 11.5 }}>mínimo {euro(min)}</Caption>
            <Caption style={{ fontSize: 11.5 }}>precio cerrado {euro(closed)}</Caption>
          </View>

          <View style={[styles.hint, { backgroundColor: acceptance.color + "14" }]}>
            <Text style={styles.hintText}>
              {acceptance.hint}
              {value !== closed
                ? ` ${value < closed ? "Pides" : "Ofreces"} ${euro(Math.abs(closed - value))} ${
                    value < closed ? "menos" : "más"
                  } que la tarifa.`
                : ""}
            </Text>
          </View>
        </>
      ) : (
        <Caption>
          Se publicará al precio cerrado de {euro(closed)}. Actívalo si prefieres proponer tú el
          importe.
        </Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: 18,
    gap: 14,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  amount: {
    fontSize: 42,
    lineHeight: 46,
    fontFamily: "Poppins_700Bold",
    color: colors.primary,
    minWidth: 130,
    textAlign: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    marginHorizontal: 4,
    justifyContent: "center",
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.primary, borderRadius: 3 },
  thumb: {
    position: "absolute",
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    marginLeft: -9,
  },
  limits: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  hint: { borderRadius: 14, padding: 12, paddingHorizontal: 14 },
  hintText: { fontSize: 12.5, lineHeight: 19, fontFamily: "DMSans_400Regular", color: colors.ink },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11.5, fontFamily: "DMSans_700Bold" },
});
