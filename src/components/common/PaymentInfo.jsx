import { CreditCard, Banknote, CheckCircle2 } from "lucide-react";

// Resuelve, para el CONDUCTOR, qué tiene que hacer con el cobro de un pedido:
//  - efectivo            -> debe cobrar el importe al cliente
//  - tarjeta + pagado    -> ya está pagado online, no cobra nada
//  - tarjeta + pendiente -> lo paga online, no cobra en efectivo
export function paymentInfo(order) {
  const isCard = order?.payment_method === "card";
  const isPaid = order?.payment_status === "paid";
  const amount = Number(order?.final_price ?? order?.estimated_price ?? 0);

  if (!isCard) {
    return {
      collect: true,
      icon: Banknote,
      title: "Cobra en efectivo",
      detail: `Cobra ${amount.toFixed(2)}€ al cliente al finalizar`,
      pillLabel: "Efectivo",
      banner: "bg-amber-50 border-amber-300 text-amber-900",
      iconWrap: "bg-amber-500 text-white",
      pill: "bg-amber-100 text-amber-800 border-amber-300",
    };
  }
  if (isPaid) {
    return {
      collect: false,
      icon: CheckCircle2,
      title: "Pagado con tarjeta",
      detail: "Ya está pagado online — no cobres nada",
      pillLabel: "Tarjeta · pagado",
      banner: "bg-emerald-50 border-emerald-300 text-emerald-900",
      iconWrap: "bg-emerald-500 text-white",
      pill: "bg-emerald-100 text-emerald-700 border-emerald-300",
    };
  }
  return {
    collect: false,
    icon: CreditCard,
    title: "Pago con tarjeta (pendiente)",
    detail: "El cliente lo paga online — no cobres en efectivo",
    pillLabel: "Tarjeta · pendiente",
    banner: "bg-slate-50 border-slate-300 text-slate-700",
    iconWrap: "bg-slate-500 text-white",
    pill: "bg-slate-100 text-slate-700 border-slate-300",
  };
}

// variant="banner" (detalle del trabajo, prominente) | "compact" (píldora para listas)
export default function PaymentInfo({ order, variant = "banner" }) {
  const info = paymentInfo(order);
  const Icon = info.icon;

  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${info.pill}`}>
        <Icon className="w-3.5 h-3.5" />
        {info.pillLabel}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${info.banner}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${info.iconWrap}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <p className="font-display font-bold leading-tight">{info.title}</p>
        <p className="text-sm opacity-90">{info.detail}</p>
      </div>
    </div>
  );
}
