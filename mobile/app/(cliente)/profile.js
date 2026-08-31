import { useCallback, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "../onboarding";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { getDefaultPayment, PAYMENT_LABELS } from "../../lib/payment";
import DeleteAccount from "../../components/DeleteAccount";
import NotificationPrefs from "../../components/NotificationPrefs";
import { SettingsGroup, SettingsRow } from "../../components/SettingsRow";
import { Caption, Heading, Screen, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Perfil del cliente (canvas 2i): identidad arriba, avisos con sus tres
 * interruptores, y las filas de pago, recibos y ayuda. Cerrar sesión y borrar
 * cuenta al final — esta última la exige Google Play en toda app con registro.
 */
export default function Perfil() {
  const { user, role, signOut, setMode } = useAuth();
  const router = useRouter();
  const [payment, setPayment] = useState("cash");
  // Resumen de los datos fiscales, para que se vea de un vistazo si hay factura.
  const [billing, setBilling] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDefaultPayment().then(value => active && setPayment(value));
      if (user?.id) {
        supabase
          .from("profiles")
          .select("billing_name, billing_tax_id")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!active) return;
            setBilling(
              data?.billing_tax_id
                ? `${data.billing_name || "A tu nombre"} · ${data.billing_tax_id}`
                : null,
            );
          });
      }
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  /** Volver a ver la introducción: baja el flag y abre las tres pantallas. */
  const replayOnboarding = async () => {
    await AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => {});
    router.push("/onboarding");
  };

  const name = user?.user_metadata?.full_name || "Sin nombre";
  const phone = user?.user_metadata?.phone;
  const version = Constants.expoConfig?.version || "0.1.4";

  return (
    <Screen>
      <Heading>Perfil</Heading>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>{name}</Title>
          {phone ? <Caption>{phone}</Caption> : null}
          <Caption>{user?.email}</Caption>
          {role && role !== "client" ? <Caption>Rol: {role}</Caption> : null}
        </View>
      </View>

      <NotificationPrefs />

      <SettingsGroup>
        {/* Un conductor real que está pidiendo como cliente vuelve a su cara
            desde aquí; quien no lo es puede empezar el alta en la web. */}
        {role === "driver" ? (
          <SettingsRow
            icon="swap-horizontal-outline"
            label="Volver al modo conductor"
            hint="Tus ofertas y servicios de conductor"
            onPress={async () => {
              await setMode("driver");
              router.replace("/(conductor)/ofertas");
            }}
          />
        ) : (
          <SettingsRow
            icon="car-outline"
            label="¿Quieres conducir con ClicyVoy?"
            hint="Hazte conductor: date de alta en dos minutos"
            onPress={() => Linking.openURL("https://clicyvoy.es/ser-conductor")}
          />
        )}
        <SettingsRow
          icon="card-outline"
          label="Métodos de pago"
          value={PAYMENT_LABELS[payment]}
          onPress={() => router.push("/(cliente)/pagos")}
        />
        <SettingsRow
          icon="document-text-outline"
          label="Datos de facturación"
          hint={billing ? billing : "Sin NIF: recibirás recibo, no factura"}
          onPress={() => router.push("/(cliente)/facturacion")}
        />
        <SettingsRow
          icon="receipt-outline"
          label="Mis facturas y recibos"
          onPress={() => router.push("/(cliente)/orders?filter=delivered")}
        />
        <SettingsRow
          icon="help-buoy-outline"
          label="Ayuda y contacto"
          onPress={() => router.push("/(cliente)/ayuda")}
        />
        <SettingsRow
          icon="sparkles-outline"
          label="Ver la introducción"
          hint="Las tres pantallas del primer arranque"
          onPress={replayOnboarding}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow icon="log-out-outline" label="Cerrar sesión" onPress={signOut} />
        <SettingsRow
          icon="information-circle-outline"
          label="Administrar pedidos o tarifas"
          hint="El panel de administración sigue siendo web"
          onPress={() => Linking.openURL("https://clicyvoy.es/admin")}
          last
        />
      </SettingsGroup>

      <DeleteAccount />

      <Caption style={{ textAlign: "center" }}>ClicyVoy {version} · Albacete</Caption>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 24, fontFamily: "Poppins_700Bold", color: colors.primary },
});
