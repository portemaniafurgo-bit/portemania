import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SERVICE_ICONS } from "./ServiceIcon";
import TrackingMap from "./TrackingMap";
import { Button } from "./ui";
import { euro } from "../lib/money";
import { colors, radius, spacing } from "../theme";

/**
 * Tarjeta de oferta del conductor, calcada del canvas 1i: chip del servicio y
 * cuándo se publicó, importe grande en morado con de quién es el precio, las
 * dos direcciones unidas por un raíl, las etiquetas de contexto, el mapa de la
 * recogida y los dos botones.
 */
export default function OfferCard({
  order,
  service,
  publishedLabel,
  distanceLabel,
  pickup,
  negotiable,
  myOffer,
  blocked,
  busy,
  onAccept,
  onCounter,
  onChangeCounter,
}) {
  const originFloor = floorLabel(order.origin_floors, order.origin_has_lift);
  const destFloor = floorLabel(order.destination_floors, order.destination_has_lift);
  const price = negotiable ? order.proposed_price : order.estimated_price;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <View style={styles.chip}>
            <Ionicons name={SERVICE_ICONS[service?.key] || "cube-outline"} size={14} color={colors.primary} />
            <Text style={styles.chipText}>{service?.label || "Servicio"}</Text>
          </View>
          <Text style={styles.published}>{publishedLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.price}>{euro(Number(price), Number.isInteger(Number(price)) ? 0 : 2)}</Text>
          <Text style={styles.priceLabel}>{negotiable ? "propone el cliente" : "precio cerrado"}</Text>
        </View>
      </View>

      {/* Raíl de direcciones: punto morado arriba, cuadrado negro abajo */}
      <View style={styles.addresses}>
        <View style={styles.rail}>
          <View style={styles.railDot} />
          <View style={styles.railLine} />
          <View style={styles.railSquare} />
        </View>
        <View style={{ flex: 1, gap: 11 }}>
          <Text style={styles.address}>
            {order.origin_address || "—"}
            {originFloor ? <Text style={styles.addressMeta}> · {originFloor}</Text> : null}
          </Text>
          <Text style={styles.address}>
            {order.destination_address || "—"}
            {destFloor ? <Text style={styles.addressMeta}> · {destFloor}</Text> : null}
          </Text>
        </View>
      </View>

      <View style={styles.tags}>
        {distanceLabel ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{distanceLabel}</Text>
          </View>
        ) : null}
        {order.needs_help ? (
          <View style={[styles.tag, { backgroundColor: colors.warningBg }]}>
            <Text style={[styles.tagText, { color: "#B27700" }]}>con ayuda</Text>
          </View>
        ) : null}
        {order.package_weight ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{order.package_weight} kg</Text>
          </View>
        ) : null}
        {order.distance_km ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {Number(order.distance_km).toFixed(1).replace(".", ",")} km de ruta
            </Text>
          </View>
        ) : null}
        {/* Cómo se cobra, antes de aceptar: cambia si hay que llevar cambio. */}
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {order.payment_method === "cash" ? "cobro en efectivo" : "pago con tarjeta"}
          </Text>
        </View>
      </View>

      {/* El mapa de la recogida va SIEMPRE: el conductor decide por dónde está */}
      {pickup ? (
        <View style={styles.map}>
          <TrackingMap driverLocation={null} target={pickup} height={112} bare targetKind="pickup" />
        </View>
      ) : null}

      {myOffer ? (
        <View style={styles.myOffer}>
          <Text style={styles.myOfferText}>Tu contraoferta: {euro(Number(myOffer.amount), 2)}</Text>
          <Pressable onPress={onChangeCounter} hitSlop={6}>
            <Text style={styles.myOfferLink}>Cambiar</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            title={negotiable ? `Aceptar por ${euro(Number(price))}` : "Aceptar servicio"}
            loading={busy}
            disabled={blocked}
            onPress={onAccept}
            style={styles.accept}
          />
          {negotiable ? (
            <Button
              title="Contraofertar"
              variant="plain"
              disabled={blocked}
              onPress={onCounter}
              style={styles.counter}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/** «3ª con ascensor» / «2ª sin ascensor», como rotula el canvas las plantas. */
function floorLabel(floors, hasLift) {
  if (!floors) return null;
  return `${floors}ª ${hasLift ? "con" : "sin"} ascensor`;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 14 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.primary },
  published: { fontSize: 11.5, fontFamily: "DMSans_400Regular", color: colors.subtle, marginTop: 8 },
  price: { fontSize: 30, lineHeight: 32, fontFamily: "Poppins_700Bold", color: colors.primary },
  priceLabel: { fontSize: 11, fontFamily: "DMSans_400Regular", color: colors.subtle, marginTop: 4 },
  addresses: { flexDirection: "row", gap: 12 },
  rail: { width: 12, alignItems: "center", paddingTop: 5 },
  railDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  railLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
  railSquare: { width: 8, height: 8, borderRadius: 2, backgroundColor: colors.foreground },
  address: { fontSize: 14, fontFamily: "DMSans_500Medium", color: colors.foreground },
  addressMeta: { fontSize: 12, fontFamily: "DMSans_400Regular", color: colors.subtle },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.background },
  tagText: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.ink },
  map: { height: 112, borderRadius: 16, overflow: "hidden" },
  actions: { flexDirection: "row", gap: 9 },
  accept: { flex: 1, height: 50, borderRadius: 25 },
  counter: { height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 18 },
  myOffer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    padding: 14,
  },
  myOfferText: { fontSize: 13.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  myOfferLink: { fontSize: 13, fontFamily: "DMSans_700Bold", color: colors.primary },
});
