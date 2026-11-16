"use client";

import { useRef, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { reasonMessage, updatePayoutData } from "@/lib/partners";
import { Section } from "@/components/partners/ui";

/**
 * Titular e IBAN para cobrar. Guardados, el IBAN se enseña enmascarado (la
 * base de datos solo devuelve los 4 últimos dígitos).
 */
export default function PayoutDataCard({ payoutData, onSaved }) {
  const present = !!payoutData?.present;
  const [editing, setEditing] = useState(!present);

  return (
    <Section
      title="Datos de cobro"
      icon={Landmark}
      action={
        present && !editing ? (
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditing(true)}>
            Cambiar
          </Button>
        ) : null
      }
    >
      {present && !editing ? (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">
            Titular: <span className="font-medium text-foreground">{payoutData.holder}</span>
          </p>
          <p className="text-muted-foreground">
            IBAN: <span className="font-medium text-foreground font-mono">•••• •••• •••• {payoutData.iban_last4}</span>
          </p>
        </div>
      ) : (
        <PayoutForm
          defaultHolder={payoutData?.holder || ""}
          canCancel={present}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved?.();
          }}
        />
      )}
    </Section>
  );
}

function PayoutForm({ defaultHolder, canCancel, onCancel, onSaved }) {
  const [holder, setHolder] = useState(defaultHolder);
  const [iban, setIban] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false); // guarda síncrona contra doble clic

  const submit = async (e) => {
    e.preventDefault();
    const cleanIban = iban.replace(/\s/g, "").toUpperCase();
    if (holder.trim().length < 3) {
      setError(reasonMessage("bad_holder"));
      return;
    }
    const looksOk = cleanIban.startsWith("ES")
      ? /^ES[0-9]{22}$/.test(cleanIban)
      : /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleanIban);
    if (!looksOk) {
      setError(reasonMessage("bad_iban"));
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await updatePayoutData(holder.trim(), cleanIban);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast({ title: "Datos de cobro guardados" });
      onSaved();
    } catch {
      setError(reasonMessage("unknown"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="payout-holder">Titular de la cuenta</Label>
        <Input
          id="payout-holder"
          value={holder}
          maxLength={120}
          onChange={(e) => {
            setHolder(e.target.value);
            setError("");
          }}
          placeholder="Nombre y apellidos"
          className="rounded-xl"
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="payout-iban">IBAN</Label>
        <Input
          id="payout-iban"
          value={iban}
          maxLength={42}
          onChange={(e) => {
            setIban(e.target.value.toUpperCase());
            setError("");
          }}
          placeholder="ES00 0000 0000 0000 0000 0000"
          className="rounded-xl font-mono"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Solo lo usamos para pagarte por transferencia.
        </p>
      </div>

      {error && <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="flex gap-2">
        {canCancel && (
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" className="flex-1 rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
