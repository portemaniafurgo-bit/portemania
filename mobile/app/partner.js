import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { useBottomPadding } from "../lib/layout";
import {
  fetchDashboard,
  fetchProgramSettings,
  isStaffRole,
  markIsPartner,
  reasonMessage,
} from "../lib/partners";
import EmptyState from "../components/EmptyState";
import PartnerActivate from "../components/partners/PartnerActivate";
import PartnerPanel from "../components/partners/PartnerPanel";
import { ErrorBox, LoadingBox } from "../components/partners/ui";
import { Heading } from "../components/ui";
import { colors, spacing } from "../theme";

const CONNECTION_ERROR = "No se ha podido cargar. Revisa tu conexión e inténtalo de nuevo.";

/**
 * «Gana con ClicyVoy» (ClicyVoy Partners): pantalla del stack raíz, como el
 * chat, que sirve igual en modo cliente y en modo conductor. El guardia de
 * `_layout.js` no la devuelve a su grupo.
 *
 * Según lo que responda la base de datos:
 *  - programa sin instalar o apagado → pantalla neutra «no disponible»;
 *  - aún no es comercial y el programa no está abierto al público
 *    (lanzamiento privado) → también «no disponible», salvo el personal
 *    (admin/staff). Se decide al pintar, con el rol del momento: el rol puede
 *    llegar después de la primera lectura;
 *  - aún no es comercial → explicación con los porcentajes reales y el alta;
 *  - comercial → su panel (cifras, enlace, cobro, cartera y comisiones).
 * El admin del programa sigue siendo web: aquí no hay pantallas de admin.
 */
async function loadState() {
  try {
    const d = await fetchDashboard();
    if (d?.ok) return { status: "partner", dash: d };
    if (d?.reason === "not_installed") return { status: "unavailable" };
    if (d?.reason === "not_partner") {
      let program;
      try {
        program = await fetchProgramSettings();
      } catch (err) {
        if (err?.missing) return { status: "unavailable" };
        throw err;
      }
      if (!program || program.enabled !== true) return { status: "unavailable" };
      return { status: "activate", program };
    }
    return { status: "error", message: reasonMessage(d?.reason) };
  } catch {
    return { status: "error", message: CONNECTION_ERROR };
  }
}

export default function PartnerScreen() {
  const router = useRouter();
  const { user, mode, role } = useAuth();
  const bottomPad = useBottomPadding();
  const [state, setState] = useState({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  // Sube en cada recarga: las listas del panel se vuelven a leer con ella.
  const [reloadKey, setReloadKey] = useState(0);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Recarga pedida mientras otra estaba en marcha (p. ej. guardar el IBAN
  // durante un «tirar para recargar»): se hace UNA más al terminar, nunca se
  // pierde ni se encadenan varias.
  const queuedRef = useRef(false);

  /** Lee todo otra vez. `pull` = gesto de tirar (enseña el indicador arriba). */
  const reload = useCallback(async ({ pull = false, initial = false } = {}) => {
    if (pull) setRefreshing(true);
    if (loadingRef.current) {
      queuedRef.current = true;
      return;
    }
    loadingRef.current = true;
    // Un reintento tras un error vuelve a «cargando»; con datos en pantalla se
    // dejan a la vista mientras se recargan.
    if (!pull && !initial) setState(prev => (prev.status === "error" ? { status: "loading" } : prev));
    try {
      do {
        queuedRef.current = false;
        const next = await loadState();
        if (!mountedRef.current) return;
        setState(prev =>
          // Un fallo de red al recargar no borra el panel que ya se veía.
          next.status === "error" && prev.status === "partner" ? prev : next,
        );
        setReloadKey(k => k + 1);
      } while (queuedRef.current);
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reload({ initial: true });
  }, [reload]);

  // Guarda contra el doble toque: un segundo «atrás» sacaría otra pantalla.
  const leavingRef = useRef(false);
  const goBack = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // Se rearma solo: si la navegación no llegara a salir, el botón no se
    // queda muerto.
    setTimeout(() => {
      leavingRef.current = false;
    }, 800);
    if (router.canGoBack()) router.back();
    else router.replace(mode === "driver" ? "/(conductor)/ofertas" : "/(cliente)/pedir");
  };

  // Lanzamiento privado: sin ser comercial ni del personal, no se enseña el alta.
  const privateLaunch =
    state.status === "activate" && state.program?.public !== true && !isStaffRole(role);

  let content = null;
  if (state.status === "loading") {
    content = <LoadingBox />;
  } else if (state.status === "error") {
    content = <ErrorBox text={state.message} onRetry={() => reload()} />;
  } else if (state.status === "unavailable" || privateLaunch) {
    content = (
      <EmptyState
        title="No disponible ahora mismo"
        hint="El programa de comerciales no está disponible ahora mismo. Vuelve a mirarlo más adelante."
      />
    );
  } else if (state.status === "activate") {
    content = (
      <PartnerActivate
        program={state.program}
        defaultName={user?.user_metadata?.full_name || ""}
        onActivated={() => {
          markIsPartner(user?.id);
          reload();
        }}
      />
    );
  } else if (state.status === "partner") {
    content = (
      <PartnerPanel
        d={state.dash}
        userId={user?.id}
        reloadKey={reloadKey}
        onRefresh={() => reload()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Formularios de alta y de datos de cobro: el mismo patrón que el chat
          (en Android la ventana ya se encoge sola con el teclado). */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => reload({ pull: true })}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Volver">
              <Ionicons name="chevron-back" size={26} color={colors.foreground} />
            </Pressable>
            <Heading style={{ flex: 1 }}>Gana con ClicyVoy</Heading>
          </View>
          {content}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screen, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
