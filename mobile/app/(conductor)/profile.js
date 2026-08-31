import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "../onboarding";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import {
  DOC_FIELDS,
  expiryStatus,
  fetchMyDriverProfile,
  isDriverProfileIncomplete,
  uploadPrivateDriverDocFromUri,
} from "../../lib/driverProfile";
import { rating1 } from "../../lib/money";
import { SERVICE_LIST } from "../../lib/services";
import { pickPhotos, takePhoto, uploadPhoto } from "../../lib/photos";
import DeleteAccount from "../../components/DeleteAccount";
import { SettingsGroup, SettingsRow } from "../../components/SettingsRow";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Loading, Screen, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Perfil del conductor (canvas 2j): identidad con «Verificado», valoración y
 * furgoneta; aviso de caducidad ARRIBA porque es lo que le corta el trabajo; y
 * la documentación con su contador «X de 10 al día».
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
      placeholderTextColor={colors.subtle}
      style={styles.expiryInput}
    />
  );
}

export default function PerfilConductor() {
  const { user, signOut, setMode } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(undefined);
  const [jobCount, setJobCount] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState("");
  // Datos fiscales del autónomo (emisor de la factura).
  const [fiscal, setFiscal] = useState({ tax_id: "", fiscal_name: "", fiscal_address: "" });
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [fiscalSaved, setFiscalSaved] = useState(false);

  const load = useCallback(() => fetchMyDriverProfile(user).then(setProfile), [user]);

  /** Volver a ver la introducción: baja el flag y abre las tres pantallas. */
  const replayOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => {});
    router.push("/onboarding");
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    setFiscal({
      tax_id: profile.tax_id || "",
      fiscal_name: profile.fiscal_name || profile.full_name || "",
      fiscal_address: profile.fiscal_address || "",
    });
  }, [profile?.id]);

  const saveFiscal = async () => {
    setSavingFiscal(true);
    setError("");
    try {
      const payload = {
        // Sin espacios y en mayúsculas: es como lo espera Hacienda.
        tax_id: fiscal.tax_id.replace(/\s+/g, "").toUpperCase() || null,
        fiscal_name: fiscal.fiscal_name.trim() || null,
        fiscal_address: fiscal.fiscal_address.trim() || null,
      };
      const { error: err } = await supabase
        .from("driver_profiles")
        .update(payload)
        .eq("id", profile.id);
      if (err) throw err;
      setProfile(prev => ({ ...prev, ...payload }));
      setFiscalSaved(true);
    } catch (err) {
      setError("No se pudieron guardar los datos fiscales: " + (err.message || "error de conexión"));
    } finally {
      setSavingFiscal(false);
    }
  };

  /**
   * Qué tipos de servicio quiere recibir (petición de Renato, 31/08). En BD,
   * null = todos; aquí se traduce a "todos marcados". Se guarda al toque.
   */
  const activeServices = Array.isArray(profile?.service_keys) && profile.service_keys.length
    ? profile.service_keys
    : SERVICE_LIST.map(s => s.key);

  const toggleService = async key => {
    const on = activeServices.includes(key);
    // El último no se apaga: sin ningún servicio marcado no llegaría NADA y
    // parecería una avería, no un filtro.
    if (on && activeServices.length === 1) return;
    const next = on ? activeServices.filter(k => k !== key) : [...activeServices, key];
    // Todos marcados vuelve a null: es el estado "sin filtro" de siempre.
    const stored = next.length === SERVICE_LIST.length ? null : next;
    const { error: err } = await supabase
      .from("driver_profiles")
      .update({ service_keys: stored })
      .eq("id", profile.id);
    if (err) {
      setError("No se pudo guardar el filtro de servicios: " + err.message);
      return;
    }
    setProfile(prev => ({ ...prev, service_keys: stored }));
  };

  // «4,9 · 212 servicios»: el número sale de sus entregas, no de una columna
  // inventada — count exacto sin traerse las filas.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("transport_requests")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", user.id)
      .eq("status", "delivered")
      .then(({ count }) => setJobCount(count ?? 0));
  }, [user?.id]);

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

  // «9 de 10 al día»: un documento cuenta si está subido y no vencido.
  const upToDate = profile
    ? DOC_FIELDS.filter(d => profile[d.field] && expiryStatus(profile, d) !== "expired").length
    : 0;
  const expiringSoon = profile
    ? DOC_FIELDS.filter(d => expiryStatus(profile, d) === "soon")
    : [];
  const expired = profile ? DOC_FIELDS.filter(d => expiryStatus(profile, d) === "expired") : [];

  return (
    <Screen>
      <Heading>Perfil</Heading>

      <View style={styles.identity}>
        {profile?.photo_url ? (
          <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarInitial}>
              {(profile?.full_name || user?.email || "C").slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Title>{profile?.full_name || user?.user_metadata?.full_name || "Sin nombre"}</Title>
            {profile?.status === "verified" ? (
              <View style={styles.verifiedChip}>
                <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                <Text style={styles.verifiedText}>Verificado</Text>
              </View>
            ) : profile ? (
              <View style={[styles.verifiedChip, { backgroundColor: colors.warningBg }]}>
                <Text style={[styles.verifiedText, { color: colors.warning }]}>
                  {profile.status === "pending" ? "Pendiente" : profile.status}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {profile?.rating ? (
              <>
                <Ionicons name="star" size={12} color={colors.accent} />
                <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>
                  {rating1(profile.rating)}
                </Caption>
                <Caption>
                  ({profile.rating_count} valoración{profile.rating_count === 1 ? "" : "es"}) ·
                </Caption>
              </>
            ) : (
              <Caption>Sin valoraciones todavía · </Caption>
            )}
            <Caption>
              {jobCount === null ? "" : `${jobCount} servicio${jobCount === 1 ? "" : "s"}`}
            </Caption>
          </View>
          {profile ? (
            <Caption>
              {profile.vehicle_brand || (profile.vehicle_type === "large" ? "Furgoneta grande" : "Furgoneta pequeña")}
              {profile.vehicle_plate ? ` · ${profile.vehicle_plate}` : ""}
            </Caption>
          ) : (
            <Caption>Aún no tienes perfil de conductor asociado a este email.</Caption>
          )}
        </View>
      </View>

      {/* Lo que le corta el trabajo, arriba del todo (canvas 2j) */}
      {expired.length > 0 && (
        <Card style={{ backgroundColor: "#FEF2F2", borderColor: colors.destructive }}>
          <Body style={{ fontFamily: "DMSans_700Bold", color: colors.destructive }}>
            {expired.length === 1
              ? `${expired[0].label} está caducado.`
              : `${expired.length} documentos caducados.`}
          </Body>
          <Caption>No recibirás ofertas hasta subirlo renovado con su nueva fecha.</Caption>
        </Card>
      )}

      {expired.length === 0 && expiringSoon.length > 0 && (
        <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
          <Body style={{ fontFamily: "DMSans_700Bold" }}>
            {expiringSoon.length === 1
              ? "1 documento caduca pronto."
              : `${expiringSoon.length} documentos caducan pronto.`}
          </Body>
          <Caption>Al vencer dejas de recibir ofertas.</Caption>
        </Card>
      )}

      {profile && isDriverProfileIncomplete(profile) && (
        <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
          <Body style={{ fontFamily: "DMSans_700Bold" }}>Documentación incompleta</Body>
          <Caption>Sin todos los documentos no puedes recibir servicios.</Caption>
        </Card>
      )}

      {/* Datos fiscales: sin ellos, el cliente solo recibe un recibo simple y
          la factura del servicio no existe. Es dinero y es Hacienda. */}
      {profile && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.overline}>Datos de facturación</Text>
            {!profile.tax_id ? (
              <Caption style={{ color: colors.warning }}>Falta el NIF</Caption>
            ) : null}
          </View>
          <Card>
            <Caption>
              Eres tú quien factura al cliente: el servicio lo prestas tú como autónomo y ClicyVoy
              solo pone en contacto y gestiona el cobro.
            </Caption>
            <Field
              label="NIF / NIE"
              value={fiscal.tax_id}
              onChangeText={v => setFiscal(f => ({ ...f, tax_id: v }))}
              placeholder="02123456X"
              autoCapitalize="characters"
            />
            <Field
              label="Nombre fiscal"
              value={fiscal.fiscal_name}
              onChangeText={v => setFiscal(f => ({ ...f, fiscal_name: v }))}
              placeholder="Como aparece en tu alta de autónomo"
            />
            <Field
              label="Dirección fiscal"
              value={fiscal.fiscal_address}
              onChangeText={v => setFiscal(f => ({ ...f, fiscal_address: v }))}
              placeholder="Calle, número, CP y población"
            />
            <Button
              title={fiscalSaved ? "Datos guardados" : "Guardar datos fiscales"}
              loading={savingFiscal}
              onPress={saveFiscal}
            />
          </Card>

          {/* Filtro de servicios: qué tipos de trabajo quiere que le lleguen.
              Afecta a la lista de ofertas Y a los avisos push. */}
          <View style={styles.sectionHeader}>
            <Text style={styles.overline}>Servicios que recibes</Text>
            <Caption>
              {activeServices.length === SERVICE_LIST.length
                ? "Todos"
                : `${activeServices.length} de ${SERVICE_LIST.length}`}
            </Caption>
          </View>
          <Card>
            <Caption>
              Toca para apagar los que no te interesen: ni te aparecerán ni te sonarán. Al menos
              uno tiene que quedar encendido.
            </Caption>
            <View style={styles.serviceChips}>
              {SERVICE_LIST.map(s => {
                const on = activeServices.includes(s.key);
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => toggleService(s.key)}
                    style={[styles.serviceChip, on && styles.serviceChipOn]}
                  >
                    <Ionicons
                      name={on ? "checkmark-circle" : "ellipse-outline"}
                      size={15}
                      color={on ? colors.primary : colors.subtle}
                    />
                    <Text style={[styles.serviceChipText, on && { color: colors.primary }]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View style={styles.sectionHeader}>
            <Text style={styles.overline}>Documentación</Text>
            <Caption>
              {upToDate} de {DOC_FIELDS.length} al día
            </Caption>
          </View>
          <ErrorText>{error}</ErrorText>

          <Card style={{ gap: 0 }}>
            {DOC_FIELDS.map((doc, i) => {
              const present = !!profile[doc.field];
              const expiry = expiryStatus(profile, doc);
              const dotColor =
                expiry === "expired" ? colors.destructive
                : expiry === "soon" ? colors.warning
                : present ? colors.success
                : colors.destructive;
              return (
                <View key={doc.field}>
                  {i > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.docRow}>
                    <View style={[styles.docDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.docLabel}>{doc.label}</Text>
                      <Caption>
                        {!present
                          ? "Falta"
                          : expiry === "expired"
                            ? "Caducado — súbelo renovado"
                            : expiry === "soon"
                              ? `Caduca pronto · ${profile[doc.expiresField]}`
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
                    <Pressable
                      onPress={() => chooseSource(doc)}
                      disabled={uploading === doc.field}
                      style={styles.docAction}
                    >
                      <Ionicons
                        name={present ? "refresh-outline" : "cloud-upload-outline"}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.docActionText}>
                        {uploading === doc.field ? "Subiendo…" : present ? "Sustituir" : "Subir"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <SettingsGroup>
        {/* Una app, dos caras (como Uber): el conductor puede pedir un porte
            como cliente sin cerrar sesión. El rol no cambia, solo la cara. */}
        <SettingsRow
          icon="swap-horizontal-outline"
          label="Usar como cliente"
          hint="Pide un porte como cualquier cliente; vuelves desde tu perfil"
          onPress={async () => {
            await setMode("client");
            router.replace("/(cliente)/pedir");
          }}
        />
        <SettingsRow
          icon="receipt-outline"
          label="Mis facturas"
          hint="Las que emites tú, por meses"
          onPress={() => router.push("/(conductor)/facturas")}
        />
        <SettingsRow
          icon="help-buoy-outline"
          label="Ayuda y ajustes del móvil"
          hint="Ubicación y batería: sin esto tu posición se congela"
          onPress={() => router.push("/(conductor)/ayuda")}
        />
        <SettingsRow
          icon="sparkles-outline"
          label="Ver la introducción"
          hint="Las tres pantallas del primer arranque"
          onPress={replayOnboarding}
        />
        <SettingsRow icon="log-out-outline" label="Cerrar sesión" onPress={signOut} last />
      </SettingsGroup>

      <DeleteAccount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 24, fontFamily: "Poppins_700Bold", color: colors.primary },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.successBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, fontFamily: "DMSans_700Bold", color: colors.success },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overline: {
    fontSize: 11.5,
    fontFamily: "DMSans_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  divider: { height: 1, backgroundColor: colors.border },
  serviceChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  serviceChipText: { fontSize: 13, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  docDot: { width: 8, height: 8, borderRadius: radius.full },
  docLabel: { fontSize: 14, fontFamily: "DMSans_500Medium", color: colors.foreground },
  docAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  docActionText: { fontSize: 13, fontFamily: "DMSans_700Bold", color: colors.primary },
  expiryInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: "DMSans_400Regular",
    color: colors.foreground,
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    minWidth: 150,
  },
});
