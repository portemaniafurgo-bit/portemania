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
