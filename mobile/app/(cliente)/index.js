import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SERVICE_KEYS, SERVICES } from "../../lib/services";
import { fetchTariffs, servicePriceFrom } from "../../lib/tariffs";
import { Caption, Card, Heading, Screen, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Elección de servicio — primer paso del asistente de pedido.
 *
 * Lee el catálogo de `lib/services.js` y los precios de `app_settings.tariffs`,
 * los MISMOS que la web: si el admin cambia una tarifa en Ajustes, la app lo
 * refleja sin tocar código. Los precios que se ven aquí son informativos; el
 * importe real lo fija `compute_quote` en el servidor.
 *
 * El asistente completo (pasos, direcciones, fotos, pago) es la Etapa 2.
 */
export default function PedirServicio() {
  const [tariffs, setTariffs] = useState(null);

  useEffect(() => {
    let active = true;
    fetchTariffs().then(t => {
      if (active) setTariffs(t);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Heading>¿Qué necesitas mover?</Heading>
        <Caption>Albacete capital · furgoneta y conductor</Caption>
      </View>

      {SERVICE_KEYS.map(key => {
        const service = SERVICES[key];
        const price = tariffs ? servicePriceFrom(tariffs, key) : null;
        return (
          <Pressable key={key} disabled>
            <Card>
              <View style={styles.row}>
                <Text style={styles.emoji}>{service.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Title>{service.label}</Title>
                  <Caption>{service.tagline}</Caption>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Caption>desde</Caption>
                  <Text style={styles.price}>{price != null ? `${price} €` : "—"}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
        <Caption>
          El asistente de pedido llega en la Etapa 2. De momento esta pantalla comprueba que la app
          lee el catálogo y las tarifas reales del mismo backend que la web.
        </Caption>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  emoji: {
    fontSize: 26,
    width: 48,
    height: 48,
    lineHeight: 48,
    textAlign: "center",
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  price: { fontSize: 18, fontWeight: "700", color: colors.primary },
});
