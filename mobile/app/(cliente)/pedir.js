import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { parseScheduledAt, useRequestForm } from "../../lib/useRequestForm";
import { SERVICE_KEYS, SERVICES } from "../../lib/services";
import { servicePriceFrom } from "../../lib/tariffs";
import { pickPhotos, takePhoto } from "../../lib/photos";
import { euro } from "../../lib/money";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Title } from "../../components/ui";
import { Counter, Option, Steps, Toggle } from "../../components/wizard";
import AddressField from "../../components/AddressField";
import AddressMapHero from "../../components/AddressMapHero";
import PriceSlider from "../../components/PriceSlider";
import ServiceIcon from "../../components/ServiceIcon";
import { colors, radius, spacing } from "../../theme";

/**
 * Asistente de pedido, con los CINCO pasos del canvas (1b–1f):
 *   1 servicio · 2 direcciones · 3 la carga · 4 tu precio · 5 revisa y publica
 *
 * El precio tiene paso propio a propósito (canvas 1e): el calculado manda y
 * ofertar es opcional, pero es una decisión que merece pantalla, no una tarjeta
 * perdida al final del resumen.
 *
 * Las validaciones y el cálculo viven en `lib/useRequestForm.js`, compartidos
 * con la web. Esta pantalla solo presenta. El precio que se ve es informativo:
 * el que se cobra lo fija el servidor al crear el pedido.
 */
const TOTAL_STEPS = 5;
const MAX_DESCRIPTION = 300;
const MAX_PHOTOS = 6;

