import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { rating1 } from "../lib/money";
import { Body, Caption, Card, Title } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Quién va a venir a tu casa: foto, valoración, servicios hechos, la furgoneta
 * y sus fotos.
 *
 * Es la tarjeta que decide si el cliente se queda tranquilo. Antes solo veía un
 * nombre y una matrícula; las fotos de la furgoneta ya estaban subidas (son
 * obligatorias para verificarse) pero no se enseñaban en ningún sitio.
 */
export default function DriverCard({ driver, driverId, onCall }) {
  const [jobs, setJobs] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    if (!driverId) return;
    // Servicios entregados: el número sale de sus entregas, no de una columna
    // que alguien pueda inflar.
    supabase
      .from("transport_requests")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId)
      .eq("status", "delivered")
      .then(({ count }) => setJobs(count ?? 0));
  }, [driverId]);

  if (!driver) return null;

  const photos = [
    driver.vehicle_photo_front_url,
    driver.vehicle_photo_left_url,
    driver.vehicle_photo_right_url,
    driver.vehicle_photo_rear_url,
  ].filter(Boolean);

  return (
    <Card>
      <View style={styles.head}>
        {driver.photo_url ? (
          <Image source={{ uri: driver.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarInitial}>
              {(driver.full_name || "C").slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, gap: 3 }}>
          <Title>{driver.full_name || "Tu conductor"}</Title>
          <View style={styles.stats}>
            {driver.rating ? (
              <View style={styles.stat}>
                <Ionicons name="star" size={13} color={colors.accent} />
                <Text style={styles.statText}>{rating1(driver.rating)}</Text>
              </View>
            ) : (
              <Caption>Sin valoraciones todavía</Caption>
            )}
            {jobs != null ? (
              <Caption>
                {jobs} servicio{jobs === 1 ? "" : "s"}
              </Caption>
            ) : null}
            {driver.status === "verified" ? (
              <View style={styles.verified}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            ) : null}
          </View>
          <Caption>
            {driver.vehicle_brand || (driver.vehicle_type === "large" ? "Furgoneta grande" : "Furgoneta")}
            {driver.vehicle_plate ? ` · ${driver.vehicle_plate}` : ""}
          </Caption>
        </View>

        {driver.phone ? (
          <Pressable
            onPress={() => (onCall ? onCall() : Linking.openURL(`tel:${driver.phone}`))}
            style={styles.call}
            hitSlop={8}
          >
            <Ionicons name="call" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {/* La furgoneta que va a aparecer en tu puerta */}
      {photos.length ? (
        <>
          <Caption>La furgoneta · toca para ampliar</Caption>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {photos.map(url => (
                <Pressable key={url} onPress={() => setZoom(url)}>
                  <Image source={{ uri: url }} style={styles.vehiclePhoto} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 22, fontFamily: "Poppins_700Bold", color: colors.primary },
  stats: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 12.5, fontFamily: "DMSans_700Bold", color: colors.foreground },
  verified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.successBg,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 10.5, fontFamily: "DMSans_700Bold", color: colors.success },
  call: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  vehiclePhoto: { width: 140, height: 100, borderRadius: 12, backgroundColor: colors.secondary },
  zoomBackdrop: { flex: 1, backgroundColor: "#000000E6", alignItems: "center", justifyContent: "center" },
  zoomImage: { width: "100%", height: "80%" },
});
