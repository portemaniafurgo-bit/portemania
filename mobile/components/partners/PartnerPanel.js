import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Share, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import { Button, Caption } from "../ui";
import { useDialog } from "../Dialog";
import PayoutDataCard from "./PayoutDataCard";
import {
  CommissionStatusBadge,
  EmptyBox,
  ErrorBox,
  KIND_LABEL,
  ListRow,
  LoadingBox,
  Notice,
  PayoutStatusBadge,
  Section,
  Tile,
} from "./ui";
import {
  fetchClients,
  fetchCommissions,
  fetchMyPayouts,
  formatDate,
  formatEuro,
  formatMonth,
  formatPct,
  partnerLink,
  requestPayout,
} from "../../lib/partners";
import { colors, radius, spacing } from "../../theme";

// Filas que se ven de cada lista antes de «Ver todas».
const PREVIEW_ROWS = 5;
// Alto máximo de una barra del gráfico mensual.
const BAR_HEIGHT = 110;

/**
 * Lista que se carga sola al montar y cada vez que cambia `reloadKey` (tirar
 * para recargar). Estados: cargando, error con reintentar y datos.
 */
function useList(fetcher, reloadKey) {
  const [state, setState] = useState({ loading: true, error: false, data: [] });
  const gen = useRef(0);
  const load = useCallback(async () => {
    const mine = ++gen.current;
    setState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const data = await fetcher();
      if (mine === gen.current) setState({ loading: false, error: false, data: data || [] });
    } catch {
      if (mine === gen.current) setState(prev => ({ ...prev, loading: false, error: true }));
    }
  }, [fetcher]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);
  return { ...state, retry: load };
}

/**
 * Panel del comercial ya activado. `d` es la respuesta de partner_dashboard();
 * `onRefresh` vuelve a leerlo todo (tras pedir un cobro o guardar el IBAN).
 */
export default function PartnerPanel({ d, userId, reloadKey, onRefresh }) {
  const blocked = d.partner?.status !== "active";
  const t = d.totals || {};
  const s = d.settings || {};

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{d.partner?.display_name}</Text>
          <Caption>
            Comercial desde {formatDate(d.partner?.created_date)} · {d.clients || 0}{" "}
            {d.clients === 1 ? "cliente" : "clientes"}
          </Caption>
        </View>
        <View style={[styles.statusChip, { backgroundColor: blocked ? colors.muted : colors.successBg }]}>
          <Text style={[styles.statusText, { color: blocked ? colors.destructive : colors.success }]}>
            {blocked ? "Bloqueado" : "Activo"}
          </Text>
        </View>
      </View>

      {blocked ? (
        <Notice tone="danger" icon="ban-outline">
          Tu perfil de comercial está bloqueado: tu enlace no capta clientes nuevos, las comisiones
          nuevas quedan en revisión y no puedes pedir cobros. Si crees que es un error, escríbenos.
        </Notice>
      ) : null}
      {!blocked && d.program_enabled === false ? (
        <Notice tone="warning" icon="pause-circle-outline">
          El programa está en pausa: tu enlace no capta clientes nuevos y las comisiones nuevas
          quedan en revisión. Lo que ya tenías disponible sigue siendo tuyo.
        </Notice>
      ) : null}

      <View style={styles.tiles}>
        <Tile
          icon="stats-chart-outline"
          label="Total generado"
          value={formatEuro(t.generated)}
          subtitle={`${t.services || 0} ${t.services === 1 ? "servicio" : "servicios"}`}
        />
        <Tile icon="wallet-outline" label="Disponible para cobrar" value={formatEuro(t.available)} />
        <Tile
          icon="hourglass-outline"
          label={`En espera de los ${s.hold_days} días`}
          value={formatEuro(t.pending_hold)}
        />
        {Number(t.awaiting_payment) > 0 ? (
          <Tile
            icon="card-outline"
            label="Pendiente de pago del servicio"
            value={formatEuro(t.awaiting_payment)}
            subtitle="Cuenta en cuanto el servicio esté pagado"
          />
        ) : null}
        <Tile icon="shield-outline" label="En revisión" value={formatEuro(t.held)} />
        <Tile icon="send-outline" label="Solicitado" value={formatEuro(t.requested)} />
        <Tile icon="checkmark-circle-outline" label="Cobrado" value={formatEuro(t.paid)} />
      </View>

      <MonthlyBars monthly={d.monthly} />
      <LinkCard slug={d.partner?.slug} name={d.partner?.display_name} />
      <RequestPayoutCard d={d} onDone={onRefresh} />
      <PayoutDataCard payoutData={d.payout_data} onSaved={onRefresh} />

      <Caption>
        Ganas el {formatPct(s.first_pct)} del primer servicio de cada cliente y el{" "}
        {formatPct(s.repeat_pct)} de los siguientes (sin propinas). Cada comisión se puede cobrar{" "}
        {s.hold_days} días después de entregar el servicio, si ya está pagado. Cobro desde{" "}
        {formatEuro(s.min_payout)}, una vez cada {s.payout_interval_days} días, por transferencia
        cuando ClicyVoy lo aprueba. De tus clientes solo ves el nombre de pila.
      </Caption>

      <ClientsList reloadKey={reloadKey} />
      <CommissionsList reloadKey={reloadKey} />
      <PayoutHistory userId={userId} reloadKey={reloadKey} />
    </View>
  );
}

