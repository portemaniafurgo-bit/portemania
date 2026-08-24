import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth";
import { fetchMyDriverProfile } from "../../../lib/driverProfile";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { STATUS_LABELS, useOrder } from "../../../lib/orders";
import { serviceOf } from "../../../lib/services";
import { euro } from "../../../lib/money";
import { geocodeAlbacete } from "../../../lib/eta";
import { setArrivalTarget, startTracking, stopTracking } from "../../../lib/tracking";
import TrackingMap from "../../../components/TrackingMap";
import ChatBubbleButton from "../../../components/ChatBubbleButton";
import { uploadProofPhoto, uploadSignature } from "../../../lib/deliveryProof";
import { countUnread } from "../../../lib/unread";
import { takePhoto } from "../../../lib/photos";
import SignaturePad from "../../../components/SignaturePad";
import { Body, Button, Caption, Card, ErrorText, Field, Loading, Title } from "../../../components/ui";
import { useBottomPadding } from "../../../lib/layout";
import { colors, radius, spacing } from "../../../theme";

/**
 * Trabajo activo del conductor: avanzar estados, navegar, chatear y —lo que la
 * web no puede— emitir posición con el móvil bloqueado.
 *
 * Los pasos son los mismos que en la web, sin atajos: aceptado → en camino →
 * recogido → entregado, y la cancelación solo antes de recoger.
 */
/**
 * Las seis fases del servicio, tal y como se trabaja de verdad.
 *
 * Las intermedias («he llegado», «iniciar viaje a destino») no cambian el
 * estado del pedido: son marcas de tiempo. Así el cliente y el panel siguen
 * viendo el ciclo de siempre y el conductor tiene el detalle que necesita.
 *
 * `phase` es lo que se manda al servidor; él decide si toca y si ha pasado el
 * margen de 2 minutos.
 */
const STEPS = [
  { phase: "start_to_pickup", label: "Iniciar viaje", is: o => o.status === "accepted" },
  {
    phase: "arrived_pickup",
    label: "He llegado",
    is: o => o.status === "in_transit" && !o.arrived_pickup_at,
  },
  {
    phase: "picked_up",
    label: "Carga recogida",
    is: o => o.status === "in_transit" && !!o.arrived_pickup_at,
  },
  {
    phase: "start_to_destination",
    label: "Iniciar viaje a destino",
    is: o => o.status === "picked_up" && !o.to_destination_at,
  },
  {
    phase: "arrived_dropoff",
    label: "He llegado",
    is: o => o.status === "picked_up" && !!o.to_destination_at && !o.arrived_dropoff_at,
  },
  {
    phase: "finish",
    label: "Trabajo finalizado",
    is: o => o.status === "picked_up" && !!o.arrived_dropoff_at,
  },
];

/** Qué está haciendo ahora mismo, para la banda de estado. */
function phaseTitle(order) {
  if (order.status === "accepted") return "Servicio aceptado";
  if (order.status === "in_transit") {
    return order.arrived_pickup_at ? "En el punto de recogida" : "De camino a recoger";
  }
  if (order.status === "picked_up") {
    if (order.arrived_dropoff_at) return "En el punto de entrega";
    return order.to_destination_at ? "De camino a la entrega" : "Carga recogida";
  }
  return null;
}

// Mismas etiquetas que la web: el admin ya las tiene tabuladas.
const FEEDBACK_TAGS = ["Precio justo", "Precio injusto", "Mucho tiempo de espera"];

/** «3ª con ascensor» / «2ª sin ascensor», como rotula el canvas las plantas. */
function floorLabel(floors, hasLift) {
  if (!floors) return null;
  return `${floors}ª ${hasLift ? "con" : "sin"} ascensor`;
}

const CANCEL_REASONS = [
  "Avería o problema con la furgoneta",
  "No puedo llegar a tiempo",
  "La carga no es la descrita",
  "Motivo personal",
];

