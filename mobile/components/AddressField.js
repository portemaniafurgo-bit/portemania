import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { currentAddress, suggestAddresses } from "../lib/addresses";
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
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState("");
  // Al elegir una sugerencia cambia `value`, lo que dispararía otra búsqueda y
  // volvería a abrir la lista justo después de cerrarla.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const query = (value || "").trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    let active = true;
    setSearching(true);
    // Pequeña espera para no lanzar una petición por cada tecla.
    const timer = setTimeout(async () => {
      const results = await suggestAddresses(query, { zone });
      if (!active) return;
      setSuggestions(results);
      setSearching(false);
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [value, zone]);

  const choose = (item) => {
    skipNextSearch.current = true;
    setSuggestions([]);
    setHint(item.served ? "" : "Esa dirección está fuera de nuestra zona de servicio.");
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
        value={value}
        onChangeText={text => onChange(text, null)}
        placeholder={placeholder || "Calle, número y ciudad"}
        error={error}
        autoCorrect={false}
      />

      <Pressable onPress={useMyLocation} disabled={locating} style={styles.locate}>
        {locating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.locateText}>📍 Usar mi ubicación actual</Text>
        )}
      </Pressable>

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
  locateText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
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
