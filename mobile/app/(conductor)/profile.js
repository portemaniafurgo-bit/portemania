import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  DOC_FIELDS,
  expiryStatus,
  fetchMyDriverProfile,
  isDriverProfileIncomplete,
  uploadPrivateDriverDocFromUri,
} from "../../lib/driverProfile";
import { pickPhotos, takePhoto, uploadPhoto } from "../../lib/photos";
import { Body, Button, Caption, Card, ErrorText, Heading, Loading, Screen, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Perfil del conductor con su documentación (T4.8).
 *
 * Cada documento se puede (re)subir con la cámara o la galería, comprimido en
 * el móvil. Los sensibles van al bucket PRIVADO driver-docs como referencia
 * "driver-docs://"; el selfie y las fotos de la furgoneta siguen públicos
 * porque el cliente los ve en su pedido — mismas reglas que la web.
 */
/** Campo pequeño de fecha de caducidad: se guarda al perder el foco. */
function ExpiryField({ initial, onSave }) {
  // "2027-03-01" → "01/03/2027" para editar en el formato que usa la gente.
  const toDisplay = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };
  const [text, setText] = useState(toDisplay(initial));

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => text.trim() && text !== toDisplay(initial) && onSave(text)}
      placeholder="Caducidad: DD/MM/AAAA"
      placeholderTextColor={colors.mutedForeground}
      style={styles.expiryInput}
    />
  );
}

export default function PerfilConductor() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(undefined);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => fetchMyDriverProfile(user).then(setProfile), [user]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadDoc = async (doc, source) => {
    setError("");
    const uris = source === "camera" ? await takePhoto() : await pickPhotos(1);
    if (!uris[0]) return;

    setUploading(doc.field);
    try {
      const url = doc.private
        ? await uploadPrivateDriverDocFromUri(uris[0])
        : await uploadPhoto(uris[0]);
      const { error: err } = await supabase
        .from("driver_profiles")
        .update({ [doc.field]: url })
        .eq("id", profile.id);
      if (err) throw err;
      setProfile(prev => ({ ...prev, [doc.field]: url }));
    } catch (err) {
      setError(`No se pudo subir «${doc.label}»: ` + (err.message || "error de conexión"));
    } finally {
      setUploading(null);
    }
  };

  /** Fecha de caducidad de un documento (DD/MM/AAAA). El job diario del
   *  servidor bloquea el reparto cuando algo vence. */
  const saveExpiry = async (doc, text) => {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
    if (!match) {
      setError(`Fecha de «${doc.label}» no válida: usa DD/MM/AAAA.`);
      return;
    }
    setError("");
    const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const { error: err } = await supabase
      .from("driver_profiles")
      .update({ [doc.expiresField]: iso })
      .eq("id", profile.id);
    if (err) {
      setError("No se pudo guardar la fecha: " + err.message);
      return;
    }
    setProfile(prev => ({ ...prev, [doc.expiresField]: iso }));
  };

  const chooseSource = doc => {
    Alert.alert(doc.label, "¿De dónde sale la imagen?", [
      { text: "Cámara", onPress: () => uploadDoc(doc, "camera") },
      { text: "Galería", onPress: () => uploadDoc(doc, "gallery") },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  if (profile === undefined) return <Loading label="Cargando tu perfil…" />;

  return (
    <Screen>
      <Heading>Mi perfil</Heading>

      <Card>
        <Title>{profile?.full_name || user?.user_metadata?.full_name || "Sin nombre"}</Title>
        <Caption>{user?.email}</Caption>
        {profile ? (
          <>
            <Caption>
              Furgoneta: {profile.vehicle_type === "large" ? "grande" : "pequeña"}
              {profile.vehicle_brand ? ` · ${profile.vehicle_brand}` : ""}
              {profile.vehicle_plate ? ` · ${profile.vehicle_plate}` : ""}
            </Caption>
            <Caption>Estado: {profile.status === "verified" ? "verificado" : profile.status}</Caption>
          </>
        ) : (
          <Caption>Aún no tienes perfil de conductor asociado a este email.</Caption>
        )}
      </Card>

      {profile && isDriverProfileIncomplete(profile) && (
        <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
          <Body>Documentación incompleta</Body>
          <Caption>Sin todos los documentos no puedes recibir servicios.</Caption>
        </Card>
      )}

      {profile && (
        <Card>
          <Title>Mi documentación</Title>
          <Caption>
            Toca un documento para subirlo o sustituirlo (por ejemplo, al renovar el seguro). Los
            documentos personales se guardan en privado.
          </Caption>
          <ErrorText>{error}</ErrorText>
          {DOC_FIELDS.map(doc => {
            const present = !!profile[doc.field];
            const expiry = expiryStatus(profile, doc);
            const dotColor =
              expiry === "expired" ? colors.destructive
              : expiry === "soon" ? colors.warning
              : present ? colors.success
              : colors.destructive;
            return (
              <View key={doc.field} style={styles.docRow}>
                <View style={[styles.docDot, { backgroundColor: dotColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  <Caption>
                    {!present
                      ? "Falta"
                      : expiry === "expired"
                        ? "CADUCADO — súbelo renovado"
                        : expiry === "soon"
                          ? `Caduca pronto (${profile[doc.expiresField]})`
                          : expiry === "ok"
                            ? `Vence ${profile[doc.expiresField]}`
                            : "Subido"}
                  </Caption>
                  {present && doc.expiresField ? (
                    <ExpiryField
                      initial={profile[doc.expiresField]}
                      onSave={text => saveExpiry(doc, text)}
                    />
                  ) : null}
                </View>
                <Button
                  title={present ? "Sustituir" : "Subir"}
                  variant="plain"
                  loading={uploading === doc.field}
                  onPress={() => chooseSource(doc)}
                />
              </View>
            );
          })}
        </Card>
      )}

      <Button title="Cerrar sesión" variant="plain" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docDot: { width: 10, height: 10, borderRadius: radius.full },
  docLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
  expiryInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
});
