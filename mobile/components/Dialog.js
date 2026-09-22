import { createContext, useCallback, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Diálogo de confirmación PROPIO, en lugar de `Alert.alert` (petición de
 * Renato, 01/09/2026): el alert nativo de Android no se cierra tocando fuera
 * ni con el botón atrás, así que quien abría "cancelar servicio" y se
 * arrepentía se quedaba atrapado. Este se cierra por el fondo, por atrás o
 * por cualquier acción, y va con la estética de las hojas del canvas.
 *
 * Uso:
 *   const dialog = useDialog();
 *   dialog.show({
 *     title, message,
 *     actions: [{ text, onPress, style: "cancel" | "destructive" | undefined }],
 *     onDismiss,   // opcional: cerrado por el fondo o por el botón atrás
 *   });
 * Si no se pasa ninguna acción de estilo "cancel", se añade «Volver».
 *
 * `onDismiss` existe porque cerrar por el fondo NO llama a ninguna acción: quien
 * espera una respuesta sí/no (la divulgación de ubicación de
 * `lib/locationDisclosure.js`) se quedaría esperando para siempre.
 */
const DialogContext = createContext({ show: () => {} });

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const show = useCallback(options => setDialog(options), []);
  const close = useCallback(() => setDialog(null), []);
  // Cierre SIN pulsar ninguna acción: fondo, botón atrás o el «Volver» que se
  // añade solo. Es el único caso en el que se avisa con `onDismiss`.
  const dismiss = useCallback(() => {
    const current = dialog;
    close();
    current?.onDismiss?.();
  }, [dialog, close]);

  const actions = dialog?.actions?.length ? dialog.actions : [{ text: "Vale", style: "cancel" }];
  const hasCancel = actions.some(a => a.style === "cancel");
  // Las acciones "normales" primero y la de cancelar la última, como en las
  // hojas del canvas: lo principal arriba, la salida abajo.
  const ordered = [...actions.filter(a => a.style !== "cancel"), ...actions.filter(a => a.style === "cancel")];

  return (
    <DialogContext.Provider value={{ show, close }}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <Pressable style={styles.backdrop} onPress={dismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {dialog?.title ? <Text style={styles.title}>{dialog.title}</Text> : null}
          {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {ordered.map((action, i) => (
              <Button
                key={`${action.text}-${i}`}
                title={action.text}
                variant={action.style === "cancel" ? "plain" : "primary"}
                style={action.style === "destructive" ? styles.destructive : null}
                onPress={() => {
                  close();
                  action.onPress?.();
                }}
              />
            ))}
            {!hasCancel ? <Button title="Volver" variant="plain" onPress={dismiss} /> : null}
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);

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
  title: { fontSize: 17, lineHeight: 22, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  message: { fontSize: 13.5, lineHeight: 20, fontFamily: "DMSans_400Regular", color: colors.mutedForeground },
  destructive: { backgroundColor: colors.destructive },
});
