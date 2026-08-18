import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { resolveProofUrl } from "../lib/deliveryProof";
import { Caption, Card, Overline, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Prueba de entrega TAL Y COMO LA VE EL CLIENTE: la foto de lo entregado, la
 * firma de quien recibió y la hora.
 *
 * El conductor las sube al bucket privado `delivery-proofs`; la RLS de Storage
 * ya deja leerlas al dueño del pedido, así que aquí solo hay que pedir la URL
 * firmada. Sin esta tarjeta el cliente tenía que fiarse de una frase: si un día
 * discute una entrega, esto es lo que zanja la conversación.
 */
export default function DeliveryProof({ order }) {
  const [photo, setPhoto] = useState(null);
  const [signature, setSignature] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let active = true;
    resolveProofUrl(order?.proof_photo_url).then(url => active && setPhoto(url));
    resolveProofUrl(order?.proof_signature_url).then(url => active && setSignature(url));
    return () => {
      active = false;
    };
  }, [order?.proof_photo_url, order?.proof_signature_url]);

  if (!order?.proof_photo_url && !order?.proof_signature_url) return null;

  const signedAt = order.delivered_signature_at || order.delivery_time;

  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        <Title style={{ flex: 1 }}>Prueba de entrega</Title>
      </View>

      {photo ? (
        <Pressable onPress={() => setZoom(photo)}>
          <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
          <Caption>Foto de lo entregado · toca para ampliar</Caption>
        </Pressable>
      ) : order.proof_photo_url ? (
        <Caption>Cargando la foto de la entrega…</Caption>
      ) : null}

      {signature ? (
        <View style={{ gap: spacing.xs }}>
          <Overline>FIRMA DE QUIEN RECIBIÓ</Overline>
          <Pressable onPress={() => setZoom(signature)}>
            <Image source={{ uri: signature }} style={styles.signature} resizeMode="contain" />
          </Pressable>
          <Caption>
            {order.recipient_name ? `Firmado por ${order.recipient_name}` : "Firma recogida"}
            {signedAt ? ` · ${format(new Date(signedAt), "d/MM/yyyy 'a las' HH:mm")}` : ""}
          </Caption>
        </View>
      ) : order.proof_signature_url ? (
        <Caption>Cargando la firma…</Caption>
      ) : null}

      {/* Ampliar: una firma o una foto pequeña no sirven para reclamar nada */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />
          <View style={styles.zoomClose}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </View>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  photo: { width: "100%", height: 190, borderRadius: radius.md, backgroundColor: colors.secondary },
  signature: {
    width: "100%",
    height: 110,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomBackdrop: { flex: 1, backgroundColor: "#000000E6", alignItems: "center", justifyContent: "center" },
  zoomImage: { width: "100%", height: "80%" },
  zoomClose: { position: "absolute", top: 40, right: 24 },
});
