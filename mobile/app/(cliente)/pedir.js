import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { parseScheduledAt, useRequestForm } from "../../lib/useRequestForm";
import { SERVICE_KEYS, SERVICES } from "../../lib/services";
import { servicePriceFrom } from "../../lib/tariffs";
import { pickPhotos, takePhoto } from "../../lib/photos";
import { Body, Button, Caption, Card, ErrorText, Field, Heading, Title } from "../../components/ui";
import { Counter, Option, PriceSummary, Steps, Toggle } from "../../components/wizard";
import AddressField from "../../components/AddressField";
import { colors, radius, spacing } from "../../theme";

/**
 * Asistente de pedido. Cuatro pasos tras elegir servicio:
 *   0 servicio · 1 contacto y direcciones · 2 carga · 3 detalles · 4 resumen
 *
 * Las validaciones y el cálculo viven en `lib/useRequestForm.js`, compartidos
 * con la web. Esta pantalla solo presenta. El precio que se ve es informativo:
 * el que se cobra lo fija el servidor al crear el pedido.
 */
const TOTAL_STEPS = 5;

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
  // El cliente eligió "Programarlo" (aunque aún no haya escrito el día): un
  // borrador recuperado con fecha también lo activa.
  const [wantSchedule, setWantSchedule] = useState(false);
  const scheduling = wantSchedule || !!form.scheduled_date;

  const next = () => {
    const { ok, reason } = validateStep(step);
    if (!ok) {
      setError(reason);
      return;
    }
    setError("");
    setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const back = () => {
    setError("");
    setStep(s => Math.max(0, s - 1));
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
    if (form.proposed_price && Number(form.proposed_price) < Math.ceil(quote.total * 0.6)) {
      setError(`Tu oferta es demasiado baja: el mínimo para este servicio es ${Math.ceil(quote.total * 0.6)} €.`);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Steps current={step} total={TOTAL_STEPS} />

        {/* ---------- Paso 0: servicio ---------- */}
        {step === 0 && (
          <>
            <View style={{ gap: spacing.xs }}>
              <Heading>¿Qué necesitas mover?</Heading>
              <Caption>Albacete capital · furgoneta y conductor</Caption>
            </View>
            {SERVICE_KEYS.map(key => {
              const item = SERVICES[key];
              const price = servicePriceFrom(tariffs, key);
              const selected = form.service === key;
              return (
                <Pressable key={key} onPress={() => setService(key)}>
                  <Card style={selected ? { borderColor: colors.primary, borderWidth: 2 } : null}>
                    <View style={styles.row}>
                      <Text style={styles.emoji}>{item.emoji}</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Title>{item.label}</Title>
                        <Caption>{item.tagline}</Caption>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Caption>desde</Caption>
                        <Text style={styles.price}>{price} €</Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}

        {/* ---------- Paso 1: contacto y direcciones ---------- */}
        {step === 1 && (
          <>
            <Heading>¿Dónde recogemos y dónde llevamos?</Heading>
            <Card>
              <Field
                label="Teléfono de contacto"
                value={form.client_phone}
                onChangeText={v => update("client_phone", v)}
                placeholder="600 000 000"
                keyboardType="phone-pad"
                inputMode="tel"
              />
              <AddressField
                label="Dirección de recogida"
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
                label="Dirección de entrega"
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

        {/* ---------- Paso 2: la carga ---------- */}
        {step === 2 && (
          <>
            <Heading>¿Qué transportamos?</Heading>
            <Card>
              <Field
                label="Describe la carga"
                value={form.cargo_description}
                onChangeText={v => update("cargo_description", v)}
                placeholder="Ej.: un sofá de 2 plazas y dos cajas medianas"
                multiline
                numberOfLines={3}
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />

              <View style={{ gap: spacing.sm }}>
                <Caption>Fotos de la carga{service.needsPhotos ? " (al menos 1)" : " (opcional)"}</Caption>
                <View style={styles.photos}>
                  {photos.map((url, i) => (
                    <Pressable key={url} onPress={() => removePhoto(i)}>
                      <Image source={{ uri: url }} style={styles.photo} />
                      <View style={styles.photoRemove}>
                        <Text style={styles.photoRemoveText}>×</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button title="Cámara" variant="plain" onPress={addFromCamera} loading={uploading} style={{ flex: 1 }} />
                  <Button title="Galería" variant="plain" onPress={addFromGallery} loading={uploading} style={{ flex: 1 }} />
                </View>
                <Caption>Toca una foto para quitarla. Se comprimen antes de subirlas.</Caption>
              </View>
            </Card>

            {service.hasHelp && (
              <Card>
                <Toggle
                  label="Necesito ayuda del conductor"
                  description={`El conductor sube y baja la carga contigo (+${tariffs.mudanza_help} €)`}
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
                        <Toggle
                          label="¿Hay ascensor en la recogida?"
                          value={form.origin_has_lift === true}
                          onValueChange={v => update("origin_has_lift", v)}
                        />
                        {form.origin_has_lift === false && (
                          <Counter
                            label="Plantas en la recogida"
                            value={form.origin_floors}
                            onChange={v => update("origin_floors", v)}
                            min={0}
                            max={12}
                          />
                        )}
                        <Toggle
                          label="¿Hay ascensor en la entrega?"
                          value={form.destination_has_lift === true}
                          onValueChange={v => update("destination_has_lift", v)}
                        />
                        {form.destination_has_lift === false && (
                          <Counter
                            label="Plantas en la entrega"
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

            <Card>
              <Toggle
                label="Acepto los términos y la política de privacidad"
                value={acceptTerms}
                onValueChange={setAcceptTerms}
              />
            </Card>
          </>
        )}

        {/* ---------- Paso 3: detalles del servicio ---------- */}
        {step === 3 && (
          <>
            <Heading>Últimos detalles</Heading>
            <Card>
              {service.hasWeights && (
                <View style={{ gap: spacing.sm }}>
                  <Caption>Peso del paquete</Caption>
                  {weightOptions.map(w => (
                    <Option
                      key={w.key}
                      label={w.label}
                      description={`${tariffs[w.priceKey]} €`}
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
                  description={`Cobertura adicional por ${tariffs.insurance} €`}
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
          </>
        )}

        {/* ---------- Paso 4: resumen y pago ---------- */}
        {step === 4 && (
          <>
            <Heading>Resumen del pedido</Heading>
            <Card>
              <Title>
                {service.emoji} {service.label}
              </Title>
              <Caption>Recogida: {form.origin_address}</Caption>
              <Caption>Entrega: {form.destination_address}</Caption>
              <Caption>{form.cargo_description}</Caption>
            </Card>

            <Card>
              <PriceSummary quote={quote} />
            </Card>

            {/* Negociación (canvas 1e): el calculado manda; ofertar es opcional */}
            {quote.total > 0 && (
              <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
                <Title>¿Quieres proponer tu precio?</Title>
                <Caption>
                  Opcional. Los conductores podrán aceptarlo o hacerte una contraoferta. Mínimo{" "}
                  {Math.ceil(quote.total * 0.6)} €.
                </Caption>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <View style={{ width: 120 }}>
                    <Field
                      value={String(form.proposed_price || "")}
                      onChangeText={v => update("proposed_price", v.replace(/[^0-9.]/g, ""))}
                      placeholder={`${quote.total}`}
                      keyboardType="numeric"
                      inputMode="decimal"
                    />
                  </View>
                  <Title>€</Title>
                  {form.proposed_price ? (
                    <Button
                      title="Quitar"
                      variant="plain"
                      onPress={() => update("proposed_price", "")}
                      style={{ minHeight: 40, paddingVertical: 8 }}
                    />
                  ) : null}
                </View>
                {form.proposed_price && Number(form.proposed_price) < Math.ceil(quote.total * 0.6) ? (
                  <Caption style={{ color: colors.destructive }}>
                    Demasiado bajo: el mínimo para este servicio es {Math.ceil(quote.total * 0.6)} €.
                  </Caption>
                ) : null}
              </Card>
            )}

            <Card>
              <Caption>¿Cuándo lo necesitas?</Caption>
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
                label="Programarlo"
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
              <Caption>¿Cómo quieres pagar?</Caption>
              <Option
                label="Efectivo al conductor"
                description="Pagas al terminar el servicio"
                selected={form.payment_method === "cash"}
                onPress={() => update("payment_method", "cash")}
              />
              <Option
                label="Tarjeta"
                description="Se paga desde la app al confirmar el pedido"
                selected={form.payment_method === "card"}
                onPress={() => update("payment_method", "card")}
              />
              {form.payment_method === "card" ? (
                <Caption>
                  Al confirmar, el pedido se crea y podrás pagarlo desde su pantalla con tarjeta o
                  Google Pay.
                </Caption>
              ) : null}
            </Card>
          </>
        )}

        <ErrorText>{error}</ErrorText>

        {/* ---------- Navegación ---------- */}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {step > 0 && <Button title="Atrás" variant="plain" onPress={back} style={{ flex: 1 }} />}
          {step < TOTAL_STEPS - 1 ? (
            <Button title="Continuar" onPress={next} style={{ flex: 2 }} />
          ) : (
            <Button title="Confirmar pedido" onPress={create} loading={sending} style={{ flex: 2 }} />
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
  emoji: {
    fontSize: 26,
    width: 48,
    height: 48,
    lineHeight: 48,
    textAlign: "center",
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  price: { fontSize: 18, fontWeight: "700", color: colors.primary },
  photos: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photo: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.secondary },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 16, lineHeight: 18, fontWeight: "700" },
});
