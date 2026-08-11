import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Caption, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Controles del asistente que no existen en `ui.js` porque solo se usan aquí:
 * opciones tipo radio, interruptores con explicación, contador y barra de pasos.
 */

export function Steps({ current, total }) {
  return (
    <View style={styles.steps}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.stepBar,
            { backgroundColor: i <= current ? colors.primary : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

export function Option({ label, description, selected, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Caption>{description}</Caption> : null}
      </View>
    </Pressable>
  );
}

export function Toggle({ label, description, value, onValueChange }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Caption>{description}</Caption> : null}
      </View>
      <Switch value={!!value} onValueChange={onValueChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

export function Counter({ label, value, onChange, min = 0, max = 99 }) {
  const n = Number(value) || 0;
  return (
    <View style={styles.toggle}>
      <Text style={[styles.optionLabel, { flex: 1 }]}>{label}</Text>
      <View style={styles.counter}>
        <Pressable
          onPress={() => onChange(Math.max(min, n - 1))}
          disabled={n <= min}
          style={[styles.counterBtn, n <= min && { opacity: 0.4 }]}
        >
          <Text style={styles.counterSign}>−</Text>
        </Pressable>
        <Text style={styles.counterValue}>{n}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, n + 1))}
          disabled={n >= max}
          style={[styles.counterBtn, n >= max && { opacity: 0.4 }]}
        >
          <Text style={styles.counterSign}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Desglose del precio, con las mismas líneas que enseña la web. */
export function PriceSummary({ quote }) {
  if (!quote?.lines?.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      {quote.lines.map(line => (
        <View key={line.key} style={styles.priceLine}>
          <Caption style={{ flex: 1 }}>{line.label}</Caption>
          <Caption>{line.amount} €</Caption>
        </View>
      ))}
      <View style={[styles.priceLine, styles.priceTotal]}>
        <Title style={{ flex: 1 }}>Total</Title>
        <Text style={styles.total}>{quote.total} €</Text>
      </View>
      <Caption>
        Precio cerrado. El importe definitivo lo confirma ClicyVoy al crear el pedido.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: spacing.xs },
  stepBar: { flex: 1, height: 4, borderRadius: radius.full },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionLabel: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  counter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  counterSign: { fontSize: 20, color: colors.foreground },
  counterValue: { fontSize: 16, fontWeight: "600", minWidth: 28, textAlign: "center", color: colors.foreground },
  priceLine: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  priceTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  total: { fontSize: 22, fontWeight: "700", color: colors.primary },
});
