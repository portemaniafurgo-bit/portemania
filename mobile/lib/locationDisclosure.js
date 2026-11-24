import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IOS_DISCLOSURE_KEY = "bg_location_disclosure_v1";
const ANDROID_DISCLOSURE_KEY = "bg_location_disclosure_v2";

const foregroundNotices = {
  address:
    "ClicyVoy usa la ubicación de tu dispositivo para rellenar la dirección del porte. Según la pantalla, enviamos tus coordenadas al servicio de geocodificación Photon para buscar la dirección. También puedes escribirla a mano.",
  driver:
    "ClicyVoy usa la ubicación de tu dispositivo para mostrarte en el mapa de tu servicio y ordenar las ofertas por cercanía. Para compartir tu posición con el cliente durante el servicio te pediremos otro permiso.",
};

function confirmLocationUse(title, message) {
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: "Ahora no", style: "cancel", onPress: () => resolve(false) },
      { text: "Aceptar y continuar", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export async function requestForegroundLocation(purpose) {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted || !permission.canAskAgain) return permission;

  if (
    Platform.OS === "android" &&
    !(await confirmLocationUse("Usar tu ubicación", foregroundNotices[purpose]))
  ) {
    return permission;
  }

  return Location.requestForegroundPermissionsAsync();
}

export async function requestTrackingBackgroundLocation() {
  if (Platform.OS !== "android") {
    return Location.requestBackgroundPermissionsAsync().catch(() => ({ granted: false }));
  }

  const permission = await Location.getBackgroundPermissionsAsync();
  const disclosed = await AsyncStorage.getItem(ANDROID_DISCLOSURE_KEY).catch(() => null);
  if (permission.granted && disclosed === "accepted") return permission;

  const accepted = await confirmLocationUse(
    "Ubicación en segundo plano",
    "ClicyVoy recoge y envía tu ubicación precisa a sus servidores durante un servicio activo, incluso cuando la app está cerrada o no la estás usando. Tu cliente y las personas con su enlace de seguimiento pueden ver tu posición en el mapa y el cliente puede recibir un aviso de llegada. El mapa público de conductores disponibles puede mostrar una posición aproximada. La recogida se detiene al finalizar o cancelar el servicio." +
      (permission.granted ? "" : "\n\nEn el permiso de Android, elige «Permitir todo el tiempo»."),
  );
  if (!accepted) return { granted: false };

  const result = permission.granted ? permission : await Location.requestBackgroundPermissionsAsync();
  if (result.granted) {
    await AsyncStorage.setItem(ANDROID_DISCLOSURE_KEY, "accepted").catch(() => {});
  }
  return result;
}

export async function showIosTrackingDisclosure(dialog) {
  if (Platform.OS !== "ios") return;
  const permission = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (permission?.granted) return;
  if ((await AsyncStorage.getItem(IOS_DISCLOSURE_KEY).catch(() => null)) === "accepted") return;
  await showIosExplanation(dialog);
}

function showIosExplanation(dialog) {
  if (!dialog?.show) return Promise.resolve(true);
  return new Promise(resolve => {
    let answered = false;
    const go = async () => {
      if (answered) return;
      answered = true;
      try {
        await AsyncStorage.setItem(IOS_DISCLOSURE_KEY, "accepted");
      } catch {
        /* que no se guarde solo significa volver a explicarlo */
      }
      resolve(true);
    };

    dialog.show({
      title: "Tu ubicación durante el servicio",
      message:
        "ClicyVoy recoge tu ubicación para que el cliente pueda seguirte en el mapa y saber cuándo llegas, también con la pantalla bloqueada o mientras usas otra app para navegar. Solo se comparte mientras tienes un servicio activo y se detiene al terminarlo o al cancelarlo.\n\nCon el permiso «Al usar la app» tu posición se envía mientras ClicyVoy está abierta o en segundo plano. Para que el seguimiento siga con la pantalla bloqueada aunque el iPhone cierre la app, cámbialo a «Siempre» en Ajustes → ClicyVoy → Ubicación.",
      actions: [{ text: "Continuar", onPress: go }],
      hideBack: true,
      onDismiss: go,
    });
  });
}