/** Barras de los últimos 6 meses, con Views (sin librería de gráficas). */
function MonthlyBars({ monthly }) {
  const data = (Array.isArray(monthly) ? monthly : []).map(m => ({
    key: m.month,
    label: formatMonth(m.month),
    amount: Number(m.amount) || 0,
  }));
  const max = Math.max(0, ...data.map(m => m.amount));
  const empty = data.length === 0 || max === 0;

  return (
    <Section title="Últimos 6 meses" icon="bar-chart-outline">
      {empty ? (
        <EmptyBox text="Aún no hay comisiones. Comparte tu enlace para empezar." />
      ) : (
        <View style={styles.bars}>
          {data.map(m => (
            <View key={m.key} style={styles.barCol}>
              <Text style={styles.barValue} numberOfLines={1}>
                {m.amount > 0 ? formatEuro(m.amount).replace(",00", "") : ""}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: m.amount > 0 ? Math.max(4, Math.round((m.amount / max) * BAR_HEIGHT)) : 2 },
                    m.amount === 0 && { backgroundColor: colors.border },
                  ]}
                />
              </View>
              <Caption>{m.label}</Caption>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function LinkCard({ slug, name }) {
  const [copied, setCopied] = useState(false);
  const busy = useRef(false); // guarda contra el doble toque (copiar y compartir)
  if (!slug) return null;
  const link = partnerLink(slug);
  const firstName = String(name || "").trim().split(/\s+/)[0] || "";
  const message =
    `${firstName ? `Soy ${firstName}. ` : ""}Si necesitas un porte, una mini mudanza o enviar ` +
    `un paquete en Albacete, pídelo en ClicyVoy con mi enlace: ${link}` +
    ` (si te registras desde la app, escribe mi código: ${slug})`;

  const share = async text => {
    if (busy.current) return;
    busy.current = true;
    try {
      await Share.share({ message: text });
    } catch {
    } finally {
      busy.current = false;
    }
  };

  // La app no lleva librería de portapapeles: se usa el módulo nativo
  // «Clipboard» de React Native si el binario lo trae (get devuelve null si
  // no, sin lanzar). Si falta o falla, se comparte el enlace.
  const copy = async () => {
    if (busy.current) return;
    let ok = false;
    try {
      const clip = TurboModuleRegistry.get("Clipboard");
      if (clip && typeof clip.setString === "function") {
        clip.setString(link);
        ok = true;
      }
    } catch {}
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      await share(link);
    }
  };

  return (
    <Section title="Tu enlace" icon="link-outline">
      <View style={styles.linkBox}>
        <Text selectable style={styles.linkText}>
          {link}
        </Text>
      </View>
      <Caption>
        Tu código: <Text style={{ color: colors.foreground, fontFamily: "DMSans_500Medium" }}>{slug}</Text>
        . Quien se registre desde la app puede escribirlo al completar su perfil.
      </Caption>
      <Button title={copied ? "Enlace copiado" : "Copiar enlace"} icon={copied ? "checkmark" : "copy-outline"} variant="plain" onPress={copy} />
      <Button title="Compartir" icon="share-social-outline" onPress={() => share(message)} />
      <Caption>
        Cuenta para quien crea su cuenta con tu enlace y todavía no había pedido nada. Tu código QR
        está en la web.
      </Caption>
    </Section>
  );
}

function RequestPayoutCard({ d, onDone }) {
  const dialog = useDialog();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }
  const sendingRef = useRef(false); // guarda síncrona contra el doble toque
  const available = d.totals?.available || 0;
  const block = d.request_block;

  const send = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setResult(null);
    try {
      const res = await requestPayout();
      if (res.ok) {
        setResult({
          ok: true,
          text: `Hemos recibido tu solicitud de ${formatEuro(res.data.amount)}. Te avisaremos al pagarla.`,
        });
      } else {
        setResult({ ok: false, text: res.message });
      }
    } catch {
      setResult({ ok: false, text: "No se ha podido solicitar. Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      sendingRef.current = false;
      setSending(false);
      onDone?.();
    }
  };

  const ask = () => {
    if (sendingRef.current) return;
    dialog.show({
      title: `¿Solicitar el cobro de ${formatEuro(available)}?`,
      message:
        `Lo revisaremos y te lo pagaremos por transferencia a la cuenta que acaba en ` +
        `${d.payout_data?.iban_last4 || "—"}. Mientras tanto no podrás pedir otro.`,
      actions: [{ text: "Solicitar", onPress: send }, { text: "Cancelar", style: "cancel" }],
    });
  };

  return (
    <Section title="Solicitar cobro" icon="wallet-outline">
      <Caption>
        Disponible ahora:{" "}
        <Text style={{ color: colors.foreground, fontFamily: "DMSans_700Bold" }}>{formatEuro(available)}</Text>
      </Caption>
      {d.last_payout ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <Caption>
            Última solicitud: {formatEuro(d.last_payout.amount)} el {formatDate(d.last_payout.requested_at)}
          </Caption>
          <PayoutStatusBadge status={d.last_payout.status} />
        </View>
      ) : null}
      <Button title="Solicitar cobro" loading={sending} disabled={!d.can_request} onPress={ask} />
      {!d.can_request && block ? <Caption>{block.text}</Caption> : null}
      {result ? (
        <Notice tone={result.ok ? "success" : "danger"} icon={result.ok ? "checkmark-circle-outline" : "alert-circle-outline"}>
          {result.text}
        </Notice>
      ) : null}
    </Section>
  );
}

/** Botón «Ver todas (N)» / «Ver menos» para las listas largas. */
function MoreToggle({ total, open, onPress, noun }) {
  if (total <= PREVIEW_ROWS) return null;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 4 }}>
      <Text style={{ color: colors.primary, fontFamily: "DMSans_500Medium", fontSize: 14 }}>
        {open ? "Ver menos" : `Ver ${noun} (${total})`}
      </Text>
    </Pressable>
  );
}

