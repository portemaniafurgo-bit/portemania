import { Linking } from "react-native";
import { Stack } from "expo-router";
import { SettingsGroup, SettingsRow } from "../../components/SettingsRow";
import { Caption, Heading, Screen } from "../../components/ui";

/**
 * Ayuda y contacto (canvas 2i). Nada de formularios que van a un buzón que
 * nadie mira: se abre el correo, el teléfono o la web reales de la empresa.
 */
const EMAIL = "portemaniafurgo@gmail.com";

export default function Ayuda() {
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Ayuda y contacto" }} />
      <Heading>¿Te echamos una mano?</Heading>
      <Caption>
        Para algo urgente de un servicio en curso, escribe por el chat del pedido: el conductor lo
        lee al momento.
      </Caption>

      <SettingsGroup>
        <SettingsRow
          icon="mail-outline"
          label="Escribirnos por email"
          hint={EMAIL}
          onPress={() =>
            Linking.openURL(`mailto:${EMAIL}?subject=${encodeURIComponent("Ayuda con ClicyVoy")}`)
          }
        />
        <SettingsRow
          icon="globe-outline"
          label="clicyvoy.es"
          hint="Tarifas, zonas de reparto y preguntas frecuentes"
          onPress={() => Linking.openURL("https://clicyvoy.es")}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="document-text-outline"
          label="Términos del servicio"
          onPress={() => Linking.openURL("https://clicyvoy.es/terminos")}
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Política de privacidad"
          onPress={() => Linking.openURL("https://clicyvoy.es/privacidad")}
          last
        />
      </SettingsGroup>
    </Screen>
  );
}
