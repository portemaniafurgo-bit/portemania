"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * Datos de facturación del cliente en la web, los mismos que pide la app.
 *
 * El servicio lo presta el conductor autónomo y la factura la emite él: sin
 * NIF, lo que se entrega es un recibo. Rellenarlo es opcional y se hace una
 * sola vez.
 */
export default function BillingCard({ userId }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("billing_name, billing_tax_id, billing_address, billing_city, billing_postal_code, billing_is_company")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) =>
        setForm({
          billing_name: data?.billing_name || "",
          billing_tax_id: data?.billing_tax_id || "",
          billing_address: data?.billing_address || "",
          billing_city: data?.billing_city || "Albacete",
          billing_postal_code: data?.billing_postal_code || "",
          billing_is_company: !!data?.billing_is_company,
        }),
      );
  }, [userId]);

  if (!form) return null;

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const guardar = async () => {
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("profiles")
      .update({
        ...form,
        // Sin espacios y en mayúsculas, que es como lo espera Hacienda.
        billing_tax_id: form.billing_tax_id.replace(/\s+/g, "").toUpperCase() || null,
        billing_name: form.billing_name.trim() || null,
        billing_address: form.billing_address.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    setMsg(error ? "No se pudieron guardar los datos." : "Datos guardados.");
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-foreground">Datos de facturación</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        El servicio lo presta el conductor, que es transportista autónomo: la factura la emite él
        con estos datos. Si no los rellenas, recibirás un recibo simple.
      </p>

      <div className="flex items-center justify-between">
        <Label className="text-sm">Facturar a nombre de una empresa</Label>
        <Switch
          checked={form.billing_is_company}
          onCheckedChange={v => update("billing_is_company", v)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{form.billing_is_company ? "Razón social" : "Nombre y apellidos"}</Label>
        <Input
          value={form.billing_name}
          onChange={e => update("billing_name", e.target.value)}
          placeholder={form.billing_is_company ? "Transportes Ejemplo S.L." : "María López García"}
          className="rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">{form.billing_is_company ? "CIF" : "NIF"}</Label>
          <Input
            value={form.billing_tax_id}
            onChange={e => update("billing_tax_id", e.target.value)}
            placeholder={form.billing_is_company ? "B02123456" : "02123456X"}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Código postal</Label>
          <Input
            value={form.billing_postal_code}
            onChange={e => update("billing_postal_code", e.target.value)}
            placeholder="02001"
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Dirección fiscal</Label>
        <Input
          value={form.billing_address}
          onChange={e => update("billing_address", e.target.value)}
          placeholder="Calle Tesifonte Gallego, 12, 3º B"
          className="rounded-xl"
        />
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <Button className="rounded-xl gap-2" onClick={guardar} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar datos de facturación
      </Button>
    </div>
  );
}
