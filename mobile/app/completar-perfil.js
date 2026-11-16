import { useRef, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  claimAndSettle,
  claimReferral,
  clearPendingReferral,
  parseInviteCode,
  reasonMessage,
  isStaffRole,
  savePendingReferral,
  useProgramEnabled,
  useProgramPublic,
} from "../lib/partners";
import { Button, Caption, ErrorText, Field, Heading, Screen } from "../components/ui";
import { spacing } from "../theme";

const CODE_NOT_FOUND = "No encontramos ese código. Revísalo o pulsa otra vez para seguir sin él.";
// Rechazos definitivos que se explican una vez (con «pulsa otra vez»).
const WARN_REASONS = new Set(["not_new", "has_orders", "already_referred", "own_link", "disabled"]);

/**
 * Lo que Google no trae: el teléfono (y el nombre, si la cuenta no lo tenía).
 *
 * Se pide UNA vez, justo después del primer acceso. Sin teléfono el conductor
 * no puede llamar al cliente ni el cliente al conductor, y eso en un porte no
 * es un extra: es cómo se resuelven los «no encuentro el portal».
 *
 * Opcional: el código de invitación de un comercial (ClicyVoy Partners), solo
 * si el programa está instalado, encendido y abierto al público (o, mientras
 * es privado, para el personal). Se envía ANTES de guardar el
 * teléfono: en cuanto el teléfono se guarda, el guardia de `_layout.js` saca a
 * la persona de esta pantalla y ya no se podría avisar de un código que no
 * existe o no vale. El aviso no bloquea: un segundo toque sigue sin el código.
 * Sin red (o sin respuesta en 8 s) el código se guarda, se reintenta una vez
 * más al guardar el perfil y, si tampoco, al abrir la app.
 */
export default function CompletarPerfil() {
  const router = useRouter();
  const { user, isDriver, role } = useAuth();
  // El campo del código solo sale con el programa instalado y encendido, y
  // además abierto a todo el mundo; en el lanzamiento privado, solo al
  // personal (admin/staff), que es quien prueba la atribución.
  const programEnabled = useProgramEnabled();
  const programPublic = useProgramPublic();
  const showInvite = programEnabled && (programPublic || isStaffRole(role, user?.email));
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState("");
  const [inviteText, setInviteText] = useState("");
  const [inviteHint, setInviteHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Guarda síncrona contra el doble toque (el estado tarda un render).
  const savingRef = useRef(false);
  // Texto del código ya avisado como «no encontrado»: el siguiente toque con
  // ese mismo texto sigue sin él.
  const warnedRef = useRef(null);
  // Código ya resuelto (aceptado, rechazado o guardado para reintentar): si el
  // guardado del perfil falla, el reintento no lo vuelve a enviar.
  const settledCodeRef = useRef(null);
  // Código que se quedó sin respuesta (sin red / 8 s): se vuelve a enviar una
  // vez más, sin esperar, en cuanto el perfil se ha guardado.
  const retryCodeRef = useRef(null);

  /** Avisa una vez; el siguiente toque con el mismo texto sigue sin el código. */
  const warnOnce = (text, message) => {
    warnedRef.current = text;
    setInviteHint(message);
    return false;
  };

  /** Envía el código si lo hay. true = seguir guardando; false = parar y avisar. */
  const handleInvite = async () => {
    const text = inviteText.trim();
    if (!showInvite || !text) return true;
    if (warnedRef.current === text) return true;
    const code = parseInviteCode(text);
    if (!code) return warnOnce(text, CODE_NOT_FOUND);
    if (settledCodeRef.current === code) return true;
    const { result, reason } = await claimReferral(code);
    if (result === "retry") {
      await savePendingReferral(user?.id, code);
      settledCodeRef.current = code;
      retryCodeRef.current = code;
      return true;
    }
    retryCodeRef.current = null;
    await clearPendingReferral(user?.id);
    settledCodeRef.current = code;
    if (reason === "unknown_code") {
      // Otro código distinto sí se enviará: este no se da por resuelto.
      settledCodeRef.current = null;
      return warnOnce(text, CODE_NOT_FOUND);
    }
    if (WARN_REASONS.has(reason)) {
      return warnOnce(text, `${reasonMessage(reason)} Pulsa otra vez para continuar.`);
    }
    return true;
  };

  const save = async () => {
    if (savingRef.current) return;
    const cleanPhone = phone.replace(/\s+/g, "");
    if (!fullName.trim()) {
      setError("Dinos tu nombre.");
      return;
    }
    // Un móvil español son 9 dígitos; se admite el +34 delante.
    if (!/^(\+34)?[67]\d{8}$/.test(cleanPhone)) {
      setError("Escribe un móvil válido (9 dígitos, empieza por 6 o 7).");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      // El código nunca puede impedir el alta: cualquier fallo, a seguir.
      let goOn = true;
      try {
        goOn = await handleInvite();
      } catch {
        goOn = true;
      }
      if (!goOn) {
        savingRef.current = false;
        setSaving(false);
        return;
      }
      const { error: err } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), phone: cleanPhone },
      });
      if (err) throw err;
      // El código que se quedó sin respuesta se reintenta ya, sin esperar: si
      // llega una respuesta definitiva se borra el pendiente; si no, queda para
      // el siguiente arranque.
      const retryCode = retryCodeRef.current;
      if (retryCode && user?.id) {
        retryCodeRef.current = null;
        claimAndSettle(user.id, retryCode).catch(() => {});
      }
      router.replace(isDriver ? "/(conductor)/ofertas" : "/(cliente)/pedir");
    } catch (err) {
      setError("No se pudieron guardar los datos: " + (err.message || "error de conexión"));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <Heading>Un último dato</Heading>
        <Caption>
          Tu cuenta de Google ya nos dio el email. Solo falta el teléfono, para que el conductor y
          tú podáis llamaros durante el servicio.
        </Caption>
      </View>

      <View style={{ gap: spacing.lg }}>
        <Field
          label="Nombre y apellidos"
          value={fullName}
          onChangeText={setFullName}
          placeholder="María López García"
        />
        <Field
          label="Teléfono móvil"
          value={phone}
          onChangeText={setPhone}
          placeholder="612 45 78 90"
          keyboardType="phone-pad"
          inputMode="tel"
        />
        {showInvite ? (
          <Field
            label="¿Te ha invitado alguien? Código de invitación"
            value={inviteText}
            onChangeText={value => {
              setInviteText(value);
              setInviteHint("");
            }}
            placeholder="Opcional: el código o el enlace que te pasaron"
            autoCapitalize="none"
            autoCorrect={false}
            error={inviteHint}
          />
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Button title="Guardar y empezar" loading={saving} onPress={save} />
      </View>

      <Caption>
        Solo lo ve el conductor de tu servicio. Podrás cambiarlo cuando quieras desde tu perfil.
      </Caption>
    </Screen>
  );
}
