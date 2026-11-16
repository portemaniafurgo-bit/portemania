import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Método de pago preferido (canvas 2i → «Métodos de pago»). Vive en el
 * dispositivo y solo PRERRELLENA el asistente: el pago real se decide y se
 * confirma en cada pedido, nunca se cobra nada por esta preferencia.
 */
const KEY = "default_payment_v1";

/**
 * Nombre del pago con tarjeta. En iPhone no se ofrece Google Pay (PaymentSheet
 * solo lo enseña en Android) y Apple Pay está apagado, así que allí es
 * «Tarjeta»: además, Apple rechaza apps que nombran otra plataforma.
 */
export const CARD_LABEL = Platform.OS === "ios" ? "Tarjeta" : "Tarjeta o Google Pay";

export const PAYMENT_LABELS = {
  card: CARD_LABEL,
  bizum: "Bizum al conductor",
  cash: "Efectivo al conductor",
};

export async function getDefaultPayment() {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return PAYMENT_LABELS[value] ? value : "cash";
  } catch {
    return "cash";
  }
}

export async function setDefaultPayment(value) {
  try {
    await AsyncStorage.setItem(KEY, value);
  } catch {
    /* si no se puede guardar, el asistente sigue pidiéndolo en cada pedido */
  }
}
