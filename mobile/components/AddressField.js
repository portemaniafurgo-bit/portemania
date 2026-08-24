import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { currentAddress, suggestAddresses } from "../lib/addresses";
import MapPicker from "./MapPicker";
import { Caption, Field } from "./ui";
import { colors, radius, spacing } from "../theme";

/**
 * Dirección con autocompletado y "usar mi ubicación".
 *
 * La web pide teclear la dirección con el código postal a mano y la valida con
 * una expresión regular; escribir "02001" mal es el fallo más común del
 * formulario. Aquí el CP sale del geocodificador, y las direcciones fuera de
 * zona se muestran marcadas en vez de desaparecer, para que el cliente entienda
 * por qué no le sirven.
 *
 * El texto libre se conserva: si el cliente prefiere escribirlo entero, puede,
 * y el servidor lo valida igual.
 */
export default function AddressField({ label, value, onChange, zone = "albacete", error, placeholder }) {
  /**
   * El texto se escribe en un estado LOCAL y sube al formulario con retardo.
   *
   * Antes cada tecla iba directa al estado del asistente, que recalcula el
   * precio y guarda el borrador en disco: en un móvil normal eso se traga
   * pulsaciones y el campo parecía no dejar escribir (bug real, 24/08/2026).
   */
  const [text, setText] = useState(value || "");
  const typing = useRef(false);

  // Si el valor cambia desde fuera (elegir sugerencia, «mi ubicación», mapa o
  // un borrador recuperado) hay que reflejarlo; mientras se teclea, no.
  useEffect(() => {
    if (!typing.current) setText(value || "");
  }, [value]);

  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState("");
  const [showMap, setShowMap] = useState(false);
  // Última coordenada elegida: el mapa abre ahí en vez de en el centro de la ciudad.
  const lastPicked = useRef(null);
  // Al elegir una sugerencia cambia `value`, lo que dispararía otra búsqueda y
  // volvería a abrir la lista justo después de cerrarla.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const query = (text || "").trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    let active = true;
    setSearching(true);
    // Una sola espera para dos cosas: buscar sugerencias y subir el texto al
    // formulario. Así el asistente no recalcula ni guarda en cada tecla.
    const timer = setTimeout(async () => {
      if (query !== (value || "").trim()) onChange(query, null);
      const results = await suggestAddresses(query, { zone });
      if (!active) return;
      setSuggestions(results);
      setSearching(false);
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [text, zone]);

  const choose = (item) => {
    skipNextSearch.current = true;
    typing.current = false;
    setText(item.label);
    setSuggestions([]);
    setHint(item.served ? "" : "Esa dirección está fuera de nuestra zona de servicio.");
    lastPicked.current = item;
    onChange(item.label, item);
  };

  const useMyLocation = async () => {
    setLocating(true);
    setHint("");
    try {
      const { granted, address } = await currentAddress();
      if (!granted) {
        setHint("Sin permiso de ubicación no podemos rellenarla por ti.");
        return;
      }
      if (!address) {
        setHint("No hemos podido identificar tu dirección. Escríbela a mano.");
        return;
      }
      choose(address);
    } catch {
      setHint("No se pudo obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Field
        label={label}
        value={text}
        onChangeText={next => {
          typing.current = true;
          setText(next);
        }}
        // Al salir del campo, lo escrito sube ya: si el cliente pulsa
        // «Siguiente» sin esperar, no se pierde lo último que tecleó.
        onBlur={() => {
          typing.current = false;
          const clean = (text || "").trim();
          if (clean !== (value || "").trim()) onChange(clean, null);
        }}
        placeholder={placeholder || "Calle, número y ciudad"}
        error={error}
        autoCorrect={false}
      />

      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <Pressable onPress={useMyLocation} disabled={locating} style={styles.locate}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={styles.locateRow}><Ionicons name="locate" size={16} color={colors.primary} /><Text style={styles.locateText}>Mi ubicación</Text></View>
          )}
        </Pressable>
        <Pressable onPress={() => setShowMap(true)} style={styles.locate}>
          <View style={styles.locateRow}><Ionicons name="map-outline" size={16} color={colors.primary} /><Text style={styles.locateText}>Ajustar en el mapa</Text></View>
        </Pressable>
      </View>

      <MapPicker
        visible={showMap}
        initial={lastPicked.current}
        zone={zone}
        onConfirm={item => {
          setShowMap(false);
          choose(item);
        }}
        onClose={() => setShowMap(false)}
      />

      {searching ? <Caption>Buscando direcciones…</Caption> : null}
      {hint ? <Caption style={{ color: colors.warning }}>{hint}</Caption> : null}

      {suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map(item => (
            <Pressable key={item.id} onPress={() => choose(item)} style={styles.item}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              {!item.served && <Text style={styles.itemOut}>Fuera de zona</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  locate: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  locateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  locateText: { color: colors.primary, fontSize: 14, fontFamily: "DMSans_500Medium" },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  item: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLabel: { fontSize: 14, color: colors.foreground },
  itemOut: { fontSize: 12, color: colors.warning, marginTop: 2 },
});
