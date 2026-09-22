import * as Haptics from "expo-haptics";

/**
 * Aviso de que ha entrado un pedido, con la app abierta.
 *
 * La melodía propia ya existe: `assets/sounds/oferta.wav`, configurada en el
 * canal «ofertas» (máxima prioridad, vibración y pantalla de bloqueo). Quien la
 * reproduce es la NOTIFICACIÓN del sistema, también con la app en primer plano;
 * aquí solo se suma la vibración háptica, que es lo que se nota conduciendo o
 * cargando.
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
