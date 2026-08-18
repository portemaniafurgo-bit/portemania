import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "./supabase";
import { fetchTariffs } from "./tariffs";

/**
 * Factura del servicio en PDF, generada EN EL MÓVIL con expo-print: sin Edge
 * Function, sin coste y funciona offline.
 *
 * Quien presta el servicio es el CONDUCTOR, que es autónomo, así que la factura
 * la emite él: sus datos fiscales arriba y ClicyVoy como plataforma que pone en
 * contacto y gestiona el cobro. Si el conductor todavía no ha rellenado su NIF,
 * el documento sale rotulado como RECIBO — un papel con "factura" escrito pero
 * sin NIF del emisor no vale para nada y es peor que no darlo.
 *
 * El importe que se imprime es el que fijó el servidor, no se recalcula aquí.
 */
const esc = s =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const eur = n =>
  `${Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function documentHtml({ order, service, issuer, billing, vatRate, number }) {
  const date = order.delivery_time || order.created_date;
  const paid = order.payment_status === "paid";
  const total = Number(order.final_price || order.estimated_price || 0);
  // El precio que ve el cliente YA lleva IVA: se desglosa hacia atrás.
  const base = vatRate > 0 ? total / (1 + vatRate / 100) : total;
  const vat = total - base;
  const isInvoice = !!issuer?.tax_id;

  return `
  <html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #14141A; padding: 32px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7145d6; padding-bottom: 16px; }
    .brand { font-size: 24px; font-weight: 800; }
    .brand span { color: #F5B400; }
    .muted { color: #6C6C78; font-size: 12px; }
    .doc { text-align: right; font-size: 12px; color: #6C6C78; }
    .doc b { display: block; font-size: 15px; color: #14141A; margin: 2px 0; }
    .parties { display: flex; gap: 24px; margin-top: 24px; }
    .party { flex: 1; border: 1px solid #E7E5EC; border-radius: 12px; padding: 14px; }
    .party h4 { margin: 0 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #9A9AA6; }
    .party div { font-size: 13px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    td { padding: 10px 4px; border-bottom: 1px solid #EDEBF2; font-size: 13.5px; }
    td.r { text-align: right; }
    .total td { font-size: 17px; font-weight: 800; border-bottom: none; padding-top: 14px; }
    .total .amount { color: #7145d6; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700;
             background: ${paid ? "#ECFDF5" : "#FFFBEB"}; color: ${paid ? "#0B6E4F" : "#B27700"}; }
    .foot { margin-top: 32px; font-size: 11px; color: #6C6C78; line-height: 1.6; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">Clicy<span>Voy</span></div>
        <div class="muted">Portes y mudanzas · Albacete · clicyvoy.es</div>
      </div>
      <div class="doc">
        ${isInvoice ? "Factura" : "Recibo"}
        <b>${esc(number || String(order.id).slice(0, 8).toUpperCase())}</b>
        ${esc(format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es }))}
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h4>Emisor · quien ha prestado el servicio</h4>
        <div>
          <b>${esc(issuer?.fiscal_name || issuer?.full_name || order.driver_name || "Conductor")}</b><br/>
          ${issuer?.tax_id ? `NIF ${esc(issuer.tax_id)}<br/>` : ""}
          ${issuer?.fiscal_address ? `${esc(issuer.fiscal_address)}<br/>` : ""}
          <span class="muted">Transportista autónomo</span>
        </div>
      </div>
      <div class="party">
        <h4>Cliente</h4>
        <div>
          <b>${esc(billing?.billing_name || order.client_name || "")}</b><br/>
          ${billing?.billing_tax_id ? `NIF/CIF ${esc(billing.billing_tax_id)}<br/>` : ""}
          ${billing?.billing_address ? `${esc(billing.billing_address)}<br/>` : ""}
          ${billing?.billing_postal_code || billing?.billing_city
            ? `${esc([billing.billing_postal_code, billing.billing_city].filter(Boolean).join(" "))}`
            : ""}
        </div>
      </div>
    </div>

    <table>
      <tr>
        <td>
          <b>${esc(service?.label || order.service_type)}</b><br/>
          <span class="muted">${esc(order.origin_address || "")} → ${esc(order.destination_address || "")}</span>
        </td>
        <td class="r">${eur(base)}</td>
      </tr>
      <tr>
        <td class="muted">Base imponible</td>
        <td class="r">${eur(base)}</td>
      </tr>
      <tr>
        <td class="muted">IVA ${vatRate} %</td>
        <td class="r">${eur(vat)}</td>
      </tr>
      ${order.tip_amount
        ? `<tr><td class="muted">Propina (no sujeta a IVA)</td><td class="r">${eur(order.tip_amount)}</td></tr>`
        : ""}
      <tr class="total">
        <td>Total</td>
        <td class="r amount">${eur(total + Number(order.tip_amount || 0))}</td>
      </tr>
    </table>

    <p class="muted" style="margin-top:16px">
      Forma de pago: ${order.payment_method === "card" ? "tarjeta" : "efectivo"}
      · <span class="badge">${paid ? "PAGADO" : "PENDIENTE"}</span>
    </p>

    <div class="foot">
      ${isInvoice
        ? "Servicio prestado por el transportista autónomo indicado como emisor. ClicyVoy actúa como plataforma de intermediación y gestión del cobro."
        : "Documento informativo del servicio prestado a través de clicyvoy.es. Para recibir factura con todos los datos fiscales, pídesela al conductor o escríbenos."}
      <br/>Referencia del pedido: ${esc(String(order.id).slice(0, 8).toUpperCase())}
    </div>
  </body></html>`;
}

/**
 * Reúne lo que hace falta para el documento: datos fiscales del conductor, los
 * de facturación del cliente y el número correlativo (que se pide UNA vez y
 * queda guardado; volver a descargar la factura no la renumera).
 */
async function gatherInvoiceData(order) {
  const [{ data: issuer }, { data: billing }, tariffs] = await Promise.all([
    order.driver_id
      ? supabase
          .from("driver_profiles")
          .select("full_name, fiscal_name, tax_id, fiscal_address")
          .eq("created_by_id", order.driver_id)
          .order("created_date", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("billing_name, billing_tax_id, billing_address, billing_city, billing_postal_code")
      .eq("id", order.created_by_id)
      .maybeSingle(),
    fetchTariffs(),
  ]);

  let number = order.invoice_number || null;
  if (!number && order.status === "delivered" && issuer?.tax_id) {
    const { data } = await supabase.rpc("assign_invoice_number", { p_request_id: order.id });
    number = data || null;
  }

  return { issuer, billing, vatRate: Number(tariffs.vat_rate ?? 21), number };
}

/** Genera el PDF y abre el diálogo de compartir/guardar de Android. */
export async function downloadReceipt(order, service) {
  const extra = await gatherInvoiceData(order);
  const { uri } = await Print.printToFileAsync({
    html: documentHtml({ order, service, ...extra }),
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `ClicyVoy ${extra.number || String(order.id).slice(0, 8)}`,
    });
  }
  return uri;
}