function ClientsList({ reloadKey }) {
  const q = useList(fetchClients, reloadKey);
  const [open, setOpen] = useState(false);
  const rows = open ? q.data : q.data.slice(0, PREVIEW_ROWS);
  return (
    <Section title="Tu cartera" icon="people-outline">
      {q.loading && q.data.length === 0 ? (
        <LoadingBox />
      ) : q.error ? (
        <ErrorBox text="No se ha podido cargar tu cartera." onRetry={q.retry} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Todavía no tienes clientes. Cuando alguien cree su cuenta con tu enlace, aparecerá aquí." />
      ) : (
        <View>
          {rows.map((c, i) => (
            <ListRow
              key={String(c.n ?? i)}
              last={i === rows.length - 1}
              left={
                <>
                  <Text style={styles.rowTitle}>{c.first_name || "Cliente"}</Text>
                  <Caption>
                    Desde {formatDate(c.referred_at)} · {c.services || 0}{" "}
                    {c.services === 1 ? "servicio" : "servicios"}
                  </Caption>
                </>
              }
              right={<Text style={styles.rowAmount}>{formatEuro(c.commission)}</Text>}
            />
          ))}
          <MoreToggle total={q.data.length} open={open} onPress={() => setOpen(v => !v)} noun="todos" />
        </View>
      )}
    </Section>
  );
}

