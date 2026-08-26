import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { euro } from "../lib/money";
import { Body, Button, Caption, Overline, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Todo lo que el cliente ha pedido, ANTES de aceptar.
 *
 * Hasta ahora el conductor solo veía direcciones e importe: aceptaba un precio
 * a ciegas y descubría al llegar que eran seis cajas y un armario. Aquí están
 * la descripción, las fotos ampliables, las plantas, la ayuda y las notas.
 */
export default function OfferDetailSheet({ order, service, visible, onClose, onAccept, onCounter, busy, blocked }) {
  const [zoom, setZoom] = useState(null);
  if (!order) return null;

  const negotiable = order.proposed_price != null;
  const price = negotiable ? order.proposed_price : order.estimated_price;
  const floor = (floors, hasLift) =>
    floors ? `${floors}ª ${hasLift ? "con" : "sin"} ascensor` : "A pie de calle";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Title>{service?.label || "Servicio"}</Title>
            <Caption>Todo lo que ha pedido el cliente</Caption>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.price}>{euro(Number(price), 2)}</Text>
            <Caption>{negotiable ? "propone el cliente" : "precio cerrado"}</Caption>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Overline>QUÉ HAY QUE MOVER</Overline>
            {order.cargo_description ? (
              <Body>{order.cargo_description}</Body>
            ) : (
              <Caption>El cliente no ha descrito la carga.</Caption>
            )}
          </View>

          {order.cargo_photos?.length ? (
            <View style={{ gap: spacing.sm }}>
              <Overline>
                {order.cargo_photos.length} FOTO{order.cargo_photos.length === 1 ? "" : "S"} · TOCA PARA AMPLIAR
              </Overline>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {order.cargo_photos.map(url => (
                    <Pressable key={url} onPress={() => setZoom(url)}>
                      <Image source={{ uri: url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            <Caption>Este pedido no lleva fotos.</Caption>
          )}

          <View style={{ gap: spacing.sm }}>
            <Overline>RECORRIDO Y ACCESO</Overline>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Body>{order.origin_address || "—"}</Body>
                <Caption>{floor(order.origin_floors, order.origin_has_lift)}</Caption>
              </View>
            </View>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.foreground, borderRadius: 2 }]} />
              <View style={{ flex: 1 }}>
                <Body>{order.destination_address || "—"}</Body>
                <Caption>{floor(order.destination_floors, order.destination_has_lift)}</Caption>
              </View>
            </View>
          </View>

          <View style={styles.tags}>
            <Tag text={order.needs_help ? "Ayuda contratada" : "Sin ayuda"} warn={order.needs_help} />
            {order.items_count ? <Tag text={`${order.items_count} objeto${order.items_count === 1 ? "" : "s"}`} /> : null}
            {order.package_weight ? <Tag text={`${order.package_weight} kg`} /> : null}
            {order.extra_hours ? <Tag text={`${order.extra_hours} h extra`} /> : null}
            {order.distance_km ? (
              <Tag text={`${Number(order.distance_km).toFixed(1).replace(".", ",")} km de ruta`} />
            ) : null}
            <Tag text={order.payment_method === "cash" ? "Cobro en efectivo" : "Pago con tarjeta"} />
          </View>

          {order.needs_help && order.help_description ? (
            <View style={styles.note}>
              <Overline>CON QUÉ NECESITA AYUDA</Overline>
              <Body>{order.help_description}</Body>
            </View>
          ) : null}

          {order.notes ? (
            <View style={styles.note}>
              <Overline>NOTAS DEL CLIENTE</Overline>
              <Body>{order.notes}</Body>
            </View>
          ) : null}
        </ScrollView>

        <View style={{ gap: spacing.sm }}>
          <Button
            title={negotiable ? `Aceptar por ${euro(Number(price))}` : "Aceptar servicio"}
            loading={busy}
            disabled={blocked}
            onPress={onAccept}
          />
          {negotiable ? (
            <Button title="Contraofertar" variant="plain" disabled={blocked} onPress={onCounter} />
          ) : null}
          <Pressable onPress={onClose}>
            <Caption style={{ textAlign: "center" }}>Cerrar</Caption>
          </Pressable>
        </View>

        <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
          <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
            <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

function Tag({ text, warn }) {
  return (
    <View style={[styles.tag, warn && { backgroundColor: colors.warningBg }]}>
      <Text style={[styles.tagText, warn && { color: "#B27700" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#00000066" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.screen,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  handle: { alignSelf: "center", width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  price: { fontSize: 24, fontFamily: "Poppins_700Bold", color: colors.primary },
  photo: { width: 150, height: 120, borderRadius: 12, backgroundColor: colors.secondary },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.background },
  tagText: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.ink },
  note: { backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 4 },
  zoomBackdrop: { flex: 1, backgroundColor: "#000000E6", alignItems: "center", justifyContent: "center" },
  zoomImage: { width: "100%", height: "80%" },
});
