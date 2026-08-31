import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDefaultPayment, setDefaultPayment } from "../../lib/payment";
import { Caption, Card, Heading, Screen, Title } from "../../components/ui";
import { colors, spacing } from "../../theme";

/**
 * Métodos de pago (canvas 2i). Aquí solo se elige el PREFERIDO, que es el que
 * aparece marcado al publicar un pedido; el cobro con tarjeta lo sigue haciendo
 * Stripe dentro de cada pedido, con su hoja nativa.
 */
const OPTIONS = [
  {
    key: "card",
    icon: "card-outline",
    label: "Tarjeta o Google Pay",
    hint: "Se cobra al terminar el servicio, con el importe pactado.",
  },
  {
    key: "bizum",
    icon: "phone-portrait-outline",
    label: "Bizum al conductor",
    hint: "Se lo envías a su móvil: antes, durante o al terminar, como acordéis.",
  },
  {
    key: "cash",
    icon: "cash-outline",
    label: "Efectivo al conductor",
    hint: "Pagas en mano al terminar. El conductor no lleva cambio de billetes grandes.",
  },
];

export default function MetodosDePago() {
  const [value, setValue] = useState(null);

  useEffect(() => {
    getDefaultPayment().then(setValue);
  }, []);

  const choose = async key => {
    setValue(key);
    await setDefaultPayment(key);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Métodos de pago" }} />
      <Heading>¿Cómo prefieres pagar?</Heading>
      <Caption>
        Es solo tu opción por defecto: en cada pedido puedes cambiarla antes de publicar.
      </Caption>

      {OPTIONS.map(option => {
        const active = value === option.key;
        return (
          <Pressable key={option.key} onPress={() => choose(option.key)}>
            <Card style={active ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : null}>
              <View style={styles.row}>
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Title style={active ? { color: colors.primary } : null}>{option.label}</Title>
                  <Caption>{option.hint}</Caption>
                </View>
                <Ionicons
                  name={active ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={active ? colors.primary : colors.border}
                />
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Card>
        <View style={styles.row}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
          <Caption style={{ flex: 1 }}>
            ClicyVoy no guarda tu tarjeta: los datos los procesa Stripe en su propia hoja de pago.
          </Caption>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
