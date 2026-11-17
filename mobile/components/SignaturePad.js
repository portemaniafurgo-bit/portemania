import { useRef, useState } from "react";
import { PanResponder, Platform, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { Button, Caption } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Lienzo de firma del receptor. El dedo dibuja trazos SVG y `capture()`
 * devuelve un PNG (base64) del lienzo, que sube deliveryProof al bucket
 * privado — una firma manuscrita es un dato personal y no puede vivir en una
 * URL pública, igual que decidió la web.
 *
 * `onSigningChange(activo)` (solo iPhone): avisa al empezar y al acabar cada
 * trazo para que la pantalla que lo contiene bloquee su desplazamiento mientras
 * se firma; en iOS el desplazamiento nativo puede quedarse el gesto a mitad de
 * trazo aunque el lienzo no lo ceda. En Android no se llama nunca.
 */
export default function SignaturePad({ onCapture, capturing, onSigningChange }) {
  const shotRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const currentPath = useRef("");
  // El PanResponder se crea una sola vez: la función del padre se lee de aquí
  // para usar siempre la última.
  const signingChangeRef = useRef(onSigningChange);
  signingChangeRef.current = onSigningChange;
  const notifySigning = active => {
    if (Platform.OS === "ios") signingChangeRef.current?.(active);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // iPhone: la pantalla del servicio rueda, y sin esto el desplazamiento
      // se queda el gesto a mitad de firma. En Android, lo de siempre.
      onPanResponderTerminationRequest: () => Platform.OS !== "ios",
      onPanResponderGrant: e => {
        notifySigning(true);
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setPaths(prev => [...prev, currentPath.current]);
      },
      onPanResponderMove: e => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setPaths(prev => [...prev.slice(0, -1), currentPath.current]);
      },
      onPanResponderRelease: () => notifySigning(false),
      onPanResponderTerminate: () => notifySigning(false),
    }),
  ).current;

  const capture = async () => {
    // result: "base64" evita pasar por un fichero temporal.
    const base64 = await shotRef.current?.capture();
    if (base64) onCapture(base64);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <ViewShot
        ref={shotRef}
        options={{ format: "png", quality: 1, result: "base64" }}
        style={styles.canvasWrap}
      >
        <View style={styles.canvas} {...pan.panHandlers}>
          {/* En iPhone el dibujo no recibe toques: así las coordenadas son
              siempre las del recuadro, no las del trazo tocado. */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents={Platform.OS === "ios" ? "none" : "auto"}>
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke="#111111" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
      </ViewShot>
      <Caption>El receptor firma con el dedo dentro del recuadro.</Caption>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Borrar" variant="plain" onPress={() => setPaths([])} style={{ flex: 1 }} />
        <Button
          title="Confirmar firma"
          onPress={capture}
          loading={capturing}
          disabled={paths.length === 0}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasWrap: { borderRadius: radius.md, overflow: "hidden" },
  canvas: {
    height: 220,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
