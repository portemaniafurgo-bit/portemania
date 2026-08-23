import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as IntentLauncher from "expo-intent-launcher";
import { Ionicons } from "@expo/vector-icons";
import { Body, Button, Caption, Card, Heading, Screen, Title } from "../../components/ui";
import { colors, radius, spacing } from "../../theme";

/**
 * Guía del conductor: los dos ajustes de Android sin los cuales la app no puede
 * hacer su trabajo, explicados en cristiano y con el botón que lleva al ajuste.
 *
 * No es documentación de relleno: en Xiaomi, el ahorro de batería mata el
 * servicio en segundo plano y la posición del conductor se congela sin que él
 * se entere. Es la causa número uno de "el cliente dice que no me ve moverme".
 */
const EMAIL = "portemaniafurgo@gmail.com";

export default function AyudaConductor() {
  const abrirAjustes = async () => {
    if (Platform.OS !== "android") return;
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: "package:com.clicyvoy.app" },
      );
    } catch {
      Linking.openSettings();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Ayuda" }} />
      <Heading>Para que todo funcione</Heading>
      <Caption>
        Dos ajustes del móvil. Sin ellos la app parece que va bien, pero el cliente deja de verte
        moverte y tú dejas de recibir avisos.
      </Caption>

      <Card>
        <View style={styles.head}>
          <View style={styles.number}>
            <Text style={styles.numberText}>1</Text>
          </View>
          <Title style={{ flex: 1 }}>Ubicación: «Permitir todo el tiempo»</Title>
        </View>
        <Body>
          Mientras tienes un servicio, tu posición viaja al cliente aunque bloquees la pantalla o
          te vayas a Google Maps. Android solo lo permite con este permiso.
        </Body>
        <Caption>Ajustes → Permisos → Ubicación → Permitir todo el tiempo.</Caption>
      </Card>

      <Card>
        <View style={styles.head}>
          <View style={styles.number}>
            <Text style={styles.numberText}>2</Text>
          </View>
          <Title style={{ flex: 1 }}>Batería: «Sin restricciones»</Title>
        </View>
        <Body>
          Xiaomi, Samsung y Huawei cierran las apps en segundo plano para ahorrar batería. Si lo
          hacen con ClicyVoy, tu posición se congela y el cliente cree que no te has movido.
        </Body>
        <Caption>Ajustes → Batería → Sin restricciones (o «Sin límites»).</Caption>
      </Card>

      <Button title="Abrir los ajustes de la app" icon="settings-outline" onPress={abrirAjustes} />

      <Card>
        <Title>Cómo se cobra</Title>
        <Body>
          Cada servicio te dice si es en efectivo o con tarjeta. Si pone «Ya pagado con tarjeta»,
          no le cobres nada al cliente. Las propinas son íntegras para ti.
        </Body>
        <Caption>
          Tus facturas están en Perfil → Mis facturas, con su número correlativo.
        </Caption>
      </Card>

      <Card>
        <Title>Cancelar un servicio</Title>
        <Body>
          Antes de salir puedes cancelar sin más. Ya en camino, queda registrado como imprevisto y
          se avisa a la empresa. Con la carga recogida no se cancela desde la app: la mercancía es
          del cliente.
        </Body>
      </Card>

      <Button
        title="Escribir a la empresa"
        variant="plain"
        icon="mail-outline"
        onPress={() => Linking.openURL(`mailto:${EMAIL}?subject=Ayuda%20conductor%20ClicyVoy`)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  number: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontSize: 14, fontFamily: "Poppins_700Bold", color: colors.primary },
});
