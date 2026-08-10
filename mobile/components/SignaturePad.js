import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { Button, Caption } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Lienzo de firma del receptor. El dedo dibuja trazos SVG y `capture()`
 * devuelve un PNG (base64) del lienzo, que sube deliveryProof al bucket
 * privado — una firma manuscrita es un dato personal y no puede vivir en una
 * URL pública, igual que decidió la web.
 */
export default function SignaturePad({ onCapture, capturing }) {
  const shotRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const currentPath = useRef("");

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setPaths(prev => [...prev, currentPath.current]);
      },
      onPanResponderMove: e => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setPaths(prev => [...prev.slice(0, -1), currentPath.current]);
      },
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
          <Svg style={StyleSheet.absoluteFill}>
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
