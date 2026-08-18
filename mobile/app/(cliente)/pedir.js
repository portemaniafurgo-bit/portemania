import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../../lib/auth";
import { parseScheduledAt, useRequestForm } from "../../lib/useRequestForm";
import { SERVICE_KEYS, SERVICES } from "../../lib/services";
import { INCLUDED_HOURS, offerFloor, servicePriceFrom } from "../../lib/tariffs";
import { pickPhotos, takePhoto } from "../../lib/photos";
import { euro } from "../../lib/money";
import { Body, Button, Caption, ErrorText, Field, Heading, Overline, Title } from "../../components/ui";
import { Counter, Option, Toggle } from "../../components/wizard";
import WizardChrome from "../../components/WizardChrome";
import OfferControl from "../../components/OfferControl";
import AddressField from "../../components/AddressField";
import FloorPicker from "../../components/FloorPicker";
import RecentAddresses from "../../components/RecentAddresses";
import AddressMapHero from "../../components/AddressMapHero";
import ServiceIcon from "../../components/ServiceIcon";
import { colors, radius, spacing } from "../../theme";

/**
 * Asistente de pedido, con los CINCO pasos del canvas (1b–1f):
 *   1 servicio · 2 direcciones · 3 la carga · 4 tu precio · 5 revisa y publica
 *
 * Cada paso usa el armazón del diseño: cabecera blanca fija con las barras y
 * el título, cuerpo gris que rueda y un solo botón de 54 abajo del todo.
 *
 * Las validaciones y el cálculo viven en `lib/useRequestForm.js`, compartidos
 * con la web. Esta pantalla solo presenta. El precio que se ve es informativo:
 * el que se cobra lo fija el servidor al crear el pedido.
 */
const TOTAL_STEPS = 5;
const MAX_DESCRIPTION = 300;
const MAX_PHOTOS = 6;

