import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { colors, radius, spacing } from "../theme";

/**
 * Direcciones que este cliente ya ha usado, en fila y de un toque.
 *
 * Es lo primero que hace Uber o Cabify: nadie teclea su portal cada vez. Salen
 * de sus propios pedidos (la RLS ya limita la consulta a los suyos), sin tabla
 * nueva ni nada que mantener.
 */
export default function RecentAddresses({ field, onPick }) {
  const [addresses, setAddresses] = useState([]);

  useEffect(() => {
    let active = true;
    supabase
      .from("transport_requests")
      .select("origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng")
      .order("created_date", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!active || !data) return;
        const seen = new Set();
        const list = [];
        for (const row of data) {
          const address = field === "origin" ? row.origin_address : row.destination_address;
          const lat = field === "origin" ? row.origin_lat : row.destination_lat;
          const lng = field === "origin" ? row.origin_lng : row.destination_lng;
          const key = (address || "").trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          list.push({ address, lat, lng });
          if (list.length === 6) break;
        }
        setAddresses(list);
      });
    return () => {
      active = false;
    };
  }, [field]);

  if (!addresses.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {addresses.map(item => (
        <Pressable key={item.address} onPress={() => onPick(item)} style={styles.chip}>
          <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
          <Text style={styles.text} numberOfLines={1}>
            {/* Solo la calle y el número: el resto no cabe y no aporta */}
            {item.address.split(",").slice(0, 2).join(",")}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 230,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 12.5, fontFamily: "DMSans_500Medium", color: colors.foreground, flexShrink: 1 },
});