function CommissionsList({ reloadKey }) {
  const fetcher = useCallback(() => fetchCommissions(200), []);
  const q = useList(fetcher, reloadKey);
  const [open, setOpen] = useState(false);
  const rows = open ? q.data : q.data.slice(0, PREVIEW_ROWS);
  return (
    <Section title="Tus comisiones" icon="list-outline">
      {q.loading && q.data.length === 0 ? (
        <LoadingBox />
      ) : q.error ? (
        <ErrorBox text="No se han podido cargar tus comisiones." onRetry={q.retry} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Aún no tienes comisiones. Llegan cuando un cliente tuyo recibe su servicio." />
      ) : (
        <View>
          {rows.map((c, i) => (
            <ListRow
              key={`${c.date}-${i}`}
              last={i === rows.length - 1}
              left={
                <>
                  <Text style={styles.rowTitle}>{c.client_first_name || "Cliente"}</Text>
                  <Caption>
                    {formatDate(c.date)} · {KIND_LABEL[c.kind] || c.kind} · {formatPct(c.pct)}
                  </Caption>
                  {c.status === "pending" ? (
                    <Caption>Cobrable desde el {formatDate(c.available_at)}</Caption>
                  ) : c.status === "awaiting_payment" ? (
                    <Caption>Cobrable cuando se pague el servicio</Caption>
                  ) : null}
                </>
              }
              right={
                <>
                  <Text style={styles.rowAmount}>{formatEuro(c.amount)}</Text>
                  <CommissionStatusBadge status={c.status} />
                </>
              }
            />
          ))}
          <MoreToggle total={q.data.length} open={open} onPress={() => setOpen(v => !v)} noun="todas" />
        </View>
      )}
    </Section>
  );
}

function PayoutHistory({ userId, reloadKey }) {
  const fetcher = useCallback(() => fetchMyPayouts(userId), [userId]);
  const q = useList(fetcher, reloadKey);
  return (
    <Section title="Historial de cobros" icon="time-outline">
      {q.loading && q.data.length === 0 ? (
        <LoadingBox />
      ) : q.error ? (
        <ErrorBox text="No se ha podido cargar el historial." onRetry={q.retry} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Todavía no has pedido ningún cobro." />
      ) : (
        <View>
          {q.data.map((p, i) => (
            <ListRow
              key={p.id}
              last={i === q.data.length - 1}
              left={
                <>
                  <Text style={styles.rowTitle}>Solicitado el {formatDate(p.requested_at)}</Text>
                  {p.resolved_at ? <Caption>Resuelto el {formatDate(p.resolved_at)}</Caption> : null}
                  {p.note ? <Caption>{p.note}</Caption> : null}
                </>
              }
              right={
                <>
                  <Text style={styles.rowAmount}>{formatEuro(p.amount)}</Text>
                  <PayoutStatusBadge status={p.status} />
                </>
              }
            />
          ))}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  statusChip: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontFamily: "DMSans_700Bold" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.sm },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 10.5, fontFamily: "DMSans_500Medium", color: colors.mutedForeground },
  barTrack: { height: BAR_HEIGHT, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "70%", maxWidth: 36, backgroundColor: colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  linkBox: { backgroundColor: colors.muted, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  linkText: { fontSize: 14, fontFamily: "DMSans_500Medium", color: colors.foreground },
  rowTitle: { fontSize: 14.5, fontFamily: "DMSans_500Medium", color: colors.foreground },
  rowAmount: { fontSize: 14.5, fontFamily: "DMSans_700Bold", color: colors.foreground },
});
