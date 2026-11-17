import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Title } from "./ui";
import { useSheetBottomPadding } from "../lib/layout";
import { colors, radius, spacing } from "../theme";

/**
 * Elegir día y hora en iPhone.
 *
 * En Android se usan los diálogos nativos encadenados (DateTimePickerAndroid:
 * calendario y después reloj). En iOS esa API no existe —solo avisa por
 * consola y no abre nada—, así que «Elegir día y hora» no hacía nada. Aquí va
 * el selector propio de iOS (calendario con la hora debajo, en español y en
 * 24 h) dentro de una hoja con «Confirmar» y «Cancelar». Es el mismo paquete
 * que ya lleva la app: no hay nada nativo nuevo.
 *
 * En Android no se pinta nada.
 */
/**
 * La más tardía entre la fecha elegida y la mínima: nunca se devuelve una hora
 * pasada (p. ej. la hoja se abrió hace un rato y «ahora» ya es más tarde).
 * Si hay que subirla a la mínima, se redondea al minuto SIGUIENTE: quien la
 * recibe quita los segundos y, sin esto, quedaría unos segundos en el pasado.
 */
function notBefore(date, minimumDate) {
  const base = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const wholeMinute = new Date(base.getTime());
  wholeMinute.setSeconds(0, 0);
  if (!minimumDate || wholeMinute.getTime() >= minimumDate.getTime()) return base;
  const floor = new Date(minimumDate.getTime());
  if (floor.getSeconds() || floor.getMilliseconds()) {
    floor.setSeconds(0, 0);
    floor.setMinutes(floor.getMinutes() + 1);
  }
  return floor;
}

export default function DateTimeSheet({ visible, value, minimumDate, title, onConfirm, onCancel }) {
  const [draft, setDraft] = useState(() => notBefore(value, minimumDate));
  const sheetPad = useSheetBottomPadding(spacing.xl);

  // Cada vez que se abre, parte del valor actual (no del último borrador).
  useEffect(() => {
    if (visible) setDraft(notBefore(value, minimumDate));
    // `value` cambia de identidad en cada render del padre: solo al abrir.
  }, [visible]);

  if (Platform.OS !== "ios") return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={[styles.sheet, sheetPad]}>
        <View style={styles.handle} />
        <Title>{title}</Title>
        <DateTimePicker
          value={draft}
          mode="datetime"
          display="inline"
          locale="es-ES"
          minimumDate={minimumDate}
          accentColor={colors.primary}
          themeVariant="light"
          onValueChange={(_event, date) => {
            if (date) setDraft(date);
          }}
        />
        <Button
          title="Confirmar"
          // `minimumDate` del padre es «ahora» en el momento de pintar; se
          // vuelve a comparar con el reloj al confirmar.
          onPress={() => {
            const floor = minimumDate ? new Date(Math.max(minimumDate.getTime(), Date.now())) : null;
            onConfirm(notBefore(draft, floor));
          }}
        />
        <Button title="Cancelar" variant="plain" onPress={onCancel} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#00000066" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
});
