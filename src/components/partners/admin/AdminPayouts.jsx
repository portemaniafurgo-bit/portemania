"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  adminListPayouts, adminResolvePayout, downloadCsv, formatDate, formatEuro,
  friendlyActionError, friendlyError,
} from "@/lib/partners";
import { EmptyBox, ErrorBox, LoadingBox, PayoutStatusBadge } from "@/components/partners/ui";
import ConfirmAction from "@/components/partners/admin/ConfirmAction";

const FILTERS = [
  { value: "requested", label: "Pendientes" },
  { value: "paid", label: "Pagadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "all", label: "Todas" },
];

function formatIban(iban) {
  return String(iban || "").replace(/(.{4})/g, "$1 ").trim();
}

/** Solicitudes de cobro de los comerciales: pagar (tras la transferencia) o rechazar. */
export default function AdminPayouts() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("requested");
  const [pending, setPending] = useState(null);

  const q = useQuery({
    queryKey: ["admin-partner-payouts", filter],
    queryFn: () => adminListPayouts(filter === "all" ? null : filter),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-partner-payouts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    queryClient.invalidateQueries({ queryKey: ["admin-partner-commissions"] });
  };

  const resolve = (p, act) =>
    setPending({
      key: `${p.id}-${act}`,
      title:
        act === "paid"
          ? `¿Marcar como pagados ${formatEuro(p.amount)} a ${p.display_name}?`
          : `¿Rechazar la solicitud de ${formatEuro(p.amount)} de ${p.display_name}?`,
      description:
        act === "paid"
          ? `Hazlo solo después de enviar la transferencia a ${p.holder} (${formatIban(p.iban)}).`
          : "Las comisiones vuelven a quedar pendientes; las de pedidos que ya no están entregados se anulan.",
      confirmLabel: act === "paid" ? "Marcar como pagado" : "Rechazar",
      destructive: act === "rejected",
      withNote: true,
      noteLabel: act === "paid" ? "Nota (opcional; la verá el comercial)" : "Motivo (lo verá el comercial)",
      run: async (note) => {
        try {
          const res = await adminResolvePayout(p.id, act, note);
          if (!res.ok) {
            toast({ title: "No se ha podido", description: res.message, variant: "destructive" });
          } else {
            toast({ title: act === "paid" ? "Marcado como pagado" : "Solicitud rechazada" });
          }
        } catch (err) {
          toast({ title: "No se ha podido", description: friendlyActionError(err), variant: "destructive" });
        }
        refresh();
        return true;
      },
    });

  const exportCsv = () => {
    const rows = q.data || [];
    downloadCsv(`cobros-comerciales-${filter}-${formatDate(new Date(), "yyyy-MM-dd")}.csv`, [
      ["Comercial", "Enlace", "Email", "Importe", "Estado", "Solicitado", "Resuelto", "Titular", "IBAN",
        "Comisiones", "% del importe que viene de servicios en efectivo", "Conductor = comercial", "Pedido no entregado o borrado", "Nota"],
      ...rows.map((p) => [
        p.display_name, p.slug, p.email || "", Number(p.amount).toFixed(2).replace(".", ","), p.status,
        formatDate(p.requested_at, "yyyy-MM-dd HH:mm"), p.resolved_at ? formatDate(p.resolved_at, "yyyy-MM-dd HH:mm") : "",
        p.holder || "", p.iban || "", p.commissions, String(p.cash_share_pct ?? 0).replace(".", ","),
        p.same_driver, p.order_undelivered, p.note || "",
      ]),
    ]);
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado" });
    } catch {
      toast({ title: "No se ha podido copiar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-muted rounded-xl">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="rounded-lg text-xs">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={exportCsv} disabled={!q.data?.length}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text={friendlyError(q.error, "las solicitudes")} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="No hay solicitudes en esta lista." />
      ) : (
        <div className="space-y-3">
          {q.data.map((p) => (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-foreground">
                    {p.display_name} <span className="text-xs text-muted-foreground font-normal">/{p.slug}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{p.email || "Cuenta borrada"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-display font-bold text-foreground">{formatEuro(p.amount)}</p>
                  <PayoutStatusBadge status={p.status} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <p className="text-muted-foreground">
                  Titular: <span className="text-foreground font-medium">{p.holder || "—"}</span>
                </p>
                <p className="text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  IBAN: <span className="text-foreground font-mono">{formatIban(p.iban) || "—"}</span>
                  {p.iban && (
                    <button type="button" onClick={() => copy(p.iban)} aria-label="Copiar IBAN" className="text-primary">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </p>
                <p className="text-muted-foreground">
                  Solicitado: {formatDate(p.requested_at, "d MMM yyyy HH:mm")}
                  {p.resolved_at && ` · resuelto ${formatDate(p.resolved_at)}`}
                </p>
                <p className="text-muted-foreground">
                  {p.commissions} comisiones · {String(p.cash_share_pct ?? 0).replace(".", ",")} % del importe que viene de servicios en efectivo
                </p>
              </div>

              {(p.same_driver > 0 || p.order_undelivered > 0) && (
                <div className="flex flex-wrap gap-2">
                  {p.same_driver > 0 && (
                    <Warning text={`${p.same_driver} con el propio comercial como conductor`} />
                  )}
                  {p.order_undelivered > 0 && (
                    <Warning text={`${p.order_undelivered} de pedidos que ya no están entregados o se borraron`} />
                  )}
                </div>
              )}

              {p.note && <p className="text-xs text-muted-foreground">Nota: {p.note}</p>}

              {p.status === "requested" && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" className="rounded-xl" onClick={() => resolve(p, "paid")}>
                    Marcar como pagado
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl text-destructive" onClick={() => resolve(p, "rejected")}>
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmAction pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}

function Warning({ text }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-xs text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5" /> {text}
    </span>
  );
}
