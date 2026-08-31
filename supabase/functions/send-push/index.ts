// Edge Function: send-push
//
// Espejo de `send-email` para notificaciones push (Expo Push Service, que usa
// FCM por debajo en Android). Alimenta la app móvil; el email se conserva como
// respaldo.
//
// PRINCIPIO DE SEGURIDAD: el llamante NO elige destinatarios ni texto. Solo
// manda un `mode` y el id del pedido; el servidor resuelve a quién avisar y qué
// decirle. Además, cada modo comprueba que el estado real del pedido justifique
// el aviso, así que lo máximo que se puede provocar es reenviar una
// notificación que ya era cierta. No hay forma de empujar texto arbitrario a un
// móvil ajeno.
//
// A diferencia de `send-email`, esta función se despliega con verify_jwt=TRUE:
// todos sus llamantes son usuarios con sesión desde la app. `send-email` tiene
// que ser pública porque la solicitud de invitado en la web no tiene JWT; aquí
// no hace falta abrir esa puerta. Si algún día el flujo de invitado necesita
// push, habrá que replantearlo, no simplemente desactivar la verificación.
//
// Ver docs/PLAN-ACCION-APP-ANDROID.md (T0.2) y la matriz de notificaciones en
// docs/FUNCIONALIDADES-APP-ANDROID.md §6.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Canales de Android: la app los crea con estos ids. "ofertas" lleva sonido
// propio porque al conductor le tiene que entrar por encima del ruido.
const CHANNEL_OFFERS = "ofertas";
const CHANNEL_STATUS = "estado";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

type Admin = ReturnType<typeof serviceClient>;

/** Tokens de los usuarios indicados. Sin service role no se leerían: la RLS de
 *  push_tokens solo deja ver los propios. */
async function tokensFor(admin: Admin, userIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return [];
  const { data } = await admin.from("push_tokens").select("token").in("user_id", ids);
  return (data || []).map((r: { token: string }) => r.token);
}

/** Envía en lotes de 100 (límite de Expo) y limpia los tokens muertos. */
async function push(
  admin: Admin,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId: string,
) {
  if (!tokens.length) return { sent: 0, total: 0 };

  let sent = 0;
  const dead: string[] = [];

  for (let i = 0; i < tokens.length; i += 100) {
    const batch = tokens.slice(i, i + 100);
    const messages = batch.map((to) => ({ to, title, body, data, channelId, sound: "default" }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json().catch(() => ({}));
    const tickets = Array.isArray(result?.data) ? result.data : [];

    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, idx: number) => {
      if (ticket?.status === "ok") sent++;
      // El móvil desinstaló la app o revocó el permiso: el token ya no sirve
      // y Expo penaliza a quien insiste con tokens muertos.
      else if (ticket?.details?.error === "DeviceNotRegistered") dead.push(batch[idx]);
    });
  }

  if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
  return { sent, total: tokens.length };
}

/** Id de usuario del cliente del pedido. Los pedidos de invitado no tienen
 *  cuenta, así que no reciben push (les llega el email de siempre). */
function clientUserId(order: { created_by_id?: string | null }) {
  return order.created_by_id ? [order.created_by_id] : [];
}

/** Clave de servicio moderna del pedido (los antiguos usaban transport/package). */
function serviceKeyOf(order: { service_type?: string | null; vehicle_type?: string | null }) {
  const raw = order.service_type || "";
  if (["porte", "mini_mudanza", "porte_tienda", "paquete"].includes(raw)) return raw;
  if (raw === "transport") return order.vehicle_type === "large" ? "mini_mudanza" : "porte";
  if (raw === "package") return "paquete";
  return "porte";
}