/** «Publicar mi porte», «mi mudanza», «mi compra», «mi envío» (canvas 1f). */
const PUBLISH_NOUN = {
  porte: "mi porte",
  mini_mudanza: "mi mudanza",
  porte_tienda: "mi compra",
  paquete: "mi envío",
};

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
  // El cliente eligió "Programar" (aunque aún no haya escrito el día): un
  // borrador recuperado con fecha también lo activa.
  const [wantSchedule, setWantSchedule] = useState(false);
  const scheduling = wantSchedule || !!form.scheduled_date;

  // Suelo de la oferta: nunca por debajo de 30 €, ni del 60 % de la tarifa.
  const floor = offerFloor(quote.total);
  const offer = form.proposed_price ? Number(form.proposed_price) : null;

  // Avisos en rojo de lo que falta, mientras se escribe y no solo al pulsar.
  const minDescription = service.key === "paquete" ? 5 : 10;
  const description = (form.cargo_description || "").trim();
  const descriptionShort = description.length > 0 && description.length < minDescription;
  const photosMissing = service.needsPhotos && photos.length === 0;

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

  /**
   * Fecha y hora con los DIÁLOGOS NATIVOS de Android, encadenados: primero el
   * calendario, después el reloj. Escribir "25/08" y "09:30" a mano en dos
   * campos era pedirle al cliente que hiciera de teclado numérico.
   */
  const pickSchedule = () => {
    const now = new Date();
    const current = parseScheduledAt(form.scheduled_date, form.scheduled_time) || now;
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      minimumDate: now,
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: current,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type !== "set" || !time) return;
            const chosen = new Date(date);
            chosen.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setWantSchedule(true);
            update("scheduled_date", format(chosen, "dd/MM"));
            update("scheduled_time", format(chosen, "HH:mm"));
          },
        });
      },
    });
  };

  const scheduledAt = parseScheduledAt(form.scheduled_date, form.scheduled_time);

  const create = async () => {
    setError("");
    // Programado a medias: mejor frenar aquí que crear un pedido "para ahora"
    // cuando el cliente creía haberlo dejado para el sábado.
    if (scheduling && !scheduledAt) {
      setError("Elige el día y la hora del pedido programado.");
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

  const addPhoto = () =>
    Alert.alert("Añadir foto", "¿De dónde sale la imagen?", [
      { text: "Cámara", onPress: async () => addSafely(takePhoto) },
      { text: "Galería", onPress: async () => addSafely(pickPhotos) },
      { text: "Cancelar", style: "cancel" },
    ]);

  const addSafely = async picker => {
    try {
      await addPhotos(await picker());
    } catch (err) {
      setError("No se pudo subir la foto: " + (err.message || "error de conexión"));
    }
  };

  const discard = () =>
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
    ]);

  const STEPS = [
    { title: "¿Qué necesitas\nmover hoy?", cta: `Continuar con ${service.label}`, ctaIcon: "arrow-forward" },
    { title: "Recogida y entrega", cta: "Siguiente" },
    {
      title: "¿Qué movemos?",
      subtitle: "Con fotos el conductor sabe si le cabe, y tú evitas sorpresas.",
      cta: "Siguiente",
    },
    {
      title: "Tu precio",
      subtitle: "Puedes pedirlo al precio cerrado o proponer el tuyo y esperar respuestas.",
      cta: "Ver resumen",
    },
    { title: "Revisa y publica", cta: `Publicar ${PUBLISH_NOUN[service.key] || "mi pedido"}` },
  ];
  const current = STEPS[step];

  // El paso 2 lleva el mapa a sangre y la hoja encima (canvas 1c), así que no
  // usa el armazón de cabecera blanca.
  if (step === 1) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }} edges={["top", "left", "right"]}>
        <View style={styles.mapFull}>
          <AddressMapHero
            origin={form.origin_lat ? { lat: form.origin_lat, lng: form.origin_lng } : null}
            destination={
              form.destination_lat ? { lat: form.destination_lat, lng: form.destination_lng } : null
            }
          />
          <View style={styles.mapTopBar}>
            <Pressable onPress={back} style={styles.floatingCircle}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={useMyLocation} style={styles.floatingPill} disabled={locating}>
              <Ionicons name="locate" size={15} color={colors.primary} />
              <Text style={styles.floatingPillText}>
                {locating ? "Buscando…" : "Mi ubicación"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.addressSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.bars}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <View
                key={i}
                style={[styles.bar, { backgroundColor: i <= step ? colors.primary : colors.hairline }]}
              />
            ))}
          </View>
          <Heading>Recogida y entrega</Heading>

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
              // Coordenadas del geocodificador: evitan una segunda búsqueda al
              // enviar y son más fiables que re-geocodificar el texto.
              update("origin_lat", picked?.lat ?? null);
              update("origin_lng", picked?.lng ?? null);
            }}
          />
          {/* Sus direcciones de siempre, a un toque (como Uber o Cabify) */}
          <RecentAddresses
            field="origin"
            onPick={item => {
              update("origin_address", item.address);
              update("origin_lat", item.lat);
              update("origin_lng", item.lng);
            }}
          />

          {service.hasZones && (
            <View style={{ gap: spacing.sm }}>
              <Overline>ZONA DE ENTREGA</Overline>
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
          <RecentAddresses
            field="destination"
            onPick={item => {
              update("destination_address", item.address);
              update("destination_lat", item.lat);
              update("destination_lng", item.lng);
            }}
          />

          <ErrorText>{error}</ErrorText>
          <Button title="Siguiente" onPress={next} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <WizardChrome
      step={step}
      total={TOTAL_STEPS}
      title={current.title}
      subtitle={current.subtitle}
      showStepLabel={step === 0}
      onBack={step > 0 ? back : null}
      cta={current.cta}
      ctaIcon={current.ctaIcon}
      ctaLoading={sending}
      onCta={step === TOTAL_STEPS - 1 ? create : next}
      footerExtra={<ErrorText>{error}</ErrorText>}
    >
      {/* ---------- Paso 1: servicio (canvas 1b) ---------- */}
      {step === 0 && (
        <>
          {SERVICE_KEYS.map(key => {
            const item = SERVICES[key];
            const price = servicePriceFrom(tariffs, key);
            const selected = form.service === key;
            return (
              <Pressable
                key={key}
                onPress={() => setService(key)}
                style={[styles.serviceCard, selected && styles.serviceCardOn]}
              >
                <ServiceIcon serviceKey={key} size={48} iconSize={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{item.label}</Text>
                  <Text style={styles.serviceTagline}>{item.tagline}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.servicePrice}>{euro(price)}</Text>
                  <Text style={styles.serviceFrom}>desde</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.note}>
            <Ionicons name="flash-outline" size={16} color={colors.primary} />
            <Text style={styles.noteText}>
              Precios actualizados hoy. En el paso 4 podrás{" "}
              <Text style={styles.noteStrong}>proponer tu propio precio</Text>.
            </Text>
          </View>
        </>
      )}

      {/* ---------- Paso 3: la carga (canvas 1d) ---------- */}
      {step === 2 && (
        <>
          <View style={styles.plainCard}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Overline>DESCRIPCIÓN</Overline>
                <Text style={styles.required}>obligatorio</Text>
              </View>
              <Text style={[styles.counterText, descriptionShort && { color: colors.destructive }]}>
                {(form.cargo_description || "").length} / {MAX_DESCRIPTION}
              </Text>
            </View>
            <Field
              value={form.cargo_description}
              onChangeText={v => update("cargo_description", v.slice(0, MAX_DESCRIPTION))}
              placeholder={
                service.key === "mini_mudanza"
                  ? "Ej.: sofá de 3 plazas, mesa de comedor con 4 sillas, armario de 2 puertas y 6 cajas medianas"
                  : "Ej.: un sofá de 2 plazas y dos cajas medianas"
              }
              multiline
              numberOfLines={3}
              style={{ minHeight: 90, textAlignVertical: "top" }}
              error={descriptionShort ? `Escribe al menos ${minDescription} caracteres` : ""}
            />
            <Caption>
              {service.key === "mini_mudanza"
                ? "Cuanto más detallada, mejor: el conductor necesita saber qué hay que mover para llevar la furgoneta y el tiempo adecuados."
                : "Di qué hay que mover y cuántas piezas son."}
            </Caption>
          </View>

          <View style={styles.plainCard}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Overline>FOTOS DE LA CARGA</Overline>
                {service.needsPhotos ? <Text style={styles.required}>obligatorio</Text> : null}
              </View>
              <Caption style={photosMissing ? { color: colors.destructive } : null}>
                {photos.length} de {MAX_PHOTOS}
                {photosMissing ? " · falta al menos 1" : ""}
              </Caption>
            </View>
            {service.key === "mini_mudanza" ? (
              <Caption>
                Sube fotos de <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>todo lo que
                hay que transportar</Caption>: así el conductor sabe si le cabe y no hay sorpresas al llegar.
              </Caption>
            ) : null}
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
                <Pressable onPress={addPhoto} style={styles.photoAdd} disabled={uploading}>
                  <Ionicons
                    name={uploading ? "hourglass-outline" : "add"}
                    size={22}
                    color={colors.primary}
                  />
                  <Caption style={{ fontSize: 11 }}>{uploading ? "Subiendo" : "Añadir"}</Caption>
                </Pressable>
              ) : null}
            </View>
          </View>

          {service.hasHelp && (
            <View style={styles.plainCard}>
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
                      {/* Ascensor y plantas juntos: elegir la planta ya
                          significa "no hay ascensor". Antes había que marcar y
                          desmarcar un interruptor para poder tocar el número. */}
                      <FloorPicker
                        label="PLANTA RECOGIDA"
                        hasLift={form.origin_has_lift}
                        floors={form.origin_floors}
                        onChange={(hasLift, floors) => {
                          update("origin_has_lift", hasLift);
                          update("origin_floors", floors);
                        }}
                        pricePerFloor={tariffs.mudanza_floor}
                      />
                      <FloorPicker
                        label="PLANTA ENTREGA"
                        hasLift={form.destination_has_lift}
                        floors={form.destination_floors}
                        onChange={(hasLift, floors) => {
                          update("destination_has_lift", hasLift);
                          update("destination_floors", floors);
                        }}
                        pricePerFloor={tariffs.mudanza_floor}
                      />
                    </>
                  )}
                </>
              ) : null}
            </View>
          )}

          {(!service.hasHelp || !form.needs_help) &&
            service.key !== "paquete" &&
            service.key !== "porte_tienda" && (
              <View style={[styles.plainCard, { backgroundColor: colors.warningBg }]}>
                <Toggle
                  label="La carga está a pie de calle"
                  description="Confirmo que la recogida se hace a pie de calle"
                  value={acceptPortal}
                  onValueChange={setAcceptPortal}
                />
              </View>
            )}

          {/* Detalles propios de cada servicio: peso, objetos, horas, seguro y
              destinatario. Describen la carga, así que viven con ella. */}
          {(service.hasWeights ||
            service.hasItemsLimit ||
            service.hasExtraHours ||
            service.hasInsurance ||
            service.needsRecipient) && (
            <View style={styles.plainCard}>
              {service.hasWeights && (
                <View style={{ gap: spacing.sm }}>
                  <Overline>PESO DEL PAQUETE</Overline>
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
                <>
                  <Counter
                    label={`Objetos a transportar (máx. ${service.maxItems})`}
                    value={form.items_count}
                    onChange={v => update("items_count", v)}
                    min={1}
                    max={service.maxItems}
                  />
                  <Caption>
                    El primero va incluido; cada objeto de más suma{" "}
                    {euro(tariffs.porte_item ?? 3)}.
                    {Number(form.items_count) > 1
                      ? ` Llevas ${Number(form.items_count) - 1} adicional${Number(form.items_count) > 2 ? "es" : ""}: +${euro((Number(form.items_count) - 1) * (tariffs.porte_item ?? 3))}.`
                      : ""}
                  </Caption>
                </>
              )}

              {service.hasExtraHours && (
                <>
                  <View style={styles.includedBox}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Caption style={{ flex: 1 }}>
                      El precio incluye <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>{INCLUDED_HOURS} horas</Caption> de
                      servicio. Si crees que va a llevar más, añade horas ahora: sale más barato que
                      ajustarlo después.
                    </Caption>
                  </View>
                  <Counter
                    label={`Horas extra (+${tariffs.mudanza_extra_hour} €/h)`}
                    value={form.extra_hours}
                    onChange={v => update("extra_hours", v)}
                    min={0}
                    max={8}
                  />
                </>
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
            </View>
          )}

          <View style={styles.plainCard}>
            <Toggle
              label="Acepto los términos del servicio"
              description="Y confirmo que la carga no incluye material peligroso."
              value={acceptTerms}
              onValueChange={setAcceptTerms}
            />
          </View>
        </>
      )}

      {/* ---------- Paso 4: tu precio (canvas 1e) ---------- */}
      {step === 3 && (
        <>
          <View style={styles.plainCard}>
            <Overline>PRECIO CERRADO CLICYVOY</Overline>
            <Text style={styles.closedPrice}>{euro(quote.total, 2)}</Text>
            <View style={{ gap: 9 }}>
              {quote.lines?.map(line => (
                <View key={line.key} style={styles.rowBetween}>
                  <Text style={styles.lineLabel}>{line.label}</Text>
                  <Text style={[styles.lineLabel, !line.amount && { color: colors.mutedForeground }]}>
                    {line.amount ? euro(line.amount, 2) : "incluido"}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {quote.total > 0 && (
            <>
              <OfferControl
                value={offer ?? quote.total}
                min={floor}
                max={Math.ceil(quote.total * 1.5)}
                closed={quote.total}
                enabled={offer != null}
                onToggle={on => update("proposed_price", on ? String(quote.total) : "")}
                onChange={v => update("proposed_price", String(v))}
              />
              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={18} color={colors.subtle} />
                <Text style={styles.infoText}>
                  Los conductores pueden aceptar tu precio o contraofertar. Tú decides con quién vas.
                </Text>
              </View>
            </>
          )}
        </>
      )}

      {/* ---------- Paso 5: revisa y publica (canvas 1f) ---------- */}
      {step === 4 && (
        <>
          <View style={styles.plainCard}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                <ServiceIcon serviceKey={service.key} size={44} iconSize={22} />
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
              <Pressable onPress={() => setStep(2)} hitSlop={8}>
                <Text style={styles.editLink}>Editar</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.addressRow}>
                  <View style={[styles.addressDot, { backgroundColor: colors.primary }]} />
                  <Body style={{ flex: 1 }}>{form.origin_address || "—"}</Body>
                </View>
                <View style={styles.addressRow}>
                  <View style={[styles.addressDot, { backgroundColor: colors.foreground }]} />
                  <Body style={{ flex: 1 }}>{form.destination_address || "—"}</Body>
                </View>
              </View>
              <Pressable onPress={() => setStep(1)} hitSlop={8}>
                <Text style={styles.editLink}>Editar</Text>
              </Pressable>
            </View>
          </View>

          {/* ¿CUÁNDO? — dos pastillas y, si programa, los diálogos nativos */}
          <View style={styles.plainCard}>
            <Overline>¿CUÁNDO?</Overline>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={() => {
                  setWantSchedule(false);
                  update("scheduled_date", "");
                  update("scheduled_time", "");
                }}
                style={[styles.whenPill, !scheduling && styles.whenPillOn]}
              >
                <Text style={[styles.whenText, !scheduling && { color: colors.primary }]}>
                  Lo antes posible
                </Text>
              </Pressable>
              <Pressable
                onPress={pickSchedule}
                style={[styles.whenPill, scheduling && styles.whenPillOn]}
              >
                <Text style={[styles.whenText, scheduling && { color: colors.primary }]}>
                  Programar
                </Text>
              </Pressable>
            </View>
            {scheduling ? (
              <Pressable onPress={pickSchedule} style={styles.scheduleRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Body style={{ flex: 1 }}>
                  {scheduledAt
                    ? format(scheduledAt, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })
                    : "Elegir día y hora"}
                </Body>
                <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.plainCard}>
            <Overline>PAGO</Overline>
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
          </View>

          <View style={styles.totalBar}>
            <View style={{ flex: 1, gap: 2 }}>
              <Caption>{offer ? "Tu oferta" : "Precio cerrado"}</Caption>
              {offer ? <Caption>cerrado {euro(quote.total)}</Caption> : null}
            </View>
            <Text style={styles.totalValue}>{euro(offer ?? quote.total, 2)}</Text>
          </View>

          <Pressable onPress={discard}>
            <Caption style={{ textAlign: "center" }}>Descartar y empezar de cero</Caption>
          </Pressable>
        </>
      )}
    </WizardChrome>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  // Tarjeta del canvas: blanca, radio 20, sin borde y con sombra plana.
  plainCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: spacing.md },

  // Paso 1 — tarjetas de servicio
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  serviceCardOn: { borderWidth: 2, borderColor: colors.primary, padding: 17 },
  serviceName: { fontSize: 17, lineHeight: 21, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  serviceTagline: { fontSize: 13, lineHeight: 18, fontFamily: "DMSans_400Regular", color: colors.mutedForeground, marginTop: 3 },
  servicePrice: { fontSize: 20, fontFamily: "Poppins_700Bold", color: colors.foreground },
  serviceFrom: { fontSize: 11, fontFamily: "DMSans_400Regular", color: colors.subtle, marginTop: 2 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: "DMSans_400Regular", color: colors.mutedForeground },
  noteStrong: { fontFamily: "DMSans_700Bold", color: colors.ink },

  // Paso 2 — mapa a sangre y hoja
  mapFull: { flex: 1 },
  mapTopBar: {
    position: "absolute",
    left: spacing.screen,
    right: spacing.screen,
    top: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  floatingCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  floatingPill: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    elevation: 3,
  },
  floatingPillText: { fontSize: 12.5, fontFamily: "DMSans_500Medium", color: colors.foreground },
  addressSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.screen,
    paddingTop: 10,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DEDCE4",
    marginBottom: 14,
  },
  bars: { flexDirection: "row", gap: 6, marginBottom: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },

  // Paso 3
  counterText: { fontSize: 11.5, fontFamily: "DMSans_400Regular", color: "#B5B4BE" },
  required: { fontSize: 10.5, fontFamily: "DMSans_700Bold", color: colors.destructive, textTransform: "uppercase" },
  includedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
  },
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

  // Paso 4
  closedPrice: { fontSize: 34, lineHeight: 38, fontFamily: "Poppins_700Bold", color: colors.foreground },
  lineLabel: { fontSize: 13.5, fontFamily: "DMSans_400Regular", color: colors.ink },
  infoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingHorizontal: 4 },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 19, fontFamily: "DMSans_400Regular", color: colors.mutedForeground },

  // Paso 5
  divider: { height: 1, backgroundColor: colors.hairline },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  addressDot: { width: 7, height: 7, borderRadius: radius.full, marginTop: 7 },
  editLink: { fontSize: 13, fontFamily: "DMSans_700Bold", color: colors.primary },
  whenPill: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  whenPillOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  whenText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: colors.mutedForeground },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
  },
  totalBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 18,
  },
  totalValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: colors.primary },
});
