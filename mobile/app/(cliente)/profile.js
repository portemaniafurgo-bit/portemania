import { useCallback, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_KEY } from "../onboarding";
import { useAuth } from "../../lib/auth";
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
  const { user, role, signOut } = useAuth();
  const router = useRouter();
  const [payment, setPayment] = useState("cash");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getDefaultPayment().then(value => active && setPayment(value));
      return () => {
        active = false;
      };
    }, []),
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
        <SettingsRow
          icon="card-outline"
          label="Métodos de pago"
          value={PAYMENT_LABELS[payment]}
          onPress={() => router.push("/(cliente)/pagos")}
        />
        <SettingsRow
          icon="receipt-outline"
          label="Mis recibos"
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
