"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Handshake, Euro, Wallet, Hourglass, ShieldAlert, Send, CheckCircle2,
  Link2, Copy, MessageCircle, Users, ListChecks, History, Loader2, Ban, CreditCard,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatsCard from "@/components/common/StatsCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import {
  fetchClients, fetchCommissions, fetchMyPayouts, formatDate, formatEuro, formatPct,
  partnerLink, requestPayout,
} from "@/lib/partners";
import PartnerQr from "@/components/partners/PartnerQr";
import PayoutDataCard from "@/components/partners/PayoutDataCard";
import {
  CommissionStatusBadge, EmptyBox, ErrorBox, KIND_LABEL, LoadingBox, PayoutStatusBadge, Section,
} from "@/components/partners/ui";

/** Panel del comercial ya activado. `d` es la respuesta de partner_dashboard(). */
export default function PartnerPanel({ d, userId }) {
  const queryClient = useQueryClient();
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["partner-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["partner-commissions"] });
    queryClient.invalidateQueries({ queryKey: ["partner-payouts"] });
    queryClient.invalidateQueries({ queryKey: ["partner-clients"] });
  };

  const blocked = d.partner?.status !== "active";
  const t = d.totals || {};
  const s = d.settings || {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Handshake className="w-6 h-6 text-primary" /> Gana con ClicyVoy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {d.partner?.display_name} · comercial desde {formatDate(d.partner?.created_date)} ·{" "}
            {d.clients || 0} {d.clients === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <span
          className={
            blocked
              ? "px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800"
              : "px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"
          }
        >
          {blocked ? "Bloqueado" : "Activo"}
        </span>
      </div>

      {blocked && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <Ban className="w-5 h-5 shrink-0" />
          <p>
            Tu perfil de comercial está bloqueado: tu enlace no capta clientes nuevos, las comisiones
            nuevas quedan en revisión y no puedes pedir cobros. Si crees que es un error, escríbenos.
          </p>
        </div>
      )}
      {!blocked && d.program_enabled === false && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          El programa está en pausa: tu enlace no capta clientes nuevos y las comisiones nuevas quedan
          en revisión. Lo que ya tenías disponible sigue siendo tuyo.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total generado" value={formatEuro(t.generated)} subtitle={`${t.services || 0} servicios`} icon={Euro} />
        <StatsCard title="Disponible para cobrar" value={formatEuro(t.available)} icon={Wallet} />
        <StatsCard
          title={`En espera de los ${s.hold_days ?? 15} días`}
          value={formatEuro(t.pending_hold)}
          icon={Hourglass}
        />
        <StatsCard title="Retenido en revisión" value={formatEuro(t.held)} icon={ShieldAlert} />
        <StatsCard title="Solicitado" value={formatEuro(t.requested)} icon={Send} />
        <StatsCard title="Cobrado" value={formatEuro(t.paid)} icon={CheckCircle2} />
        {Number(t.awaiting_payment) > 0 && (
          <StatsCard
            title="Pendiente de pago del servicio"
            value={formatEuro(t.awaiting_payment)}
            subtitle="Cuenta en cuanto el servicio esté pagado"
            icon={CreditCard}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <MonthlyChart monthly={d.monthly} />
        <LinkCard slug={d.partner?.slug} name={d.partner?.display_name} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <RequestPayoutCard d={d} onDone={refreshAll} />
        <PayoutDataCard payoutData={d.payout_data} onSaved={refreshAll} />
      </div>

      <p className="text-xs text-muted-foreground">
        Ganas el {formatPct(s.first_pct)} del primer servicio de cada cliente y el{" "}
        {formatPct(s.repeat_pct)} de los siguientes (sin propinas). Cada comisión se puede cobrar{" "}
        {s.hold_days ?? 15} días después del servicio, si ya está pagado. Cobro desde {formatEuro(s.min_payout)}, una vez
        cada {s.payout_interval_days ?? 30} días, por transferencia tras nuestra revisión.
      </p>

      <ClientsTable />
      <CommissionsTable />
      <PayoutHistory userId={userId} />
    </div>
  );
}

function MonthlyChart({ monthly }) {
  const data = (Array.isArray(monthly) ? monthly : []).map((m) => ({
    label: formatDate(`${m.month}-01T12:00:00`, "MMM"),
    amount: Number(m.amount) || 0,
    services: m.services || 0,
  }));
  const empty = data.every((m) => m.amount === 0);

  return (
    <Section title="Últimos 6 meses">
      {empty ? (
        <EmptyBox text="Aún no hay comisiones. Comparte tu enlace para empezar." />
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} className="text-xs" />
              <YAxis axisLine={false} tickLine={false} className="text-xs" />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
                formatter={(value) => [formatEuro(value), "Comisiones"]}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

function LinkCard({ slug, name }) {
  if (!slug) return null;
  const link = partnerLink(slug);
  const firstName = String(name || "").trim().split(/\s+/)[0] || "";
  const message = `${firstName ? `Soy ${firstName}. ` : ""}Si necesitas un porte, una mini mudanza o enviar un paquete en Albacete, pídelo en ClicyVoy con mi enlace: ${link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Enlace copiado" });
    } catch {
      toast({ title: "No se ha podido copiar", description: link, variant: "destructive" });
    }
  };

  return (
    <Section title="Tu enlace" icon={Link2}>
      <div className="flex flex-col sm:flex-row gap-5 items-center">
        <PartnerQr value={link} fileName={`qr-clicyvoy-${slug}.svg`} />
        <div className="flex-1 w-full space-y-3">
          <p className="text-sm font-medium text-foreground break-all bg-muted rounded-xl px-3 py-2">
            {link}
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="rounded-xl gap-2" onClick={copy}>
              <Copy className="w-4 h-4" /> Copiar enlace
            </Button>
            <Button asChild className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cuenta para quien crea su cuenta con tu enlace y todavía no había pedido nada.
          </p>
        </div>
      </div>
    </Section>
  );
}

function RequestPayoutCard({ d, onDone }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // guarda síncrona contra doble clic
  const available = d.totals?.available || 0;
  const block = d.request_block;

  const send = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await requestPayout();
      if (res.ok) {
        toast({
          title: "Cobro solicitado",
          description: `Hemos recibido tu solicitud de ${formatEuro(res.data.amount)}. Te avisaremos al pagarla.`,
        });
      } else {
        toast({ title: "No se ha podido solicitar", description: res.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "No se ha podido solicitar", description: "Revisa tu conexión e inténtalo de nuevo.", variant: "destructive" });
    } finally {
      sendingRef.current = false;
      setSending(false);
      setOpen(false);
      onDone();
    }
  };

  return (
    <Section title="Solicitar cobro" icon={Wallet}>
      <p className="text-sm text-muted-foreground">
        Disponible ahora: <span className="font-semibold text-foreground">{formatEuro(available)}</span>
      </p>
      {d.last_payout && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          Última solicitud: {formatEuro(d.last_payout.amount)} el {formatDate(d.last_payout.requested_at)}
          <PayoutStatusBadge status={d.last_payout.status} />
        </div>
      )}
      <Button
        className="w-full h-11 rounded-xl"
        disabled={!d.can_request || sending}
        onClick={() => setOpen(true)}
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Solicitar cobro"}
      </Button>
      {!d.can_request && block && <p className="text-xs text-muted-foreground">{block.text}</p>}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Solicitar el cobro de {formatEuro(available)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo revisaremos y te lo pagaremos por transferencia a la cuenta que acaba en{" "}
              {d.payout_data?.iban_last4}. Mientras tanto no podrás pedir otro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                send();
              }}
            >
              Solicitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

function ClientsTable() {
  const q = useQuery({ queryKey: ["partner-clients"], queryFn: fetchClients });
  return (
    <Section title="Tu cartera" icon={Users}>
      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text="No se ha podido cargar tu cartera." onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Todavía no tienes clientes. Cuando alguien cree su cuenta con tu enlace, aparecerá aquí." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Cliente</th>
                <th className="py-2 pr-4 font-medium">Desde</th>
                <th className="py-2 pr-4 font-medium text-right">Servicios</th>
                <th className="py-2 font-medium text-right">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.n} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{c.first_name}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatDate(c.referred_at)}</td>
                  <td className="py-2.5 pr-4 text-right">{c.services}</td>
                  <td className="py-2.5 text-right font-medium">{formatEuro(c.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function CommissionsTable() {
  const q = useQuery({ queryKey: ["partner-commissions"], queryFn: () => fetchCommissions(200) });
  return (
    <Section title="Tus comisiones" icon={ListChecks}>
      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text="No se han podido cargar tus comisiones." onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Aún no tienes comisiones. Llegan cuando un cliente tuyo recibe su servicio." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Cliente</th>
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium text-right">Comisión</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Cobrable desde</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c, i) => (
                <tr key={`${c.date}-${i}`} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatDate(c.date)}</td>
                  <td className="py-2.5 pr-4 font-medium text-foreground">{c.client_first_name}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                    {KIND_LABEL[c.kind] || c.kind} · {formatPct(c.pct)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-medium">{formatEuro(c.amount)}</td>
                  <td className="py-2.5 pr-4"><CommissionStatusBadge status={c.status} /></td>
                  <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                    {c.status === "pending"
                      ? formatDate(c.available_at)
                      : c.status === "awaiting_payment"
                      ? "Al pagarse el servicio"
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function PayoutHistory({ userId }) {
  const q = useQuery({
    queryKey: ["partner-payouts", userId],
    queryFn: () => fetchMyPayouts(userId),
    enabled: !!userId,
  });
  return (
    <Section title="Historial de cobros" icon={History}>
      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text="No se ha podido cargar el historial." onRetry={q.refetch} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyBox text="Todavía no has pedido ningún cobro." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Solicitado</th>
                <th className="py-2 pr-4 font-medium text-right">Importe</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Resuelto</th>
                <th className="py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => (
                <tr key={p.id} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{formatDate(p.requested_at)}</td>
                  <td className="py-2.5 pr-4 text-right font-medium">{formatEuro(p.amount)}</td>
                  <td className="py-2.5 pr-4"><PayoutStatusBadge status={p.status} /></td>
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                    {p.resolved_at ? formatDate(p.resolved_at) : "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">{p.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