/** «lunes 2 de septiembre a las 17:30», en hora peninsular. */
function spanishWhen(iso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { mode?: string; order_id?: string; message_id?: string; offer_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const mode = body.mode;
  if (!mode) return json({ error: "mode es obligatorio" }, 400);

  const admin = serviceClient();

  // ---------- Documentación a punto de caducar → conductor ----------
  // Único aviso que NO va ligado a un pedido: lo dispara el job diario. Sin él,
  // el conductor se enteraba de que había caducado el seguro cuando dejaban de
  // entrarle ofertas, sin saber por qué.
  if (mode === "docs_expiring") {
    const DOCS: Array<[string, string]> = [
      ["license_expires_at", "el carnet de conducir"],
      ["id_document_expires_at", "el DNI/NIE"],
      ["insurance_expires_at", "el seguro del vehículo"],
      ["autonomo_receipt_expires_at", "el recibo de autónomo"],
      ["censal_document_expires_at", "la situación censal"],
    ];

    const { data: drivers } = await admin
      .from("driver_profiles")
      .select(
        "email, license_expires_at, id_document_expires_at, insurance_expires_at, autonomo_receipt_expires_at, censal_document_expires_at",
      )
      .eq("status", "verified");

    const today = new Date();
    let sent = 0;
    for (const driver of drivers || []) {
      const avisos: string[] = [];
      for (const [field, label] of DOCS) {
        const value = (driver as Record<string, string | null>)[field];
        if (!value) continue;
        const days = Math.floor((new Date(value).getTime() - today.getTime()) / 86_400_000);
        // Se avisa a 15, 7, 3 y 1 día, y el día que caduca. Ni cada día (se
        // vuelve ruido y se ignora) ni una sola vez (se olvida).
        if ([15, 7, 3, 1, 0].includes(days)) avisos.push(`${label} caduca ${days === 0 ? "hoy" : `en ${days} día${days === 1 ? "" : "s"}`}`);
        else if (days < 0) avisos.push(`${label} está CADUCADO`);
      }
      if (!avisos.length || !driver.email) continue;

      const { data: profs } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", driver.email)
        .limit(1);
      const tokens = await tokensFor(admin, (profs || []).map((p: { id: string }) => p.id));
      const result = await push(
        admin,
        tokens,
        "Revisa tu documentación",
        `${avisos[0][0].toUpperCase()}${avisos[0].slice(1)}. Súbela renovada para seguir recibiendo ofertas.`,
        { mode: "docs_expiring" },
        CHANNEL_STATUS,
      );
      sent += result.sent;
    }
    return json({ sent });
  }

  if (!body.order_id) return json({ error: "order_id es obligatorio" }, 400);
  const { data: order } = await admin
    .from("transport_requests")
    .select(
      "id, status, created_by_id, driver_id, client_name, service_type, vehicle_type, origin_address, destination_address, estimated_price, proposed_price, agreed_start_at",
    )
    .eq("id", body.order_id)
    .single();
  if (!order) return json({ error: "Pedido no encontrado" }, 404);

  const data = { order_id: order.id, mode };

  switch (mode) {
    // ---------- Pedido publicado → conductores verificados compatibles ----------
    case "new_request": {
      // Solo si sigue pendiente: un pedido ya aceptado no debe volver a sonar.
      if (order.status !== "pending") return json({ sent: 0, skipped: "el pedido ya no está pendiente" });

      const { data: drivers } = await admin
        .from("driver_profiles")
        .select("email, vehicle_type, is_available, service_keys")
        .eq("status", "verified");

      // Misma regla de reparto que send-email: los pedidos de furgón grande solo
      // a conductores con furgón grande. Y solo a quien está disponible: la app
      // añade ese matiz que el email no tiene. Además, si el conductor filtró
      // qué servicios quiere (service_keys), se respeta.
      const orderService = serviceKeyOf(order);
      const emails = (drivers || [])
        .filter((d: { email?: string; vehicle_type?: string; is_available?: boolean; service_keys?: string[] | null }) =>
          d.email &&
          d.is_available !== false &&
          (order.vehicle_type !== "large" || d.vehicle_type === "large") &&
          (!Array.isArray(d.service_keys) || d.service_keys.length === 0 || d.service_keys.includes(orderService))
        )
        .map((d: { email: string }) => d.email.toLowerCase());
      if (!emails.length) return json({ sent: 0, total: 0 });

      // El id de usuario se resuelve por email (driver_profiles.created_by_id no
      // es de fiar: los perfiles dados de alta por el admin llevaron su id).
      const { data: profs } = await admin.from("profiles").select("id").in("email", emails);
      const tokens = await tokensFor(admin, (profs || []).map((p: { id: string }) => p.id));

      const size = order.vehicle_type === "large" ? "furgoneta grande" : "furgoneta pequeña";
      return json(
        await push(
          admin,
          tokens,
          "🚚 Nuevo pedido disponible",
          `${order.origin_address || "Recogida"} → ${order.destination_address || "entrega"} · ${size}`,
          data,
          CHANNEL_OFFERS,
        ),
      );
    }

    // ---------- Conductor asignado → cliente (y confirmación al conductor) ----------
    case "driver_assigned": {
      if (!order.driver_id) return json({ sent: 0, skipped: "el pedido no tiene conductor" });

      const { data: driver } = await admin
        .from("driver_profiles")
        .select("full_name")
        .eq("created_by_id", order.driver_id)
        .limit(1)
        .maybeSingle();

      const toClient = await push(
        admin,
        await tokensFor(admin, clientUserId(order)),
        "Conductor asignado",
        `${driver?.full_name || "Tu conductor"} va de camino a la recogida.`,
        data,
        CHANNEL_STATUS,
      );
      const toDriver = await push(
        admin,
        await tokensFor(admin, [order.driver_id]),
        "Servicio aceptado",
        `Recogida en ${order.origin_address || "la dirección indicada"}.`,
        data,
        CHANNEL_STATUS,
      );
      return json({ sent: toClient.sent + toDriver.sent, total: toClient.total + toDriver.total });
    }

    // ---------- El conductor fija la fecha real del servicio → cliente ----------
    case "service_scheduled": {
      // La fecha se lee del pedido, no del llamante: si no hay, no hay aviso.
      if (!order.agreed_start_at) return json({ sent: 0, skipped: "sin fecha acordada" });
      const tokens = await tokensFor(admin, clientUserId(order));
      return json(
        await push(
          admin,
          tokens,
          "Tu servicio ya tiene fecha",
          `El conductor lo hará el ${spanishWhen(order.agreed_start_at)} (hora aproximada).`,
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- El servicio acordado está al caer → cliente Y conductor ----------
    // Lo dispara el cron remind-upcoming-services (migración 0025).
    case "service_reminder": {
      if (!order.agreed_start_at || order.status !== "accepted") {
        return json({ sent: 0, skipped: "sin fecha o ya en marcha" });
      }
      const hora = new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(order.agreed_start_at));

      const toClient = await push(
        admin,
        await tokensFor(admin, clientUserId(order)),
        "Tu servicio es en breve",
        `El conductor llegará sobre las ${hora}. Ten la carga a punto.`,
        data,
        CHANNEL_STATUS,
      );
      const toDriver = await push(
        admin,
        await tokensFor(admin, order.driver_id ? [order.driver_id] : []),
        "Servicio a las " + hora,
        `Recogida en ${order.origin_address || "la dirección indicada"}. Ve saliendo.`,
        data,
        CHANNEL_STATUS,
      );
      return json({ sent: toClient.sent + toDriver.sent, total: toClient.total + toDriver.total });
    }

    // ---------- Conductor llegando (<100 m) → cliente ----------
    case "driver_arriving": {
      const tokens = await tokensFor(admin, clientUserId(order));
      return json(
        await push(
          admin,
          tokens,
          "Tu conductor está llegando",
          "Está a menos de 100 metros. Prepara la carga.",
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Cambio de estado → cliente ----------
    case "status_changed": {
      const texts: Record<string, [string, string]> = {
        in_transit: ["Conductor en camino", "Ya va hacia el punto de recogida."],
        picked_up: ["Carga recogida", "Tu envío va camino de la entrega."],
        delivered: ["Servicio completado", "¿Nos dejas tu valoración?"],
      };
      const t = texts[order.status];
      // El estado lo lee el servidor del pedido, no lo dice el llamante: si no
      // corresponde a un aviso, no se manda nada.
      if (!t) return json({ sent: 0, skipped: `estado ${order.status} sin aviso` });

      const tokens = await tokensFor(admin, clientUserId(order));
      return json(await push(admin, tokens, t[0], t[1], data, CHANNEL_STATUS));
    }

    // ---------- Mensaje de chat → la otra parte ----------
    case "chat_message": {
      if (!body.message_id) return json({ error: "message_id requerido" }, 400);
      const { data: msg } = await admin
        .from("chat_messages")
        .select("id, request_id, sender_id, sender_name, message")
        .eq("id", body.message_id)
        .single();
      // El mensaje tiene que ser real y de este pedido: así el texto que llega
      // al móvil es el que de verdad está en la BD.
      if (!msg || msg.request_id !== order.id) return json({ error: "Mensaje no encontrado" }, 404);

      const targets = [order.created_by_id, order.driver_id].filter(
        (uid) => uid && uid !== msg.sender_id,
      ) as string[];
      const tokens = await tokensFor(admin, targets);
      return json(
        await push(
          admin,
          tokens,
          msg.sender_name || "Mensaje nuevo",
          String(msg.message || "").slice(0, 140),
          { ...data, message_id: msg.id },
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Negociación: contraoferta nueva → cliente ----------
    case "price_offer": {
      if (!body.offer_id) return json({ error: "offer_id requerido" }, 400);
      // La contraoferta tiene que existir, ser de ESTE pedido y estar viva:
      // así el importe que llega al móvil es el que hay en la BD.
      const { data: offer } = await admin
        .from("price_offers")
        .select("id, request_id, driver_name, amount, status")
        .eq("id", body.offer_id)
        .single();
      if (!offer || offer.request_id !== order.id) return json({ error: "Contraoferta no encontrada" }, 404);
      if (offer.status !== "pending") return json({ sent: 0, skipped: "la contraoferta ya no está viva" });

      const tokens = await tokensFor(admin, clientUserId(order));
      return json(
        await push(
          admin,
          tokens,
          "Tienes una contraoferta",
          `${offer.driver_name || "Un conductor"} te propone ${Number(offer.amount).toFixed(2)} €.`,
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Negociación: el cliente aceptó → conductor ----------
    case "offer_accepted": {
      // El estado real manda: solo se avisa si el pedido quedó aceptado con
      // conductor y precio pactado.
      if (order.status !== "accepted" || !order.driver_id) {
        return json({ sent: 0, skipped: "el pedido no está aceptado" });
      }
      const tokens = await tokensFor(admin, [order.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          "¡Trato hecho!",
          `El cliente aceptó tu precio. Recogida en ${order.origin_address || "la dirección indicada"}.`,
          data,
          CHANNEL_OFFERS,
        ),
      );
    }

    // ---------- Conductor cancela → cliente ----------
    case "driver_cancelled": {
      const tokens = await tokensFor(admin, clientUserId(order));
      return json(
        await push(
          admin,
          tokens,
          "Buscando otro conductor",
          "El conductor asignado ha cancelado. Ya estamos buscando sustituto.",
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- El CLIENTE cancela → conductor asignado ----------
    // Sin esto, un conductor podía conducir hasta una recogida cancelada.
    case "client_cancelled": {
      if (!order.driver_id) return json({ sent: 0, skipped: "el pedido no tenía conductor" });
      const tokens = await tokensFor(admin, [order.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          "Servicio cancelado por el cliente",
          `Ya no hace falta ir a ${order.origin_address || "la recogida"}.`,
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Negociación: el cliente descarta una contraoferta → ese conductor ----------
    case "offer_rejected": {
      if (!body.offer_id) return json({ error: "offer_id requerido" }, 400);
      const { data: offer } = await admin
        .from("price_offers")
        .select("id, request_id, driver_id, amount, status")
        .eq("id", body.offer_id)
        .single();
      if (!offer || offer.request_id !== order.id) return json({ error: "Contraoferta no encontrada" }, 404);

      const tokens = await tokensFor(admin, [offer.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          "Contraoferta descartada",
          // Sin dramatismo y con salida: el pedido puede seguir vivo.
          order.status === "pending"
            ? `El cliente no aceptó tus ${Number(offer.amount).toFixed(2)} €. Puedes proponer otro precio.`
            : "El cliente ya ha cerrado el servicio con otro conductor.",
          data,
          CHANNEL_OFFERS,
        ),
      );
    }

    // ---------- El cliente sube su oferta → conductores interesados ----------
    // Los que ya contraofertaron (o los que están mirando) tienen que saber
    // que el precio ha mejorado: si no, la subida no sirve de nada.
    case "offer_raised": {
      if (order.status !== "pending" || order.proposed_price == null) {
        return json({ sent: 0, skipped: "el pedido ya no admite ofertas" });
      }

      const { data: offers } = await admin
        .from("price_offers")
        .select("driver_id")
        .eq("request_id", order.id)
        .in("status", ["pending", "superseded", "rejected"]);

      const driverIds = [...new Set((offers || []).map((o: { driver_id: string }) => o.driver_id))];
      if (!driverIds.length) return json({ sent: 0, total: 0 });

      const tokens = await tokensFor(admin, driverIds);
      return json(
        await push(
          admin,
          tokens,
          "El cliente ha subido su oferta",
          `Ahora ofrece ${Number(order.proposed_price).toFixed(2)} € por ${order.origin_address || "la recogida"}.`,
          data,
          CHANNEL_OFFERS,
        ),
      );
    }

    // ---------- Propina cobrada → conductor ----------
    case "tip_received": {
      if (!order.driver_id) return json({ sent: 0, skipped: "el pedido no tiene conductor" });
      // El importe se lee de la BD, no del llamante: es dinero.
      const { data: paid } = await admin
        .from("transport_requests")
        .select("tip_amount, client_name")
        .eq("id", order.id)
        .single();
      if (!paid?.tip_amount) return json({ sent: 0, skipped: "sin propina anotada" });

      const tokens = await tokensFor(admin, [order.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          "¡Te han dejado propina!",
          `${paid.client_name || "El cliente"} te ha dejado ${Number(paid.tip_amount).toFixed(2)} €, íntegros para ti.`,
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Valoración del cliente → conductor ----------
    case "rating_received": {
      if (!order.driver_id) return json({ sent: 0, skipped: "el pedido no tiene conductor" });
      const { data: rated } = await admin
        .from("transport_requests")
        .select("client_rating, client_review")
        .eq("id", order.id)
        .single();
      if (!rated?.client_rating) return json({ sent: 0, skipped: "sin valoración" });

      const stars = "★".repeat(rated.client_rating);
      const tokens = await tokensFor(admin, [order.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          `Nueva valoración: ${stars}`,
          rated.client_review
            ? String(rated.client_review).slice(0, 140)
            : "El cliente ha valorado tu servicio.",
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    // ---------- Pago con tarjeta confirmado → conductor ----------
    case "payment_received": {
      if (!order.driver_id) return json({ sent: 0, skipped: "el pedido no tiene conductor" });
      const { data: paid } = await admin
        .from("transport_requests")
        .select("payment_status, final_price, estimated_price")
        .eq("id", order.id)
        .single();
      if (paid?.payment_status !== "paid") return json({ sent: 0, skipped: "el pago no está confirmado" });

      const amount = Number(paid.final_price ?? paid.estimated_price ?? 0).toFixed(2);
      const tokens = await tokensFor(admin, [order.driver_id]);
      return json(
        await push(
          admin,
          tokens,
          "Servicio cobrado",
          `El cliente ha pagado ${amount} € con tarjeta: no cobres en efectivo.`,
          data,
          CHANNEL_STATUS,
        ),
      );
    }

    default:
      return json({ error: `mode desconocido: ${mode}` }, 400);
  }
});
