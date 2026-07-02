"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { User, Phone, Mail, Save, Loader2, LogOut } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe({ phone });
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Mi perfil</h1>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="text-2xl font-bold text-primary">
            {user?.full_name?.[0]?.toUpperCase() || "U"}
          </span>
        </div>
        <div>
          <p className="font-heading font-semibold text-lg text-foreground">{user?.full_name}</p>
          <p className="text-sm text-muted-foreground capitalize">{user?.role || "cliente"}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" /> Email
          </Label>
          <Input value={user?.email || ""} disabled className="rounded-xl bg-muted" />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" /> Teléfono
          </Label>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="rounded-xl"
          />
        </div>

        <Button className="rounded-xl gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </Button>
      </div>

      <Button
        variant="outline"
        className="w-full rounded-xl gap-2 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={() => base44.auth.logout("/")}
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}
