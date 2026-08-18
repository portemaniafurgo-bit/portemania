import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { useChat, useOrder } from "../lib/orders";
import { markChatRead } from "../lib/unread";
import { pickPhotos, takePhoto } from "../lib/photos";
import { Caption, Loading } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Chat del pedido A PANTALLA COMPLETA (canvas 2g): cabecera con la otra
 * persona, burbujas llenando la pantalla (las mías moradas), fotos, error en
 * línea y barra de escritura fija abajo. Lo usan cliente y conductor; solo
 * cambia quién es "la otra parte".
 */
/** «Hoy», «Ayer» o «12 de agosto» para el separador de día. */
function dayLabel(date) {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "d 'de' MMMM", { locale: es });
}

/**
 * Fecha de un mensaje. Si viniera vacía o corrupta, date-fns lanza y la
 * pantalla entera se queda EN NEGRO: un mensaje raro no puede tumbar el chat.
 */
function messageDate(message) {
  const date = new Date(message?.created_date ?? NaN);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function ChatThread({ orderId, partnerRole }) {
  const router = useRouter();
  const { user, role } = useAuth();
  const { order, driver, loading } = useOrder(orderId);
  const { messages, send, sending } = useChat(orderId, { user, role });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  // Texto del último mensaje que no se pudo enviar, para reintentarlo.
  const [failed, setFailed] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Pantalla dedicada al chat: aquí SÍ se baja siempre al último mensaje.
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    if (orderId) markChatRead(orderId);
    return () => clearTimeout(timer);
  }, [messages.length, orderId]);

  if (loading) return <Loading label="Abriendo el chat…" />;
  if (!order) return <Loading label="Pedido no encontrado" />;

  const finished = ["delivered", "cancelled"].includes(order.status);
  const partnerName =
    partnerRole === "driver" ? order.driver_name || "Conductor" : order.client_name || "Cliente";
  const partnerPhoto = partnerRole === "driver" ? driver?.photo_url : null;

  const sendText = async (text = draft) => {
    if (!text.trim()) return;
    setError("");
    setFailed(null);
    try {
      await send(text);
      setDraft("");
    } catch {
      // Canvas 2g: el mensaje que no salió se queda EN LA CONVERSACIÓN, en
      // gris, con «Reintentar» debajo. Perderlo al fallar la red es lo que
      // hace que la gente escriba lo mismo tres veces.
      setFailed(text);
      setDraft("");
    }
  };

  const sendPhoto = () => {
    Alert.alert("Enviar foto", "¿De dónde sale la imagen?", [
      { text: "Cámara", onPress: () => attach(takePhoto) },
      { text: "Galería", onPress: () => attach(() => pickPhotos(1)) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const attach = async picker => {
    setError("");
    try {
      const uris = await picker();
      if (!uris[0]) return;
      await send(draft, { imageUri: uris[0] });
      setDraft("");
    } catch {
      setError("No se pudo enviar la foto.");
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      {/* Cabecera propia, como el canvas: atrás + avatar + nombre + estado */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        {partnerPhoto ? (
          <Image source={{ uri: partnerPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarInitial}>{partnerName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{partnerName}</Text>
          <Caption>{finished ? "Servicio terminado · historial" : "Servicio en curso"}</Caption>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Mensajes llenando la pantalla */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <Caption style={{ textAlign: "center", marginTop: spacing.xxl }}>
              Todavía no hay mensajes. Escribe el primero.
            </Caption>
          ) : (
            messages.map((m, i) => {
              const mine = m.sender_id === user?.id;
              const date = messageDate(m);
              // Separador de día (canvas 2g): «Hoy · 10:24» al abrir la
              // conversación y cada vez que cambia la fecha.
              const previousDate = messageDate(messages[i - 1]);
              const newDay =
                !!date && (!previousDate || previousDate.toDateString() !== date.toDateString());
              return (
                <View key={m.id} style={{ gap: spacing.sm }}>
                  {newDay ? (
                    <Caption style={styles.daySeparator}>
                      {dayLabel(date)} · {format(date, "HH:mm")}
                    </Caption>
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    {m.image_url ? (
                      <Image source={{ uri: m.image_url }} style={styles.image} />
                    ) : null}
                    {m.message && m.message !== "📷 Foto" ? (
                      <Text style={[styles.bubbleText, mine && { color: "#FFFFFF" }]}>
                        {m.message}
                      </Text>
                    ) : null}
                    {date ? (
                      <Text style={[styles.time, mine && { color: "#FFFFFFAA" }]}>
                        {format(date, "HH:mm")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {/* Mensaje que no salió: se queda a la vista con su reintento */}
          {failed ? (
            <View style={{ alignSelf: "flex-end", alignItems: "flex-end", gap: 3 }}>
              <View style={[styles.bubble, styles.bubbleFailed]}>
                <Text style={styles.bubbleText}>{failed}</Text>
              </View>
              <Pressable onPress={() => sendText(failed)}>
                <Caption style={{ color: colors.destructive }}>
                  No se ha enviado · <Text style={styles.retry}>Reintentar</Text>
                </Caption>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <Caption style={{ color: colors.destructive, textAlign: "center" }}>{error}</Caption>
          ) : null}
        </ScrollView>

        {/* Barra de escritura fija abajo (canvas 2g) */}
        {finished ? (
          <View style={styles.finishedBar}>
            <Caption>El servicio ha terminado: el chat queda como historial.</Caption>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <Pressable onPress={sendPhoto} hitSlop={8} style={styles.attach}>
              <Ionicons name="camera-outline" size={22} color={colors.mutedForeground} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe un mensaje…"
              placeholderTextColor={colors.subtle}
              style={styles.input}
              multiline
            />
            <Pressable
              onPress={() => sendText()}
              disabled={sending || !draft.trim()}
              style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
            >
              <Ionicons name="send" size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { marginRight: -4 },
  avatar: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 16, fontFamily: "Poppins_700Bold", color: colors.primary },
  name: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  messages: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubble: { maxWidth: "80%", borderRadius: 16, padding: spacing.md, gap: 4 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleFailed: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, opacity: 0.85 },
  bubbleText: { fontSize: 14, fontFamily: "DMSans_400Regular", color: colors.foreground, lineHeight: 19 },
  time: { fontSize: 10.5, fontFamily: "DMSans_400Regular", color: colors.subtle, alignSelf: "flex-end" },
  daySeparator: { textAlign: "center", marginTop: spacing.sm },
  retry: { fontFamily: "DMSans_700Bold", color: colors.destructive, textDecorationLine: "underline" },
  image: { width: 210, height: 158, borderRadius: radius.md, backgroundColor: colors.secondary },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attach: { padding: 10 },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: colors.secondary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14.5,
    fontFamily: "DMSans_400Regular",
    color: colors.foreground,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  finishedBar: {
    padding: spacing.md,
    alignItems: "center",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
