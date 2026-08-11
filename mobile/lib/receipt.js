import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Recibo del pedido en PDF, generado EN EL MÓVIL con expo-print: sin Edge
 * Function, sin coste y funciona offline. El importe que se imprime es el que
 * fijó el servidor al crear el pedido, no se recalcula aquí.
 */
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function receiptHtml(order, service) {
  const date = order.delivery_time || order.created_date;
  const paid = order.payment_status === "paid";
  return `
  <html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #1a1b20; padding: 32px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #7145d6; padding-bottom: 16px; }
    .brand { font-size: 26px; font-weight: 800; }
    .brand span { color: #F5B400; }
    .muted { color: #64748B; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    td { padding: 10px 4px; border-bottom: 1px solid #E5E7EB; font-size: 14px; }
    .total td { font-size: 18px; font-weight: 800; border-bottom: none; }
    .total .amount { color: #7145d6; text-align: right; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;
             background: ${paid ? "#ECFDF5" : "#FFFBEB"}; color: ${paid ? "#059669" : "#B45309"}; }
    .foot { margin-top: 40px; font-size: 12px; color: #64748B; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">Clicy<span>Voy</span></div>
        <div class="muted">Portes y mudanzas · Albacete · clicyvoy.es</div>
      </div>
      <div class="muted" style="text-align:right">
        Recibo del pedido<br/><b>${esc(String(order.id).slice(0, 8).toUpperCase())}</b><br/>
        ${esc(format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es }))}
      </div>
    </div>

    <table>
      <tr><td class="muted">Servicio</td><td>${esc(service?.label || order.service_type)}</td></tr>
      <tr><td class="muted">Cliente</td><td>${esc(order.client_name || "")}</td></tr>
      <tr><td class="muted">Recogida</td><td>${esc(order.origin_address || "")}</td></tr>
      <tr><td class="muted">Entrega</td><td>${esc(order.destination_address || "")}</td></tr>
      <tr><td class="muted">Pago</td><td>${order.payment_method === "card" ? "Tarjeta" : "Efectivo"} · <span class="badge">${paid ? "PAGADO" : "PENDIENTE"}</span></td></tr>
      ${order.tip_amount ? `<tr><td class="muted">Propina al conductor</td><td>${esc(order.tip_amount)} €</td></tr>` : ""}
      <tr class="total"><td>Total del servicio</td><td class="amount">${esc(order.final_price || order.estimated_price || 0)} €</td></tr>
    </table>

    <div class="foot">
      Documento informativo del servicio prestado a través de clicyvoy.es.<br/>
      ¿Dudas con este pedido? Escríbenos indicando la referencia ${esc(String(order.id).slice(0, 8).toUpperCase())}.
    </div>
  </body></html>`;
}

/** Genera el PDF y abre el diálogo de compartir/guardar de Android. */
export async function downloadReceipt(order, service) {
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(order, service) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Recibo ClicyVoy ${String(order.id).slice(0, 8)}`,
    });
  }
  return uri;
}
