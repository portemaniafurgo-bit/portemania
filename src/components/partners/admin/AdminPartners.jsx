"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import {
  adminListCommissions, adminListPartners, adminReleaseCommission, adminSetPartnerStatus,
  formatDate, formatEuro, formatPct, friendlyActionError, friendlyError,
} from "@/lib/partners";
import {
  CommissionStatusBadge, EmptyBox, ErrorBox, KIND_LABEL, LoadingBox,
} from "@/components/partners/ui";
import ConfirmAction from "@/components/partners/admin/ConfirmAction";

const FLAG_LABEL = {
  same_driver: "Conductor = comercial",
  cash: "Efectivo",
  order_undelivered: "Pedido ya no entregado",
  order_deleted: "Pedido borrado",
  price_above_quote: "Precio muy por encima del presupuesto",
  high_amount: "Importe alto: en revisión",
  cash_high: "Efectivo o Bizum por importe alto: en revisión",
  partner_blocked: "Comercial bloqueado al generarse",
  program_disabled: "Programa apagado al generarse",
  admin_reversed: "Anulada por el admin",
};

/** Lista de comerciales, bloqueo y detalle de comisiones de cada uno. */
export default function AdminPartners() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);

  const q = useQuery({ queryKey: ["admin-partners"], queryFn: adminListPartners });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    queryClient.invalidateQueries({ queryKey: ["admin-partner-commissions"] });
  };

  const setStatus = (p, status) =>
    setPending({
      key: `${p.id}-${status}`,
      title: status === "blocked" ? `¿Bloquear a ${p.display_name}?` : `¿Desbloquear a ${p.display_name}?`,
      description:
        status === "blocked"
          ? "Su enlace deja de captar clientes, sus comisiones nuevas quedan retenidas para tu revisión y no puede pedir cobros. Lo ya generado se conserva."
          : "Vuelve a captar clientes y a pedir cobros. Las comisiones que se retuvieron mientras estaba bloqueado siguen retenidas hasta que las liberes.",
      confirmLabel: status === "blocked" ? "Bloquear" : "Desbloquear",
      destructive: status === "blocked",
      run: async () => {
        try {
          const res = await adminSetPartnerStatus(p.id, status);
          if (!res.ok) toast({ title: "No se ha podido", description: res.message, variant: "destructive" });
          else toast({ title: status === "blocked" ? "Comercial bloqueado" : "Comercial desbloqueado" });
        } catch (err) {
          toast({ title: "No se ha podido", description: friendlyActionError(err), variant: "destructive" });
        }
        refresh();
        return true;
      },
    });

  if (selected) {
    const current = q.data?.find((p) => p.id === selected) || null;
    return (
      <PartnerCommissions
        partner={current}
        partnerId={selected}
        onBack={() => setSelected(null)}
        onChanged={refresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text={friendlyError(q.error, "los comerciales")} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Todavía no hay comerciales." />
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Comercial</th>
                <th className="py-2.5 pr-4 font-medium">Estado</th>
                <th className="py-2.5 pr-4 font-medium text-right">Clientes</th>
                <th className="py-2.5 pr-4 font-medium text-right">Generado</th>
                <th className="py-2.5 pr-4 font-medium text-right">Disponible</th>
                <th className="py-2.5 pr-4 font-medium text-right">Retenido</th>
                <th className="py-2.5 pr-4 font-medium text-right">Pagado</th>
                <th className="py-2.5 pr-4 font-medium">Avisos</th>
                <th className="py-2.5 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => {
                const t = p.totals || {};
                const f = p.flags || {};
                const warnings = [
                  f.same_driver > 0 && `${f.same_driver} conductor = comercial`,
                  f.held > 0 && `${f.held} retenidas`,
                  f.order_undelivered > 0 && `${f.order_undelivered} ya no entregadas`,
                  f.order_deleted > 0 && `${f.order_deleted} de pedidos borrados`,
                  f.price_above_quote > 0 && `${f.price_above_quote} con precio muy alto`,
                  f.high_amount > 0 && `${f.high_amount} de importe alto`,
                ].filter(Boolean);
                return (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 align-top">
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground">/{p.slug}</p>
                      <p className="text-xs text-muted-foreground">{p.has_user ? p.email : "Cuenta borrada"}</p>
                      <p className="text-xs text-muted-foreground">
                        Desde {formatDate(p.created_date)} · {p.payout_data ? "con IBAN" : "sin IBAN"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          p.status === "active"
                            ? "px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"
                            : "px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800"
                        }
                      >
                        {p.status === "active" ? (p.has_user ? "Activo" : "Sin cuenta") : "Bloqueado"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{p.clients}</td>
                    <td className="py-3 pr-4 text-right">{formatEuro(t.generated)}</td>
                    <td className="py-3 pr-4 text-right">{formatEuro(t.available)}</td>
                    <td className="py-3 pr-4 text-right">{formatEuro(t.held)}</td>
                    <td className="py-3 pr-4 text-right">{formatEuro(t.paid)}</td>
                    <td className="py-3 pr-4">
                      {warnings.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {warnings.map((w) => (
                            <span key={w} className="inline-flex items-center gap-1 text-xs text-amber-800">
                              <AlertTriangle className="w-3 h-3" /> {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setSelected(p.id)}>
                          Comisiones
                        </Button>
                        {p.status === "active" ? (
                          <Button size="sm" variant="ghost" className="rounded-lg text-destructive" onClick={() => setStatus(p, "blocked")}>
                            Bloquear
                          </Button>
                        ) : (
                          p.has_user && (
                            <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setStatus(p, "active")}>
                              Desbloquear
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmAction pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}

function PartnerCommissions({ partner, partnerId, onBack, onChanged }) {
  const [pending, setPending] = useState(null);
  const q = useQuery({
    queryKey: ["admin-partner-commissions", partnerId],
    queryFn: () => adminListCommissions(partnerId),
  });

  const act = (c, action) =>
    setPending({
      key: `${c.id}-${action}`,
      title: action === "release" ? `¿Liberar ${formatEuro(c.amount)}?` : `¿Anular ${formatEuro(c.amount)}?`,
      description:
        action === "release"
          ? "La comisión deja de estar retenida y podrá cobrarse cuando pase su fecha."
          : "La comisión deja de contar y no se podrá cobrar.",
      confirmLabel: action === "release" ? "Liberar" : "Anular",
      destructive: action === "reverse",
      run: async () => {
        try {
          const res = await adminReleaseCommission(c.id, action);
          if (!res.ok) toast({ title: "No se ha podido", description: res.message, variant: "destructive" });
          else toast({ title: action === "release" ? "Comisión liberada" : "Comisión anulada" });
        } catch (err) {
          toast({ title: "No se ha podido", description: friendlyActionError(err), variant: "destructive" });
        }
        onChanged();
        return true;
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Comerciales
        </Button>
        <p className="font-semibold text-foreground">
          {partner ? `${partner.display_name} · /${partner.slug}` : "Comisiones"}
        </p>
      </div>

      {q.isLoading ? (
        <LoadingBox />
      ) : q.isError ? (
        <ErrorBox text={friendlyError(q.error, "las comisiones")} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <EmptyBox text="Este comercial aún no tiene comisiones." />
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Fecha</th>
                <th className="py-2.5 pr-4 font-medium">Cliente</th>
                <th className="py-2.5 pr-4 font-medium">Pedido</th>
                <th className="py-2.5 pr-4 font-medium">Tipo</th>
                <th className="py-2.5 pr-4 font-medium text-right">Base</th>
                <th className="py-2.5 pr-4 font-medium text-right">Comisión</th>
                <th className="py-2.5 pr-4 font-medium">Estado</th>
                <th className="py-2.5 pr-4 font-medium">Avisos</th>
                <th className="py-2.5 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 align-top">
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {formatDate(c.delivered_at || c.generated_at)}
                    {c.effective_status === "pending" && (
                      <p className="text-xs">cobrable {formatDate(c.available_at)}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-foreground">{c.client_name || "Cuenta borrada"}</p>
                    {c.client_email && <p className="text-xs text-muted-foreground">{c.client_email}</p>}
                  </td>
                  <td className="py-3 pr-4">
                    {c.request_id ? (
                      <Link href={`/admin/orders/${c.request_id}`} className="text-primary text-xs hover:underline">
                        Ver pedido
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Borrado</span>
                    )}
                    <p className="text-xs text-muted-foreground">{c.payment_method === "cash" ? "Efectivo" : c.payment_method === "card" ? "Tarjeta" : c.payment_method || ""}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                    {KIND_LABEL[c.kind] || c.kind} · {formatPct(c.pct)}
                  </td>
                  <td className="py-3 pr-4 text-right">{c.base == null ? "—" : formatEuro(c.base)}</td>
                  <td className="py-3 pr-4 text-right font-medium">{formatEuro(c.amount)}</td>
                  <td className="py-3 pr-4"><CommissionStatusBadge status={c.effective_status} /></td>
                  <td className="py-3 pr-4">
                    {(c.flags || []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {c.flags.map((f) => (
                          <span key={f} className="text-xs text-amber-800">{FLAG_LABEL[f] || f}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1.5">
                      {/* Las acciones salen del estado guardado, no del efectivo. */}
                      {c.status === "held" && (
                        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => act(c, "release")}>
                          Liberar
                        </Button>
                      )}
                      {(c.status === "pending" || c.status === "held") && (
                        <Button size="sm" variant="ghost" className="rounded-lg text-destructive" onClick={() => act(c, "reverse")}>
                          Anular
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmAction pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}
