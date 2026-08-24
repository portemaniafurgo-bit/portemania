import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { countUnread } from "../lib/unread";
import { useTyping } from "../lib/typing";
import { colors, radius, spacing } from "../theme";

/**
 * Chat como botón EMERGENTE, flotando sobre la pantalla del pedido.
 *
 * Antes era una fila más en el listado y había que bajar hasta ella: los
 * mensajes se veían tarde, que es justo lo que se quería arreglar. Aquí está
 * siempre a la vista, con el número de mensajes sin leer y, cuando la otra
 * parte escribe, con el «Escribiendo…» encima.
 */
export default function ChatBubbleButton({ orderId, partnerName, bottom = 24 }) {
  const router = useRouter();
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const { partnerTyping } = useTyping(orderId, { user });

  // Al volver del chat, los no leídos vuelven a cero.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (orderId && user?.id) {
        countUnread([orderId], user.id).then(counts => {
          if (active) setUnread(counts[orderId] || 0);
        });
      }
      return () => {
        active = false;
      };
    }, [orderId, user?.id]),
  );

  if (!orderId) return null;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {partnerTyping ? (
        <View style={styles.typing}>
          <Text style={styles.typingText}>
            {partnerName ? `${partnerName} está escribiendo…` : "Escribiendo…"}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push(`/chat/${orderId}`)}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: spacing.screen, alignItems: "flex-end", gap: spacing.sm },
  typing: {
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
  },
  typingText: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: colors.destructive,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, fontFamily: "DMSans_700Bold", color: "#FFFFFF" },
});
