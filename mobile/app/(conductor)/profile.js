import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { fetchMyDriverProfile, isDriverProfileIncomplete } from "../../lib/driverProfile";
import { Body, Button, Caption, Card, Heading, Loading, Screen, Title } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Perfil del conductor. En la Etapa 4 (T4.8) se añade aquí la re-subida de
 * documentos con cámara y compresión; de momento muestra el estado real para
 * verificar que el lookup por email encuentra el perfil correcto (el bug de
 * julio hacía que un admin-conductor viese el perfil de otra persona).
 */
export default function PerfilConductor() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    let active = true;
    fetchMyDriverProfile(user).then(p => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, [user]);

  if (profile === undefined) return <Loading label="Cargando tu perfil…" />;

  return (
    <Screen>
      <Heading>Mi perfil</Heading>

      <Card>
        <Title>{profile?.full_name || user?.user_metadata?.full_name || "Sin nombre"}</Title>
        <Caption>{user?.email}</Caption>
        {profile ? (
          <>
            <Caption>
              Furgoneta: {profile.vehicle_type === "large" ? "grande" : "pequeña"}
              {profile.vehicle_brand ? ` · ${profile.vehicle_brand}` : ""}
              {profile.vehicle_plate ? ` · ${profile.vehicle_plate}` : ""}
            </Caption>
            <Caption>Estado: {profile.status === "verified" ? "verificado" : profile.status}</Caption>
          </>
        ) : (
          <Caption>Aún no tienes perfil de conductor asociado a este email.</Caption>
        )}
      </Card>

      {profile && isDriverProfileIncomplete(profile) && (
        <Card style={{ backgroundColor: colors.warningBg, borderColor: colors.warning }}>
          <Body>Documentación incompleta</Body>
          <Caption>
            Súbela desde clicyvoy.es hasta que la Etapa 4 traiga la subida con cámara a la app.
          </Caption>
        </Card>
      )}

      <Button title="Cerrar sesión" variant="plain" onPress={signOut} />
    </Screen>
  );
}
