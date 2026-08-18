import { useAuth } from "../../lib/auth";
import DeleteAccount from "../../components/DeleteAccount";
import NotificationPrefs from "../../components/NotificationPrefs";
import { Body, Button, Caption, Card, Heading, Screen, Title } from "../../components/ui";

/**
 * Cuenta del cliente. En la Etapa 6 se añade aquí el BORRADO DE CUENTA, que
 * Google Play exige a toda app que permita registrarse.
 */
export default function Perfil() {
  const { user, role, signOut } = useAuth();

  return (
    <Screen>
      <Heading>Mi cuenta</Heading>

      <Card>
        <Title>{user?.user_metadata?.full_name || "Sin nombre"}</Title>
        <Caption>{user?.email}</Caption>
        {user?.user_metadata?.phone ? <Caption>{user.user_metadata.phone}</Caption> : null}
        {role && role !== "client" ? <Caption>Rol: {role}</Caption> : null}
      </Card>

      <Card>
        <Body>¿Necesitas administrar pedidos o tarifas?</Body>
        <Caption>El panel de administración sigue siendo web: clicyvoy.es/admin</Caption>
      </Card>

      <NotificationPrefs />

      <Button title="Cerrar sesión" variant="plain" onPress={signOut} />

      <DeleteAccount />
    </Screen>
  );
}
