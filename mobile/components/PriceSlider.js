import { useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

/**
 * «Arrastra el importe» (canvas 1e): slider de precio sin librerías nativas —
 * un PanResponder sobre la pista, con el importe grande encima del pulgar.
 * El rango va del suelo (60 % del calculado) a 1,5× el calculado; el valor
 * exacto también se puede teclear fuera (campo del padre).
 */
export default function PriceSlider({ min, max, value, onChange }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackX = useRef(0);
  const trackRef = useRef(null);

  const clamp = v => Math.min(max, Math.max(min, Math.round(v)));
  const ratio = max > min ? (clamp(value ?? min) - min) / (max - min) : 0;

  const setFromPageX = pageX => {
    const w = trackWidthRef.current;
    if (!w) return;
    const rel = Math.min(1, Math.max(0, (pageX - trackX.current) / w));
    onChange(clamp(min + rel * (max - min)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => setFromPageX(e.nativeEvent.pageX),
      onPanResponderMove: e => setFromPageX(e.nativeEvent.pageX),
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <View
        ref={trackRef}
        style={styles.touchArea}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          setTrackWidth(w);
          trackWidthRef.current = w;
          // pageX de la pista, para convertir el dedo en valor.
          trackRef.current?.measureInWindow(x => {
            trackX.current = x;
          });
        }}
        {...pan.panHandlers}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        {trackWidth > 0 && (
          <View style={[styles.thumb, { left: ratio * (trackWidth - 28) }]}>
            <Text style={styles.thumbText}>{clamp(value ?? min)}€</Text>
          </View>
        )}
      </View>
      <View style={styles.limits}>
        <Text style={styles.limit}>{min} €</Text>
        <Text style={styles.limit}>{max} €</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  touchArea: { height: 52, justifyContent: "center" },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.border },
  fill: { height: 6, borderRadius: radius.full, backgroundColor: colors.primary },
  thumb: {
    position: "absolute",
    top: 4,
    minWidth: 28,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  thumbText: { color: "#FFFFFF", fontSize: 12, fontFamily: "DMSans_700Bold" },
  limits: { flexDirection: "row", justifyContent: "space-between" },
  limit: { fontSize: 11, fontFamily: "DMSans_400Regular", color: colors.subtle },
});
