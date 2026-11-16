"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Handshake, Loader2, Percent, Clock, Banknote, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activatePartner,
  fetchProgramSettings,
  formatEuro,
  formatPct,
  partnerLinkLabel,
  reasonMessage,
  slugify,
  isValidSlug,
} from "@/lib/partners";
import { LoadingBox, ErrorBox, Section } from "@/components/partners/ui";

/**
 * Quien todavía no es comercial: qué es el programa (con los porcentajes
 * vigentes de app_settings) y el alta.
 */
export default function PartnerActivate({ defaultName, onActivated }) {
  const program = useQuery({
    queryKey: ["partner-program"],
    queryFn: fetchProgramSettings,
  });

  if (program.isLoading) return <LoadingBox />;
  if (program.isError) {
    return <ErrorBox text="No se ha podido cargar el programa." onRetry={program.refetch} />;
  }

  const s = program.data;
  // s ya viene saneado como en el servidor (sin "enabled" = encendido).
  if (!s || s.enabled !== true) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-muted rounded-2xl p-5 text-sm text-muted-foreground">
          El programa de comerciales no está disponible ahora mismo. Vuelve a mirarlo más adelante.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid sm:grid-cols-2 gap-4">
        <Rule icon={Percent} title={`${formatPct(s.first_pct)} del primer servicio`}>
          De cada cliente que traigas. Después, {formatPct(s.repeat_pct)} de cada servicio
          siguiente, para siempre. Las propinas no cuentan.
        </Rule>
        <Rule icon={Clock} title={`Cobrable a los ${s.hold_days} días`}>
          Cada comisión se puede cobrar {s.hold_days} días después de que el servicio se haya
          entregado, siempre que esté pagado.
        </Rule>
        <Rule icon={Banknote} title={`Cobro desde ${formatEuro(s.min_payout)}`}>
          Lo pides tú, como mucho una vez cada {s.payout_interval_days} días. Lo revisamos y te lo
          pagamos por transferencia.
        </Rule>
        <Rule icon={Users} title="Tu cartera">
          De cada cliente ves su nombre de pila, la fecha de alta y cuántos servicios ha hecho; de cada comisión, la fecha, el porcentaje y el importe (con los que se puede deducir el precio de ese servicio). Nunca apellidos, contacto ni direcciones.
        </Rule>
      </div>

      <ActivateForm defaultName={defaultName} onActivated={onActivated} />
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
        <Handshake className="w-6 h-6 text-primary" /> Gana con ClicyVoy
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Recomienda ClicyVoy con tu enlace y gana una comisión por cada servicio de los clientes que
        traigas.
      </p>
    </div>
  );
}

function Rule({ icon: Icon, title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex gap-3">
      <div className="p-2 rounded-xl bg-primary/10 h-fit">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{children}</p>
      </div>
    </div>
  );
}

function ActivateForm({ defaultName, onActivated }) {
  const [name, setName] = useState(() => String(defaultName || "").slice(0, 60));
  const [slug, setSlug] = useState(() => slugify(defaultName));
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false); // guarda síncrona contra doble clic

  const onName = (value) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
    setError("");
  };

  const onSlug = (value) => {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      setError(reasonMessage("bad_name"));
      return;
    }
    if (!isValidSlug(slug)) {
      setError(reasonMessage("bad_slug"));
      return;
    }
    if (savingRef.current) return;
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
      setError(reasonMessage("unknown"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Section title="Activa tu perfil de comercial" icon={Handshake}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="partner-name">Nombre público</Label>
          <Input
            id="partner-name"
            value={name}
            maxLength={60}
            onChange={(e) => onName(e.target.value)}
            placeholder="Ej.: Laura García"
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Quien abra tu enlace verá solo la primera palabra: «Te invita Laura».
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="partner-slug">Nombre del enlace</Label>
          <Input
            id="partner-slug"
            value={slug}
            maxLength={30}
            onChange={(e) => onSlug(e.target.value)}
            placeholder="laura-garcia"
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Tu enlace será{" "}
            <span className="font-medium text-foreground break-all">{partnerLinkLabel(slug)}</span>
            . Minúsculas, números y guiones, con al menos 3 letras o números seguidos; no se puede cambiar después.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <p className="text-xs text-muted-foreground">
          Al activarlo aceptas las condiciones del programa, en los{" "}
          <Link href="/terminos#comerciales" className="text-primary underline" target="_blank">
            términos y condiciones
          </Link>
          .
        </p>

        <Button type="submit" className="w-full h-11 rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activar mi enlace"}
        </Button>
      </form>
    </Section>
  );
}
