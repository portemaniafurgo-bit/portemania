import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { euro } from "../lib/money";
import { Caption, Overline } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Planta y ascensor en un solo control.
 *
 * Antes eran dos cosas separadas: un interruptor «hay ascensor» y, solo si lo
 * apagabas, un contador de plantas. Quien no tiene ascensor tenía que marcar y
 * desmarcar el interruptor para poder tocar el número — un paso absurdo. Aquí
 * se elige la planta directamente y «Con ascensor» es una opción más: elegir
 * planta ya significa que no hay ascensor.
 */
const FLOORS = [0, 1, 2, 3, 4, 5];

export default function FloorPicker({ label, hasLift, floors, onChange, pricePerFloor = 15 }) {
  const withLift = hasLift === true;
  const current = withLift ? null : Number(floors) || 0;

  return (
    <View style={{ gap: spacing.sm }}>
      <Overline>{label}</Overline>

      <View style={styles.row}>
        {/* Con ascensor: no se cobran plantas aunque el piso sea un quinto */}
        <Pressable
          onPress={() => onChange(true, 0)}
          style={[styles.chip, styles.liftChip, withLift && styles.chipOn]}
        >
          <Ionicons
            name="swap-vertical-outline"
            size={15}
            color={withLift ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.chipText, withLift && styles.chipTextOn]}>Con ascensor</Text>
        </Pressable>

        {FLOORS.map(n => {
          const active = !withLift && current === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(false, n)}
              style={[styles.chip, active && styles.chipOn]}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>
                {n === 0 ? "Bajo" : `${n}ª`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Caption>
        {withLift
          ? "Con ascensor no se cobran plantas."
          : current > 0
            ? `${current} planta${current === 1 ? "" : "s"} sin ascensor · ${euro(current * pricePerFloor)}`
            : "Planta baja: sin coste añadido."}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  liftChip: { flexDirection: "row", gap: 6 },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  chipTextOn: { color: colors.primary, fontFamily: "DMSans_700Bold" },
});