export default function Pedir() {
  const router = useRouter();
  const { user } = useAuth();
  const wizard = useRequestForm({ user });
  const {
    form,
    update,
    service,
    setService,
    setZone,
    tariffs,
    quote,
    photos,
    addPhotos,
    removePhoto,
    uploading,
    addressErrors,
    acceptPortal,
    setAcceptPortal,
    acceptTerms,
    setAcceptTerms,
    validateStep,
    findRecentDuplicate,
    submit,
    clearDraft,
    weightOptions,
    destinationZoneKey,
  } = wizard;

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  // El cliente eligió "Programarlo" (aunque aún no haya escrito el día): un
  // borrador recuperado con fecha también lo activa.
  const [wantSchedule, setWantSchedule] = useState(false);
  const scheduling = wantSchedule || !!form.scheduled_date;

  const floor = Math.ceil(quote.total * 0.6);
  const offer = form.proposed_price ? Number(form.proposed_price) : null;

  const next = () => {
    // El paso 3 reúne carga y detalles del servicio (peso, objetos, horas,
    // destinatario): hay que pasar las dos validaciones antes de seguir.
    const checks = step === 2 ? [validateStep(2), validateStep(3)] : [validateStep(step)];
    const failed = checks.find(c => !c.ok);
    if (failed) {
      setError(failed.reason);
      return;
    }
    setError("");
    setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const back = () => {
    setError("");
    setStep(s => Math.max(0, s - 1));
  };

  /** «Mi ubicación» (canvas 1c): rellena la recogida con dónde estás ahora. */
  const useMyLocation = async () => {
    setLocating(true);
    setError("");
    try {
      let { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted) granted = (await Location.requestForegroundPermissionsAsync()).granted;
      if (!granted) {
        setError("Sin permiso de ubicación no puedo rellenar la dirección de recogida.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (!place) {
        setError("No he podido traducir tu posición a una dirección. Escríbela a mano.");
        return;
      }
      const address = [
        [place.street, place.streetNumber].filter(Boolean).join(", "),
        place.postalCode,
        place.city,
      ]
        .filter(Boolean)
        .join(" · ");
      update("origin_address", address);
      update("origin_lat", pos.coords.latitude);
      update("origin_lng", pos.coords.longitude);
    } catch {
      setError("No he podido leer tu ubicación. Inténtalo de nuevo o escribe la dirección.");
    } finally {
      setLocating(false);
    }
  };

  const create = async () => {
    setError("");
    // Programado a medias: mejor frenar aquí que crear un pedido "para ahora"
    // cuando el cliente creía haberlo dejado para el sábado.
    if (scheduling && !parseScheduledAt(form.scheduled_date, form.scheduled_time)) {
      setError("Revisa el día y la hora del pedido programado (ej.: 25/08 y 09:30, en el futuro).");
      return;
    }
    // El servidor valida el suelo igualmente; frenar aquí da un mensaje mejor.
    if (offer && offer < floor) {
      setError(`Tu oferta es demasiado baja: el mínimo para este servicio es ${euro(floor)}.`);
      return;
    }
    setSending(true);
    try {
      const duplicate = await findRecentDuplicate();
      if (duplicate) {
        setSending(false);
        Alert.alert(
          "Ya tienes un pedido en marcha",
          "Hace menos de 30 minutos creaste otro pedido que sigue activo. ¿Quieres crear este también?",
          [
            { text: "Ver mis pedidos", onPress: () => router.push("/(cliente)/orders") },
            { text: "Crear igualmente", style: "destructive", onPress: () => reallyCreate() },
          ],
        );
        return;
      }
      await reallyCreate();
    } catch (err) {
      setError("No se pudo crear el pedido: " + (err.message || "error de conexión"));
      setSending(false);
    }
  };

  const reallyCreate = async () => {
    setSending(true);
    try {
      await submit();
      setStep(0);
      router.push("/(cliente)/orders");
    } catch (err) {
      setError("No se pudo crear el pedido: " + (err.message || "error de conexión"));
    } finally {
      setSending(false);
    }
  };

  const addFromCamera = async () => {
    try {
      await addPhotos(await takePhoto());
    } catch (err) {
      setError("No se pudo subir la foto: " + (err.message || "error de conexión"));
    }
  };

  const addFromGallery = async () => {
    try {
      await addPhotos(await pickPhotos());
    } catch (err) {
      setError("No se pudo subir la foto: " + (err.message || "error de conexión"));
    }
  };

  const CTA = ["Continuar con " + service.label, "Siguiente", "Siguiente", "Ver resumen"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.sm }}>
          <Caption>Paso {step + 1} de {TOTAL_STEPS}</Caption>
          <Steps current={step} total={TOTAL_STEPS} />
        </View>

        {/* ---------- Paso 1: servicio (canvas 1b) ---------- */}
        {step === 0 && (
          <>
            <Heading>¿Qué necesitas mover hoy?</Heading>
            {SERVICE_KEYS.map(key => {
              const item = SERVICES[key];
              const price = servicePriceFrom(tariffs, key);
              const selected = form.service === key;
              return (
                <Pressable key={key} onPress={() => setService(key)}>
                  <Card style={selected ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : null}>
                    <View style={styles.row}>
                      <ServiceIcon serviceKey={key} size={48} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Title>{item.label}</Title>
                        <Caption>{item.tagline}</Caption>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.price}>{euro(price)}</Text>
                        <Caption>desde</Caption>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
            <Caption>
              Precios actualizados hoy. En el paso 4 podrás proponer tu propio precio.
            </Caption>
          </>
        )}

        {/* ---------- Paso 2: direcciones SOBRE el mapa (canvas 1c) ---------- */}
        {step === 1 && (
          <>
            {/* Mapa a sangre completa; la hoja con los campos monta encima
                con las esquinas redondeadas, como en el canvas. */}
            <View style={styles.mapHero}>
              <AddressMapHero
                origin={form.origin_lat ? { lat: form.origin_lat, lng: form.origin_lng } : null}
                destination={
                  form.destination_lat
                    ? { lat: form.destination_lat, lng: form.destination_lng }
                    : null
                }
              />
            </View>
            <Card style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.rowBetween}>
                <Heading>Recogida y entrega</Heading>
                <Pressable onPress={useMyLocation} disabled={locating} style={styles.myLocation}>
                  <Ionicons name="locate-outline" size={15} color={colors.primary} />
                  <Text style={styles.myLocationText}>
                    {locating ? "Buscando…" : "Mi ubicación"}
                  </Text>
                </Pressable>
              </View>
              <Field
                label="Teléfono de contacto"
                value={form.client_phone}
                onChangeText={v => update("client_phone", v)}
                placeholder="600 000 000"
                keyboardType="phone-pad"
                inputMode="tel"
              />
              <AddressField
                label="Recogida"
                value={form.origin_address}
                zone="albacete"
                error={form.origin_address ? addressErrors.origin : ""}
                onChange={(text, picked) => {
                  update("origin_address", text);
                  // Coordenadas del geocodificador: evitan una segunda búsqueda
                  // al enviar y son más fiables que re-geocodificar el texto.
                  update("origin_lat", picked?.lat ?? null);
                  update("origin_lng", picked?.lng ?? null);
                }}
              />

              {service.hasZones && (
                <View style={{ gap: spacing.sm }}>
                  <Caption>Zona de entrega</Caption>
                  <Option
                    label="Albacete capital"
                    description="Entrega el mismo día"
                    selected={destinationZoneKey === "albacete"}
                    onPress={() => setZone("albacete")}
                  />
                  <Option
                    label="Villarrobledo"
                    description="Hasta 10 kg · entrega en 24 h"
                    selected={destinationZoneKey === "villarrobledo"}
                    onPress={() => setZone("villarrobledo")}
                  />
                </View>
              )}

              <AddressField
                label="Entrega"
                value={form.destination_address}
                zone={destinationZoneKey}
                error={form.destination_address ? addressErrors.destination : ""}
                onChange={(text, picked) => {
                  update("destination_address", text);
                  update("destination_lat", picked?.lat ?? null);
                  update("destination_lng", picked?.lng ?? null);
                }}
              />
            </Card>
          </>
        )}

        {/* ---------- Paso 3: la carga (canvas 1d) ---------- */}
        {step === 2 && (
          <>
            <View style={{ gap: spacing.xs }}>
              <Heading>¿Qué movemos?</Heading>
              <Caption>Con fotos el conductor sabe si le cabe, y tú evitas sorpresas.</Caption>
            </View>

            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.overline}>Descripción</Text>
                <Caption>
                  {(form.cargo_description || "").length} / {MAX_DESCRIPTION}
                </Caption>
              </View>
              <Field
                value={form.cargo_description}
                onChangeText={v => update("cargo_description", v.slice(0, MAX_DESCRIPTION))}
                placeholder="Ej.: un sofá de 2 plazas y dos cajas medianas"
                multiline
                numberOfLines={3}
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />

              <View style={styles.rowBetween}>
                <Text style={styles.overline}>Fotos de la carga</Text>
                <Caption>
                  {photos.length} de {MAX_PHOTOS}
                  {service.needsPhotos && photos.length === 0 ? " · al menos 1" : ""}
                </Caption>
              </View>
              <View style={styles.photos}>
                {photos.map((url, i) => (
                  <Pressable key={url} onPress={() => removePhoto(i)}>
                    <Image source={{ uri: url }} style={styles.photo} />
                    <View style={styles.photoRemove}>
                      <Ionicons name="close" size={13} color="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}
                {photos.length < MAX_PHOTOS ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert("Añadir foto", "¿De dónde sale la imagen?", [
                        { text: "Cámara", onPress: addFromCamera },
                        { text: "Galería", onPress: addFromGallery },
                        { text: "Cancelar", style: "cancel" },
                      ])
                    }
                    style={styles.photoAdd}
                    disabled={uploading}
                  >
                    <Ionicons
                      name={uploading ? "hourglass-outline" : "add"}
                      size={22}
                      color={colors.primary}
                    />
                    <Caption>{uploading ? "Subiendo" : "Añadir"}</Caption>
                  </Pressable>
                ) : null}
              </View>
              <Caption>Toca una foto para quitarla. Se comprimen antes de subirlas.</Caption>
            </Card>

            {service.hasHelp && (
              <Card>
                <Toggle
                  label="Ayuda del conductor"
                  description={`Sube y baja contigo · +${tariffs.mudanza_help} €`}
                  value={form.needs_help}
                  onValueChange={v => update("needs_help", v)}
                />
                {form.needs_help ? (
                  <>
                    <Field
                      label="¿Con qué necesitas ayuda?"
                      value={form.help_description}
                      onChangeText={v => update("help_description", v)}
                      placeholder="Ej.: bajar un armario desde un tercero sin ascensor"
                    />
                    {service.hasAccess && (
                      <>
                        <Text style={styles.overline}>Planta recogida</Text>
                        <Toggle
                          label="Hay ascensor"
                          value={form.origin_has_lift === true}
                          onValueChange={v => update("origin_has_lift", v)}
                        />
                        {form.origin_has_lift === false && (
                          <Counter
                            label="Planta"
                            value={form.origin_floors}
                            onChange={v => update("origin_floors", v)}
                            min={0}
                            max={12}
                          />
                        )}
                        <Text style={styles.overline}>Planta entrega</Text>
                        <Toggle
                          label="Hay ascensor"
                          value={form.destination_has_lift === true}
                          onValueChange={v => update("destination_has_lift", v)}
                        />
                        {form.destination_has_lift === false && (
                          <Counter
                            label="Planta"
                            value={form.destination_floors}
                            onChange={v => update("destination_floors", v)}
                            min={0}
                            max={12}
                          />
                        )}
                      </>
                    )}
                  </>
                ) : null}
              </Card>
            )}

            {(!service.hasHelp || !form.needs_help) &&
              service.key !== "paquete" &&
              service.key !== "porte_tienda" && (
                <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
                  <Toggle
                    label="La carga está a pie de calle"
                    description="Sin ayuda contratada, el conductor no sube a domicilio: la mercancía tiene que estar preparada abajo."
                    value={acceptPortal}
                    onValueChange={setAcceptPortal}
                  />
                </Card>
              )}

            {/* Detalles propios de cada servicio: peso, objetos, horas, seguro
                y destinatario. Describen la carga, así que viven con ella. */}
            {(service.hasWeights ||
              service.hasItemsLimit ||
              service.hasExtraHours ||
              service.hasInsurance ||
              service.needsRecipient) && (
              <Card>
                {service.hasWeights && (
                  <View style={{ gap: spacing.sm }}>
                    <Text style={styles.overline}>Peso del paquete</Text>
                    {weightOptions.map(w => (
                      <Option
                        key={w.key}
                        label={w.label}
                        description={euro(tariffs[w.priceKey], 2)}
                        selected={form.package_weight === w.key}
                        onPress={() => update("package_weight", w.key)}
                      />
                    ))}
                  </View>
                )}

                {service.hasItemsLimit && (
                  <Counter
                    label={`Objetos a transportar (máx. ${service.maxItems})`}
                    value={form.items_count}
                    onChange={v => update("items_count", v)}
                    min={1}
                    max={service.maxItems}
                  />
                )}

                {service.hasExtraHours && (
                  <Counter
                    label={`Horas extra (+${tariffs.mudanza_extra_hour} €/h)`}
                    value={form.extra_hours}
                    onChange={v => update("extra_hours", v)}
                    min={0}
                    max={8}
                  />
                )}

                {service.hasInsurance && (
                  <Toggle
                    label="Seguro de mercancía"
                    description={`Cobertura adicional por ${euro(tariffs.insurance)}`}
                    value={form.insurance_selected}
                    onValueChange={v => update("insurance_selected", v)}
                  />
                )}

                {service.needsRecipient && (
                  <>
                    <Field
                      label="¿Quién recibe el envío?"
                      value={form.recipient_name}
                      onChangeText={v => update("recipient_name", v)}
                      placeholder="Nombre y apellidos"
                    />
                    <Field
                      label="Teléfono del destinatario"
                      value={form.recipient_phone}
                      onChangeText={v => update("recipient_phone", v)}
                      placeholder="600 000 000"
                      keyboardType="phone-pad"
                      inputMode="tel"
                    />
                  </>
                )}

                <Field
                  label="Notas para el conductor (opcional)"
                  value={form.notes}
                  onChangeText={v => update("notes", v)}
                  placeholder="Ej.: el portal es el del fondo"
                />
              </Card>
            )}

            <Card>
              <Toggle
                label="Acepto los términos del servicio"
                description="Y confirmo que la carga no incluye material peligroso."
                value={acceptTerms}
                onValueChange={setAcceptTerms}
              />
            </Card>
          </>
        )}

        {/* ---------- Paso 4: tu precio (canvas 1e) ---------- */}
        {step === 3 && (
          <>
            <View style={{ gap: spacing.xs }}>
              <Heading>Tu precio</Heading>
              <Caption>
                Puedes pedirlo al precio cerrado o proponer el tuyo y esperar respuestas.
              </Caption>
            </View>

            {/* El precio calculado, con su desglose */}
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.overline}>Precio cerrado ClicyVoy</Text>
                <Text style={styles.closedPrice}>{euro(quote.total, 2)}</Text>
              </View>
              {quote.lines?.map(line => (
                <View key={line.key} style={styles.rowBetween}>
                  <Caption style={{ flex: 1 }}>{line.label}</Caption>
                  <Caption>{line.amount ? euro(line.amount, 2) : "incluido"}</Caption>
                </View>
              ))}
            </Card>

            {/* Y la oferta propia, opcional */}
            {quote.total > 0 && (
              <Card>
                <Text style={styles.overline}>Proponer mi precio</Text>
                <Text style={styles.offerBig}>{euro(offer ?? quote.total)}</Text>
                {/* «Arrastra el importe» (canvas 1e): del suelo del 60% a 1,5×
                    la tarifa. Sin oferta, la barra descansa en la tarifa. */}
                <PriceSlider
                  min={floor}
                  max={Math.ceil(quote.total * 1.5)}
                  value={offer ?? quote.total}
                  onChange={v => update("proposed_price", String(v))}
                />
                <View style={styles.rowBetween}>
                  <Caption>mínimo {euro(floor)}</Caption>
                  <Caption>precio cerrado {euro(quote.total)}</Caption>
                </View>
                {offer ? (
                  <Button
                    title="Quitar mi oferta y pedirlo al precio cerrado"
                    variant="plain"
                    onPress={() => update("proposed_price", "")}
                  />
                ) : null}
                <Caption>
                  Los conductores pueden aceptar tu precio o contraofertar. Tú decides con quién vas.
                </Caption>
              </Card>
            )}
          </>
        )}

        {/* ---------- Paso 5: revisa y publica (canvas 1f) ---------- */}
        {step === 4 && (
          <>
            <Heading>Revisa y publica</Heading>

            <Card>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                  <ServiceIcon serviceKey={service.key} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Title>
                      {service.label}
                      {form.needs_help ? " con ayuda" : ""}
                    </Title>
                    <Caption>
                      {[
                        photos.length ? `${photos.length} foto${photos.length === 1 ? "" : "s"}` : null,
                        form.cargo_description,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Caption>
                  </View>
                </View>
                <Pressable onPress={() => setStep(2)}>
                  <Text style={styles.editLink}>Editar</Text>
                </Pressable>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.addressRow}>
                    <View style={[styles.addressDot, { backgroundColor: colors.primary }]} />
                    <Body style={{ flex: 1 }}>{form.origin_address || "—"}</Body>
                  </View>
                  <View style={styles.addressRow}>
                    <View style={[styles.addressDot, { backgroundColor: colors.foreground }]} />
                    <Body style={{ flex: 1 }}>{form.destination_address || "—"}</Body>
                  </View>
                </View>
                <Pressable onPress={() => setStep(1)}>
                  <Text style={styles.editLink}>Editar</Text>
                </Pressable>
              </View>
            </Card>

            <Card>
              <Text style={styles.overline}>¿Cuándo?</Text>
              <Option
                label="Lo antes posible"
                description="Se publica ahora a los conductores"
                selected={!scheduling}
                onPress={() => {
                  setWantSchedule(false);
                  update("scheduled_date", "");
                  update("scheduled_time", "");
                }}
              />
              <Option
                label="Programar"
                description="Elige día y hora; se publicará automáticamente"
                selected={scheduling}
                onPress={() => setWantSchedule(true)}
              />
              {scheduling ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Día (DD/MM)"
                      value={form.scheduled_date}
                      onChangeText={v => update("scheduled_date", v)}
                      placeholder="25/08"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Hora (HH:MM)"
                      value={form.scheduled_time}
                      onChangeText={v => update("scheduled_time", v)}
                      placeholder="09:30"
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.overline}>Pago</Text>
              <Option
                label="Tarjeta o Google Pay"
                description="Se paga desde la app, con el importe pactado"
                selected={form.payment_method === "card"}
                onPress={() => update("payment_method", "card")}
              />
              <Option
                label="Efectivo al conductor"
                description="Pagas al terminar el servicio"
                selected={form.payment_method === "cash"}
                onPress={() => update("payment_method", "cash")}
              />
            </Card>

            {/* Lo que se va a publicar, con la oferta si la hay */}
            <View style={styles.totalBar}>
              <View style={{ flex: 1, gap: 2 }}>
                <Caption>{offer ? "Tu oferta" : "Precio cerrado"}</Caption>
                {offer ? <Caption>cerrado {euro(quote.total)}</Caption> : null}
              </View>
              <Text style={styles.totalValue}>{euro(offer ?? quote.total, 2)}</Text>
            </View>
          </>
        )}

        <ErrorText>{error}</ErrorText>

        {/* ---------- Navegación ---------- */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {step > 0 && <Button title="Atrás" variant="plain" onPress={back} style={{ flex: 1 }} />}
          {step < TOTAL_STEPS - 1 ? (
            <Button title={CTA[step]} onPress={next} style={{ flex: 2 }} />
          ) : (
            <Button
              title={`Publicar mi ${service.label.toLowerCase()}`}
              onPress={create}
              loading={sending}
              style={{ flex: 2 }}
            />
          )}
        </View>

        {step > 0 && (
          <Pressable
            onPress={() =>
              Alert.alert("Empezar de cero", "Se borrará lo que has escrito en este pedido.", [
                { text: "Seguir aquí", style: "cancel" },
                {
                  text: "Empezar de cero",
                  style: "destructive",
                  onPress: async () => {
                    await clearDraft();
                    setStep(0);
                  },
                },
              ])
            }
          >
            <Caption style={{ textAlign: "center" }}>Descartar y empezar de cero</Caption>
          </Pressable>
        )}

        <Body style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  price: { fontSize: 18, fontFamily: "Poppins_700Bold", color: colors.foreground },
  overline: {
    fontSize: 11.5,
    fontFamily: "DMSans_700Bold",
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  myLocation: { flexDirection: "row", alignItems: "center", gap: 4 },
  myLocationText: { fontSize: 12.5, fontFamily: "DMSans_700Bold", color: colors.primary },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.secondary },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  closedPrice: { fontSize: 22, fontFamily: "Poppins_700Bold", color: colors.foreground },
  offerBig: { fontSize: 34, fontFamily: "Poppins_700Bold", color: colors.primary, textAlign: "center" },
  divider: { height: 1, backgroundColor: colors.border },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  addressDot: { width: 7, height: 7, borderRadius: radius.full, marginTop: 7 },
  editLink: { fontSize: 13, fontFamily: "DMSans_700Bold", color: colors.primary },
  totalBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
  },
  totalValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: colors.primary },
  // El mapa sangra hasta los bordes de la pantalla (compensa el padding del
  // ScrollView) y la hoja monta encima con esquinas redondeadas, como el canvas.
  mapHero: { marginHorizontal: -spacing.lg, marginTop: -spacing.sm },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: -4,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: 2,
  },
});
