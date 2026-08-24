import * as Haptics from "expo-haptics";

/**
 * Aviso de que ha entrado un pedido, con la app abierta.
 *
 * De momento suena la NOTIFICACIÓN del sistema (canal «ofertas», que ya va con
 * máxima prioridad y vibración) y aquí se añade la vibración fuerte, que es lo
 * que se nota conduciendo o cargando.
 *
 * Para una melodía propia hace falta un fichero de audio en la app —ver
 * docs/SONIDO-OFERTAS.md—: es un cambio nativo, así que entra en el siguiente
 * APK, no por OTA.
 */
export async function alertNewOffer() {
  try {
    // Dos golpes: uno solo se confunde con cualquier aviso del móvil.
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 220);
  } catch {
    // Sin vibración (o sin permiso) el aviso visual sigue estando: no es
    // motivo para romper nada.
  }
}