/** Dato suelto de la ficha de carga: etiqueta arriba, valor debajo. */
function Detail({ label, value }) {
  return (
    <View style={styles.detailItem}>
      <Caption>{label}</Caption>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TrabajoActivo() {
  // Aire al final para que ningun boton quede bajo la barra del sistema.
  const bottomPad = useBottomPadding();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { order, loading, patchOrder } = useOrder(id);

  const [profile, setProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  // ETA hacia el destino de ahora, que pinta la banda de estado (canvas 1k).
  const [eta, setEta] = useState({ route: null, freshness: null });
  // Segundos que faltan para poder cambiar de fase. Los dice el servidor: con
  // el reloj del móvil bastaría cambiar la hora para saltarse la espera.
  const [waitSeconds, setWaitSeconds] = useState(0);
  // Foto de la carga ampliada: en miniatura no se distingue un sofá de dos plazas.
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedbackTags, setFeedbackTags] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [showProof, setShowProof] = useState(false);
  const [proofPhotoUri, setProofPhotoUri] = useState(null);
  const [recipientName, setRecipientName] = useState("");
  // Mi posición para el mapa EMBEBIDO (estilo Uber): sale del GPS del propio
  // móvil en primer plano, no de la BD — es más fresca y no gasta consultas.
  const [myPos, setMyPos] = useState(null);
  const [fallbackTarget, setFallbackTarget] = useState(null);
  const trackingStarted = useRef(false);

  useEffect(() => {
    let active = true;
    let subscription = null;
    (async () => {
      try {
        let { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) granted = (await Location.requestForegroundPermissionsAsync()).granted;
        if (!granted || !active) return;
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
          pos => {
            if (active) {
              setMyPos({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updatedAt: new Date().toISOString(),
              });
            }
          },
        );
      } catch {
        // Sin permiso o sin GPS: el mapa se muestra sin mi posición, y los
        // botones de Maps/Waze siguen funcionando.
      }
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const sendFeedback = async () => {
    setSaving(true);
    try {
      await supabase
        .from("transport_requests")
        .update({
          driver_feedback_tags: feedbackTags,
          driver_feedback_text: feedbackText.trim() || null,
        })
        .eq("id", id);
      patchOrder({ driver_feedback_tags: feedbackTags, driver_feedback_text: feedbackText.trim() || null });
    } catch (err) {
      setError("No se pudo enviar la opinión: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchMyDriverProfile(user).then(setProfile);
  }, [user]);

  // Cuánto falta para la siguiente fase: se pregunta al servidor al entrar y
  // tras cada cambio, y de ahí baja sola cada segundo.
  useEffect(() => {
    if (!id) return;
    supabase
      .rpc("phase_wait_seconds", { p_request_id: id })
      .then(({ data }) => setWaitSeconds(Number(data) || 0));
  }, [id, order?.status, order?.phase_changed_at]);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  // Aviso de mensajes sin leer en la fila del chat. Se recalcula al volver de
  // la pantalla de chat (que es donde se marcan como leídos).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (id && user?.id) {
        countUnread([id], user.id).then(counts => {
          if (active) setUnreadCount(counts[id] || 0);
        });
      }
      return () => {
        active = false;
      };
    }, [id, user?.id]),
  );

  // Geocodificación de respaldo del destino del mapa (solo si el pedido no
  // trae coordenadas). Va ANTES de los return tempranos: es un hook.
  useEffect(() => {
    if (!order) return;
    const toPickup = ["accepted", "in_transit"].includes(order.status);
    const lat = toPickup ? order.origin_lat : order.destination_lat;
    const address = toPickup ? order.origin_address : order.destination_address;
    if (lat || !address) {
      setFallbackTarget(null);
      return;
    }
    let active = true;
    geocodeAlbacete(address).then(coords => {
      if (active && coords) setFallbackTarget(coords);
    });
    return () => {
      active = false;
    };
  }, [order?.status, order?.origin_address, order?.destination_address]);

  // El seguimiento vive mientras el trabajo esté vivo. Al salir de la pantalla
  // NO se para: el conductor va a estar en Google Maps, que es justo cuando más
  // falta hace. Se para al terminar, al cancelar o desde el toggle de
  // disponibilidad.
  useEffect(() => {
    const active = order && ["accepted", "in_transit", "picked_up"].includes(order.status);
    if (!active || !profile?.id || trackingStarted.current) return;

    trackingStarted.current = true;
    startTracking(profile.id).then(result => {
      if (!result.ok) setError(result.reason);
    });
  }, [order?.status, profile?.id]);

  // Destino de la fase actual, para que el seguimiento avise al cliente cuando
  // el conductor esté llegando (a la recogida primero, a la entrega después).
  useEffect(() => {
    if (!order) return;
    const active = ["accepted", "in_transit", "picked_up"].includes(order.status);
    const toPickup = ["accepted", "in_transit"].includes(order.status);
    const lat = toPickup ? order.origin_lat : order.destination_lat;
    const lng = toPickup ? order.origin_lng : order.destination_lng;
    if (!active || !lat || !lng) {
      setArrivalTarget(null);
      return;
    }
    setArrivalTarget(order.id, { lat, lng }, toPickup ? "pickup" : "dropoff");
  }, [order?.id, order?.status, order?.origin_lat, order?.destination_lat]);

  if (loading) return <Loading label="Cargando el servicio…" />;
  if (!order) {
    return (
      <SafeAreaView style={styles.screen}>
        <Card style={{ margin: spacing.lg }}>
          <Body>No hemos encontrado este servicio.</Body>
        </Card>
      </SafeAreaView>
    );
  }

  const service = serviceOf(order);
  // Lo pactado manda sobre lo calculado: es lo que va a cobrar.
  const pactado = order.final_price ?? order.estimated_price ?? null;
  const step = STEPS.find(s => s.is(order));
  const finished = ["delivered", "cancelled"].includes(order.status);
  // Política de cancelación, la misma que Uber, Bolt o inDrive:
  //  - Asignado y aún sin salir: se cancela sin más, vuelve a la bolsa.
  //  - Ya en camino: no es una cancelación normal, es un imprevisto — se pide
  //    motivo, queda registrado con el nombre y se avisa a la empresa.
  //  - Con la carga recogida: NO se cancela. La mercancía es del cliente y
  //    soltarla a medias no es una opción de la app, se llama a la empresa.
  const canCancel = order.status === "accepted";
  const startedTrip = order.status === "in_transit";
  // Hasta recoger, el destino de la navegación es la recogida.
  const goingToPickup = ["accepted", "in_transit"].includes(order.status);
  const navTarget = goingToPickup ? order.origin_address : order.destination_address;

  // Destino del mapa embebido. Si el pedido no trae coordenadas (dirección
  // tecleada a mano sin geocodificar), se geocodifica UNA vez y se cachea.
  const targetLat = goingToPickup ? order.origin_lat : order.destination_lat;
  const targetLng = goingToPickup ? order.origin_lng : order.destination_lng;
  const mapTarget =
    targetLat && targetLng ? { lat: targetLat, lng: targetLng } : fallbackTarget;

  const advance = async () => {
    if (!step) return;
    // Finalizar pasa SIEMPRE por la prueba de entrega (foto + firma). En los
    // servicios sin firma obligatoria se puede omitir, pero se ofrece: es lo
    // que protege al conductor y a la empresa ante una disputa.
    if (step.phase === "finish") {
      setShowProof(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      // El servidor decide si toca esta fase y si han pasado los 2 minutos.
      const { data, error: err } = await supabase.rpc("advance_job_phase", {
        p_request_id: id,
        p_phase: step.phase,
      });
      if (err) throw err;
      patchOrder(data); // sin esperar a Realtime: la pantalla avanza YA
      setWaitSeconds(PHASE_GAP_SECONDS);

      supabase.functions
        .invoke("send-push", { body: { mode: "status_changed", order_id: id } })
        .catch(() => {});
    } catch (err) {
      setError("No se pudo actualizar el estado: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Entrega con prueba. La firma (y la foto) se suben ANTES de marcar
   * entregado, para que no quede un pedido cerrado sin su justificante — mismo
   * orden que decidió la web.
   */
  const finishDelivery = async ({ signatureBase64 = null } = {}) => {
    setSaving(true);
    setError("");
    try {
      const patch = { status: "delivered", delivery_time: new Date().toISOString() };

      if (proofPhotoUri) {
        patch.proof_photo_url = await uploadProofPhoto(id, proofPhotoUri);
      }
      if (signatureBase64) {
        patch.proof_signature_url = await uploadSignature(id, signatureBase64);
        patch.delivered_signature_at = new Date().toISOString();
        if (recipientName.trim()) patch.recipient_name = recipientName.trim();
      }

      const { data, error: err } = await supabase
        .from("transport_requests")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (err) throw err;
      patchOrder(data); // el viaje queda TERMINADO en pantalla al instante

      await stopTracking();
      setShowProof(false);
      supabase.functions
        .invoke("send-push", { body: { mode: "status_changed", order_id: id } })
        .catch(() => {});
    } catch (err) {
      setError("No se pudo registrar la entrega: " + (err.message || "error de conexión"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancelar antes de recoger devuelve el pedido a pendientes con el motivo
   * registrado, igual que en la web, y avisa a la empresa.
   */
  const cancel = (reason) => {
    Alert.alert("Cancelar el servicio", `Motivo: ${reason}\n\nEl pedido volverá a la lista de pendientes.`, [
      { text: "Seguir con el servicio", style: "cancel" },
      {
        text: "Cancelar servicio",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          try {
            await supabase
              .from("transport_requests")
              .update({
                status: "pending",
                driver_id: null,
                driver_name: null,
                accepted_at: null,
                driver_cancel_reason: reason,
                driver_cancel_name: profile?.full_name || user?.email || "Conductor",
                driver_cancel_at: new Date().toISOString(),
              })
              .eq("id", id);
            await stopTracking();
            supabase.functions
              .invoke("send-push", { body: { mode: "driver_cancelled", order_id: id } })
              .catch(() => {});
            router.replace("/(conductor)/ofertas");
          } catch (err) {
            setError("No se pudo cancelar: " + (err.message || "error de conexión"));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  /** Primero el motivo, luego la confirmación: cancelar es cosa seria y la
   *  empresa necesita saber por qué. Ya en camino, el aviso es más serio y el
   *  motivo se marca como imprevisto en viaje. */
  const chooseCancelReason = () => {
    Alert.alert(
      startedTrip ? "No puedo continuar" : "Cancelar el servicio",
      startedTrip
        ? "Ya has salido hacia la recogida: esto se registra como imprevisto, se avisa a la empresa y el cliente vuelve a buscar conductor. ¿Qué ha pasado?"
        : "¿Qué ha pasado?",
      [
        ...CANCEL_REASONS.map(reason => ({
          text: reason,
          onPress: () => cancel(startedTrip ? `En viaje — ${reason}` : reason),
        })),
        { text: "Volver", style: "cancel" },
      ],
    );
  };

  const navigate = (app) => {
    const destination = encodeURIComponent(navTarget || "");
    const url =
      app === "waze"
        ? `https://waze.com/ul?q=${destination}&navigate=yes`
        : Platform.select({
            android: `google.navigation:q=${destination}`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
          });
    Linking.openURL(url).catch(() =>
      setError("No se pudo abrir la aplicación de navegación."),
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: true, title: "Servicio" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.screen, gap: spacing.lg, paddingBottom: bottomPad }}>
        {/* Banda morada del canvas 1k: barras de avance en amarillo, servicio y
            precio pactado, el estado en grande y qué toca después. */}
        <View style={styles.statusBand}>
          {!finished && order.status !== "cancelled" ? (
            <View style={styles.stepper}>
              {["accepted", "in_transit", "picked_up", "delivered"].map((s, i) => {
                const currentIndex = ["accepted", "in_transit", "picked_up", "delivered"].indexOf(order.status);
                return (
                  <View
                    key={s}
                    style={[styles.stepperBar, { backgroundColor: i <= currentIndex ? colors.accent : "#9A78E0" }]}
                  />
                );
              })}
            </View>
          ) : null}
          <Text style={styles.statusBandService}>
            {service?.label || "Servicio"}
            {pactado != null ? ` · ${euro(pactado)} pactado` : ""}
          </Text>
          <Text style={styles.statusBandTitle}>
            {phaseTitle(order) || STATUS_LABELS[order.status] || order.status}
          </Text>
          {step && !finished ? (
            <Text style={styles.statusBandNext}>Siguiente: {step.label.toLowerCase()}</Text>
          ) : null}
        </View>

        {/* Mapa DENTRO de la app (petición del cliente: como Uber), con la
            tarjeta de tiempo y dirección flotando encima, como en el canvas. */}
        {!finished && (
          <View style={styles.mapWrap}>
            <TrackingMap
              driverLocation={myPos}
              target={mapTarget}
              height={300}
              self
              bare
              targetKind={goingToPickup ? "pickup" : "dropoff"}
              onInfo={setEta}
            />
            <View style={styles.floatingEta}>
              <View>
                <Text style={styles.etaBig}>{eta?.route ? `${eta.route.minutes} min` : "—"}</Text>
                <Text style={styles.etaKm}>
                  {eta?.route ? `${String(eta.route.km).replace(".", ",")} km` : "calculando"}
                </Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.etaAddress}>
                  {(goingToPickup ? order.origin_address : order.destination_address) || "—"}
                </Text>
                <Text style={styles.etaMeta}>
                  {[
                    goingToPickup
                      ? floorLabel(order.origin_floors, order.origin_has_lift)
                      : floorLabel(order.destination_floors, order.destination_has_lift),
                    order.needs_help ? "con ayuda" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            </View>
            <View style={styles.floatingNav}>
              <Pressable onPress={() => navigate("gmaps")} style={styles.navPill}>
                <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                <Text style={styles.navPillText}>Google Maps</Text>
              </Pressable>
              <Pressable onPress={() => navigate("waze")} style={styles.navPill}>
                <Ionicons name="car-outline" size={16} color={colors.primary} />
                <Text style={styles.navPillText}>Waze</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* La otra punta del viaje, para tenerla a mano sin salir de aquí. */}
        <Card>
          <Caption>{goingToPickup ? "Después, entrega en" : "Se recogió en"}</Caption>
          <Body>{(goingToPickup ? order.destination_address : order.origin_address) || "—"}</Body>
          {finished ? (
            <>
              <View style={styles.divider} />
              <Caption>Recogida</Caption>
              <Body>{order.origin_address || "—"}</Body>
            </>
          ) : null}
        </Card>

        {/* CÓMO SE COBRA. Sin esto, el conductor podía pedir en efectivo un
            servicio ya pagado con tarjeta, o marcharse sin cobrar. */}
        {!finished && pactado != null && (
          <View
            style={[
              styles.paymentBox,
              order.payment_method === "cash"
                ? { backgroundColor: colors.warningBg, borderColor: colors.warning }
                : order.payment_status === "paid"
                  ? { backgroundColor: colors.successBg, borderColor: colors.success }
                  : { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
          >
            <Ionicons
              name={order.payment_method === "cash" ? "cash-outline" : "card-outline"}
              size={20}
              color={
                order.payment_method === "cash"
                  ? "#B27700"
                  : order.payment_status === "paid"
                    ? colors.success
                    : colors.primary
              }
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.paymentTitle}>
                {order.payment_method === "cash"
                  ? `Cobra ${euro(pactado, 2)} en efectivo`
                  : order.payment_status === "paid"
                    ? "Ya pagado con tarjeta"
                    : "Pago con tarjeta pendiente"}
              </Text>
              <Caption>
                {order.payment_method === "cash"
                  ? "Al terminar el servicio, en mano."
                  : order.payment_status === "paid"
                    ? "No le cobres nada al cliente."
                    : "Lo paga desde su app; no aceptes efectivo."}
              </Caption>
            </View>
          </View>
        )}

        {/* TODO lo que el cliente rellenó: es lo que el conductor necesita para
            saber si le cabe, si hay que subir y qué se lleva. */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="cube-outline" size={18} color={colors.primary} />
            <Title style={{ flex: 1 }}>Qué hay que mover</Title>
          </View>

          {order.cargo_description ? (
            <Body>{order.cargo_description}</Body>
          ) : (
            <Caption>El cliente no ha descrito la carga.</Caption>
          )}

          {/* Fotos de la carga, a tamaño mirable y ampliables */}
          {order.cargo_photos?.length ? (
            <>
              <Caption>
                {order.cargo_photos.length} foto{order.cargo_photos.length === 1 ? "" : "s"} · toca
                para ampliar
              </Caption>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {order.cargo_photos.map(url => (
                    <Pressable key={url} onPress={() => setZoomPhoto(url)}>
                      <Image source={{ uri: url }} style={styles.cargoPhoto} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </>
          ) : null}

          <View style={styles.detailGrid}>
            {order.items_count ? (
              <Detail label="Objetos" value={String(order.items_count)} />
            ) : null}
            {order.package_weight ? <Detail label="Peso" value={`${order.package_weight} kg`} /> : null}
            {order.extra_hours ? <Detail label="Horas extra" value={`${order.extra_hours} h`} /> : null}
            <Detail
              label="Recogida"
              value={floorLabel(order.origin_floors, order.origin_has_lift) || "A pie de calle"}
            />
            <Detail
              label="Entrega"
              value={floorLabel(order.destination_floors, order.destination_has_lift) || "A pie de calle"}
            />
            <Detail label="Ayuda" value={order.needs_help ? "Sí, contratada" : "No"} />
          </View>

          {order.needs_help && order.help_description ? (
            <View style={styles.helpBox}>
              <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>
                Con qué necesita ayuda
              </Caption>
              <Body>{order.help_description}</Body>
            </View>
          ) : null}

          {order.notes ? (
            <View style={styles.helpBox}>
              <Caption style={{ fontFamily: "DMSans_700Bold", color: colors.foreground }}>
                Notas del cliente
              </Caption>
              <Body>{order.notes}</Body>
            </View>
          ) : null}

          {order.recipient_name ? (
            <Caption>
              Recibe: {order.recipient_name}
              {order.recipient_phone ? ` · ${order.recipient_phone}` : ""}
            </Caption>
          ) : null}
        </Card>

        {/* El cliente y su carga, como en el canvas: quién es y qué se mueve. */}
        <Card>
          <View style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientInitial}>
                {(order.client_name || "C").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Title>{order.client_name || "Cliente"}</Title>
              <Caption>
                {[
                  order.cargo_description,
                  order.cargo_photos?.length
                    ? `${order.cargo_photos.length} foto${order.cargo_photos.length === 1 ? "" : "s"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sin descripción de la carga"}
              </Caption>
            </View>
            {order.client_phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${order.client_phone}`)}
                style={styles.callButton}
                hitSlop={8}
              >
                <Ionicons name="call" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        </Card>

        {!finished ? (
          <Caption>Tu posición se sigue enviando aunque salgas de la app o bloquees el móvil.</Caption>
        ) : null}

        <ErrorText>{error}</ErrorText>

        {step && !showProof && (
          <View style={{ gap: spacing.sm }}>
            <Button
              title={
                waitSeconds > 0
                  ? `${step.label} · en ${Math.floor(waitSeconds / 60)}:${String(waitSeconds % 60).padStart(2, "0")}`
                  : step.label
              }
              onPress={advance}
              loading={saving}
              disabled={waitSeconds > 0}
            />
            {waitSeconds > 0 ? (
              <Caption style={{ textAlign: "center" }}>
                Entre fase y fase pasan 2 minutos: así el historial del servicio se sostiene si
                alguien reclama.
              </Caption>
            ) : null}
          </View>
        )}

        {/* Prueba de entrega: foto de lo entregado + firma del receptor.
            Obligatoria en paquetes y compras en tienda; opcional en el resto. */}
        {showProof && !finished && (
          <Card>
            <Title>Prueba de entrega</Title>
            <Caption>
              {service?.signatureRequired
                ? "En este servicio la firma del receptor es obligatoria."
                : "Opcional, pero te protege si hay una disputa."}
            </Caption>

            <Button
              title={proofPhotoUri ? "Foto hecha ✓ (repetir)" : "Foto de lo entregado"}
              variant="plain"
              onPress={async () => {
                const uris = await takePhoto();
                if (uris[0]) setProofPhotoUri(uris[0]);
              }}
            />

            <Field
              label="¿Quién recibe?"
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Nombre de la persona que firma"
            />

            <SignaturePad
              capturing={saving}
              onCapture={base64 => {
                // En envíos de paquete la foto es obligatoria (propuesta §2.3):
                // el remitente no suele estar en la entrega y la foto es la
                // mitad de la prueba.
                if (service?.key === "paquete" && !proofPhotoUri) {
                  setError("En envíos de paquete la foto de la entrega es obligatoria.");
                  return;
                }
                finishDelivery({ signatureBase64: base64 });
              }}
            />

            {!service?.signatureRequired && (
              <Button
                title="Finalizar sin firma"
                variant="plain"
                loading={saving}
                onPress={() => finishDelivery()}
              />
            )}
            <Button title="Volver" variant="plain" onPress={() => setShowProof(false)} disabled={saving} />
          </Card>
        )}

        {finished && (
          <Card style={{ backgroundColor: colors.successBg, borderColor: colors.success }}>
            <Body>Servicio terminado. Ya no se comparte tu posición.</Body>
          </Card>
        )}

        {/* Opinión del conductor: la lee la empresa en el panel de admin. */}
        {order.status === "delivered" && !order.driver_feedback_tags && !order.driver_feedback_text && (
          <Card>
            <Title>¿Cómo fue el servicio?</Title>
            <Caption>Opcional. Lo lee la empresa, no el cliente.</Caption>
            <View style={styles.chips}>
              {FEEDBACK_TAGS.map(tag => {
                const on = feedbackTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() =>
                      setFeedbackTags(prev =>
                        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
                      )
                    }
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && { color: colors.primary }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Lo que quieras contarle a la empresa sobre este servicio…"
              multiline
            />
            <Button
              title="Enviar opinión"
              disabled={feedbackTags.length === 0 && !feedbackText.trim()}
              loading={saving}
              onPress={sendFeedback}
            />
          </Card>
        )}

        {/* Un solo enlace discreto (canvas 1k): el motivo se elige después, en
            una lista, no con cuatro botones compitiendo con el principal. */}
        {(canCancel || startedTrip) && (
          <Pressable onPress={chooseCancelReason} disabled={saving} style={{ paddingVertical: spacing.sm }}>
            <Text style={styles.cancelLink}>
              {startedTrip ? "No puedo continuar" : "Cancelar servicio"}
            </Text>
          </Pressable>
        )}

        {/* Con la carga ya recogida no se cancela desde la app: se resuelve
            hablando, como en cualquier plataforma seria. */}
        {order.status === "picked_up" && (
          <Card>
            <Title>¿Un problema con este servicio?</Title>
            <Caption>
              Con la carga recogida el servicio ya no se puede cancelar desde la app. Llama a la
              empresa y lo resolvemos contigo.
            </Caption>
            <Button
              title="Avisar a la empresa"
              variant="plain"
              icon="mail-outline"
              onPress={() =>
                Linking.openURL(
                  `mailto:portemaniafurgo@gmail.com?subject=${encodeURIComponent(
                    `Incidencia en servicio ${order.id.slice(0, 8)}`,
                  )}`,
                )
              }
            />
          </Card>
        )}

              </ScrollView>

      {/* Chat flotante con el cliente */}
      <Modal visible={!!zoomPhoto} transparent animationType="fade" onRequestClose={() => setZoomPhoto(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomPhoto(null)}>
          <Image source={{ uri: zoomPhoto }} style={styles.zoomImage} resizeMode="contain" />
        </Pressable>
      </Modal>

      <ChatBubbleButton
        orderId={order.id}
        partnerName={(order.client_name || "").split(" ")[0]}
        bottom={24}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, color: colors.mutedForeground },
  // Banda a sangre, como en el canvas: el morado llega hasta los bordes.
  statusBand: {
    backgroundColor: colors.primary,
    marginHorizontal: -spacing.screen,
    marginTop: -spacing.screen,
    paddingHorizontal: spacing.screen,
    paddingTop: 6,
    paddingBottom: 20,
  },
  // Canvas 1k: rótulo lila, titular blanco de 27 y la siguiente acción debajo.
  statusBandService: { fontSize: 12.5, fontFamily: "DMSans_400Regular", color: "#C9B4F0" },
  statusBandTitle: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: "Poppins_600SemiBold",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginTop: 6,
  },
  statusBandNext: { fontSize: 13, fontFamily: "DMSans_400Regular", color: "#E4D8FA", marginTop: 8 },
  mapWrap: { marginHorizontal: -spacing.screen, position: "relative" },
  floatingEta: {
    position: "absolute",
    left: spacing.screen,
    right: spacing.screen,
    top: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    elevation: 3,
  },
  etaBig: { fontSize: 20, lineHeight: 22, fontFamily: "Poppins_700Bold", color: colors.foreground },
  etaKm: { fontSize: 11, fontFamily: "DMSans_400Regular", color: colors.subtle, marginTop: 3 },
  etaDivider: { width: 1, height: 32, backgroundColor: colors.hairline },
  etaAddress: { fontSize: 13.5, lineHeight: 19, fontFamily: "DMSans_500Medium", color: colors.foreground },
  etaMeta: { fontSize: 11.5, fontFamily: "DMSans_400Regular", color: colors.subtle, marginTop: 2 },
  floatingNav: {
    position: "absolute",
    left: spacing.screen,
    right: spacing.screen,
    bottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  navPill: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    elevation: 3,
  },
  navPillText: { fontSize: 13.5, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  divider: { height: 1, backgroundColor: colors.border },
  zoomBackdrop: { flex: 1, backgroundColor: "#000000E6", alignItems: "center", justifyContent: "center" },
  zoomImage: { width: "100%", height: "80%" },
  cargoPhoto: { width: 130, height: 110, borderRadius: 12, backgroundColor: colors.secondary },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  detailItem: { minWidth: 96, gap: 2 },
  detailValue: { fontSize: 14, fontFamily: "DMSans_700Bold", color: colors.foreground },
  helpBox: { backgroundColor: colors.background, borderRadius: 12, padding: 12, gap: 2 },
  paymentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
  },
  paymentTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  clientRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  clientAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  clientInitial: { fontSize: 17, fontFamily: "Poppins_700Bold", color: colors.primary },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLink: { fontSize: 13.5, fontFamily: "DMSans_500Medium", color: colors.destructive, textAlign: "center" },
  stepper: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  stepperBar: { flex: 1, height: 4, borderRadius: radius.full },
});
