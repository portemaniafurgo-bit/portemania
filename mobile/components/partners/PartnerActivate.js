import { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { Body, Button, Caption, ErrorText, Field } from "../ui";
import { Section } from "./ui";
import {
  activatePartner,
  formatEuro,
  formatPct,
  isValidSlug,
  partnerLinkLabel,
  reasonMessage,
  SITE_URL,
  slugify,
} from "../../lib/partners";
import { colors, spacing } from "../../theme";

/**
 * Quien todavía no es comercial: qué es el programa (con los porcentajes y
 * plazos vigentes, leídos de la base de datos) y el alta.
 * `program` son los ajustes ya saneados (fetchProgramSettings).
 */
export default function PartnerActivate({ program, defaultName, onActivated }) {
  const s = program;
  return (
    <View style={{ gap: spacing.lg }}>
      <Body>
        Recomienda ClicyVoy con tu enlace y gana una comisión por cada servicio de los clientes que
        traigas.
      </Body>

      <Rule icon="trending-up-outline" title={`${formatPct(s.first_pct)} del primer servicio`}>
        De cada cliente que traigas. Después, {formatPct(s.repeat_pct)} de cada servicio siguiente,
        para siempre. Las propinas no cuentan.
      </Rule>
      <Rule icon="time-outline" title={`Cobrable a los ${s.hold_days} días`}>
        Cada comisión se puede cobrar {s.hold_days} días después de que el servicio se haya
        entregado, siempre que esté pagado.
      </Rule>
      <Rule icon="cash-outline" title={`Cobro desde ${formatEuro(s.min_payout)}`}>
        Lo pides tú, como mucho una vez cada {s.payout_interval_days} días. Lo revisamos y te lo
        pagamos por transferencia.
      </Rule>
      <Rule icon="people-outline" title="Tu cartera">
        De cada cliente ves su nombre de pila, la fecha de alta y cuántos servicios ha hecho; de
        cada comisión, la fecha, el porcentaje y el importe. Nunca apellidos, contacto ni
        direcciones.
      </Rule>

      <ActivateForm defaultName={defaultName} onActivated={onActivated} />
    </View>
  );
}

function Rule({ icon, title, children }) {
  return <Section icon={icon} title={title}><Caption>{children}</Caption></Section>;
}

function ActivateForm({ defaultName, onActivated }) {
  const [name, setName] = useState(() => String(defaultName || "").slice(0, 60));
  const [slug, setSlug] = useState(() => slugify(defaultName));
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false); // guarda síncrona contra el doble toque

  const onName = value => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
    setError("");
  };

  const onSlug = value => {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
    setError("");
  };

  const submit = async () => {
    if (savingRef.current) return;
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      setError(reasonMessage("bad_name"));
      return;
    }
    if (!isValidSlug(slug)) {
      setError(reasonMessage("bad_slug"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await activatePartner(cleanName, slug);
      if (res.ok || res.reason === "already_partner") {
        onActivated?.();
        return;
      }
      setError(res.message);
    } catch {
      setError("No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Section title="Activa tu perfil de comercial" icon="person-add-outline">
      <Field
        label="Nombre público"
        value={name}
        maxLength={60}
        onChangeText={onName}
        placeholder="Ej.: Laura García"
      />
      <Caption>Quien abra tu enlace verá solo la primera palabra: «Te invita Laura».</Caption>
      <Field
        label="Nombre del enlace"
        value={slug}
        maxLength={30}
        onChangeText={onSlug}
        placeholder="laura-garcia"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Caption>
        Tu enlace será{" "}
        <Text style={{ color: colors.foreground, fontFamily: "DMSans_500Medium" }}>
          {partnerLinkLabel(slug)}
        </Text>
        . Minúsculas, números y guiones, con al menos 3 letras o números seguidos; no se puede
        cambiar después.
      </Caption>

      <ErrorText>{error}</ErrorText>

      <Caption>
        Al activarlo aceptas las condiciones del programa, en los{" "}
        <Text
          style={{ color: colors.primary, textDecorationLine: "underline" }}
          onPress={() => Linking.openURL(`${SITE_URL}/terminos#comerciales`).catch(() => {})}
        >
          términos y condiciones
        </Text>
        .
      </Caption>

      <Button title="Activar mi enlace" loading={saving} onPress={submit} />
    </Section>
  );
}
