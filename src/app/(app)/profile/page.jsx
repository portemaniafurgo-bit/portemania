"use client";

import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Phone, Mail, Save, Loader2, LogOut, Lock, CheckCircle2 } from "lucide-react";

const ROLE_LABELS = {
  client: "Cliente",
  driver: "Conductor",
  admin: "Administrador",
  staff: "Empleado",
};

export default function Profile() {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { ok, text }

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await base44.auth.updateMe({ phone });
      setSaveMsg({ ok: true, text: "Cambios guardados." });
    } catch (err) {
      setSaveMsg({ ok: false, text: "No se pudieron guardar los cambios: " + (err.message || "error de conexión") });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPassMsg(null);
    if (newPassword.length < 6) {
      setPassMsg({ ok: false, text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ ok: false, text: "Las contraseñas no coinciden." });
      return;
    }
    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setPassMsg({ ok: true, text: "Contraseña actualizada." });
    } catch (err) {
      setPassMsg({ ok: false, text: "No se pudo cambiar la contraseña: " + (err.message || "error de conexión") });
    } finally {
      setChangingPass(false);
    }
  };

  const Msg = ({ msg }) =>
    msg ? (
      <p className={`text-sm rounded-lg px-3 py-2 flex items-center gap-2 ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
        {msg.ok && <CheckCircle2 className="w-4 h-4" />}
        {msg.text}
      </p>
    ) : null;

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
          <p className="text-sm text-muted-foreground">{ROLE_LABELS[user?.role] || "Cliente"}</p>
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

        <Msg msg={saveMsg} />

        <Button className="rounded-xl gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </Button>
      </div>

      {/* Cambio de contraseña sin pasar por el email (el login de conductores
          lo promete; antes no existía en ninguna página) */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" /> Cambiar contraseña
        </h3>
        <div className="space-y-2">
          <Label>Nueva contraseña</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Repite la contraseña</Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl"
          />
        </div>
        <Msg msg={passMsg} />
        <Button
          variant="outline"
          className="rounded-xl gap-2"
          onClick={handleChangePassword}
          disabled={changingPass || !newPassword}
        >
          {changingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          Cambiar contraseña
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
