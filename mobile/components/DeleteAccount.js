import { useState } from "react";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Button, Caption, Card, ErrorText, Title } from "./ui";
import { colors } from "../theme";

/**
 * Borrado de cuenta (requisito de Google Play). Doble confirmación: es
 * irreversible. La RPC `delete_own_account` (migración 0013) anonimiza los
 * pedidos ya prestados (los necesita Finanzas) y borra todo lo demás.
 */
export default function DeleteAccount() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirm = () => {
    Alert.alert(
      "¿Borrar tu cuenta para siempre?",
      "Se eliminarán tu perfil, tus datos personales y tu acceso. Los servicios ya realizados se conservan de forma anónima. Esta acción no se puede deshacer.",
      [
        { text: "Conservar mi cuenta", style: "cancel" },
        {
          text: "Borrar definitivamente",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError("");
            const { error: err } = await supabase.rpc("delete_own_account");
            if (err) {
              // El caso real más probable: conductor con un servicio en curso.
              setError(err.message || "No se pudo borrar la cuenta.");
              setDeleting(false);
              return;
            }
            await signOut(); // la sesión ya no vale: limpiar y volver al login
          },
        },
      ],
    );
  };

  if (!open) {
    return (
      <Button
        title="Eliminar mi cuenta"
        variant="plain"
        onPress={() => setOpen(true)}
      />
    );
  }

  return (
    <Card style={{ borderColor: colors.destructive }}>
      <Title style={{ color: colors.destructive }}>Eliminar mi cuenta</Title>
      <Caption>
        Es irreversible: perderás tu historial visible, tu perfil y tu acceso. Los servicios ya
        realizados se conservan anonimizados por obligaciones de facturación.
      </Caption>
      <ErrorText>{error}</ErrorText>
      <Button title="Borrar definitivamente" onPress={confirm} loading={deleting} />
      <Button title="Conservar mi cuenta" variant="plain" onPress={() => setOpen(false)} disabled={deleting} />
    </Card>
  );
}
