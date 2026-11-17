import { Platform } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Divulgación destacada de la ubicación en SEGUNDO PLANO.
 *
 * Google Play (política de datos de ubicación) obliga a explicar DENTRO de la
 * app, con un aviso propio y ANTES de que salga el diálogo de permiso del
 * sistema, qué dato se recoge, para qué se usa y que ocurre también con la app
 * cerrada o sin usarla. Sin este paso rechazan la app en la revisión, por muy
 * bien escritos que estén los textos del permiso.
 *
 * Además, el VÍDEO que pide Play en la «declaración de permisos» tiene que
 * mostrar exactamente esta secuencia: primero este diálogo, después el permiso
 * «Permitir todo el tiempo» de Android y, por último, el uso real (el cliente
 * viendo moverse al conductor con la app en segundo plano).
 *
 * El aviso se enseña una sola vez por instalación: si ya está aceptado —o si el
 * permiso de segundo plano ya está concedido— no vuelve a interrumpir.
 */
export const DISCLOSURE_KEY = "bg_location_disclosure_v1";

/**
 * Devuelve `true` si se puede continuar y pedir el permiso de segundo plano
 * (ya concedido, ya aceptado antes, o aceptado ahora mismo) y `false` si el
 * conductor lo rechaza o cierra el aviso sin responder.
 *
 * @param {{ show: Function }} dialog el `useDialog()` de components/Dialog.js
 * @returns {Promise<boolean>}
 */
export async function ensureBackgroundLocationDisclosure(dialog) {
  // 1. Permiso ya concedido: no hay nada que divulgar, no se molesta.
  try {
    const background = await Location.getBackgroundPermissionsAsync();
    if (background?.granted) return true;
  } catch {
    // Si no se puede consultar el permiso, se enseña el aviso igualmente:
    // es lo conservador frente a la política de Play.
  }

  // 2. Ya aceptado en esta instalación.
  try {
    if ((await AsyncStorage.getItem(DISCLOSURE_KEY)) === "accepted") return true;
  } catch {
    // Almacenamiento no disponible: se vuelve a preguntar, no se bloquea.
  }

  // iPhone: otras reglas. Apple no pide esta divulgación, pero rechaza (guía
  // 5.1.1) un aviso previo con un botón para saltarse el permiso: el aviso
  // solo explica, tiene un único «Continuar» y SIEMPRE sigue al diálogo del
  // sistema. Allí el orden es otro: primero «Al usar la app» y después el
  // iPhone ofrece pasar a «Siempre» (ver startTracking en lib/tracking.js).
  if (Platform.OS === "ios") return showIosExplanation(dialog);

  // 3. Sin diálogo no hay divulgación posible, y sin divulgación NO se pide el
  // permiso: es justo lo que prohíbe la política.
  if (!dialog?.show) return false;

  return new Promise(resolve => {
    let answered = false;
    const answer = async value => {
      if (answered) return; // el diálogo puede cerrarse por acción Y por fondo
      answered = true;
      if (value) {
        try {
          await AsyncStorage.setItem(DISCLOSURE_KEY, "accepted");
        } catch {
          /* que no se guarde solo significa volver a preguntar */
        }
      }
      resolve(value);
    };

    dialog.show({
      title: "Tu ubicación durante el servicio",
      message:
        "ClicyVoy recoge tu ubicación para que el cliente pueda seguirte en el mapa y saber cuándo llegas, también cuando la app está cerrada o no la estás usando. Solo se comparte mientras tienes un servicio activo y se detiene al terminarlo o al cancelarlo.\n\nEn la siguiente pantalla elige «Permitir todo el tiempo».",
      actions: [
        { text: "Entendido, continuar", onPress: () => answer(true) },
        { text: "Ahora no", style: "cancel", onPress: () => answer(false) },
      ],
      // El diálogo del proyecto se cierra tocando el fondo o con el botón
      // atrás, y en ese caso no se llama a ninguna acción: sin esto, la promesa
      // se quedaría colgada y el seguimiento no arrancaría nunca.
      onDismiss: () => answer(false),
    });
  });
}

/**
 * Versión iPhone del aviso: mismo contenido, un único botón y siempre
 * continúa (cerrarlo tocando fuera también). Devuelve `true` siempre: en iOS
 * quien decide es el diálogo del sistema que viene detrás.
 */
function showIosExplanation(dialog) {
  if (!dialog?.show) return Promise.resolve(true);
  return new Promise(resolve => {
    let answered = false;
    const go = async () => {
      if (answered) return;
      answered = true;
      try {
        await AsyncStorage.setItem(DISCLOSURE_KEY, "accepted");
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
