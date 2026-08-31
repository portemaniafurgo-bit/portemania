import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Método de pago preferido (canvas 2i → «Métodos de pago»). Vive en el
 * dispositivo y solo PRERRELLENA el asistente: el pago real se decide y se
 * confirma en cada pedido, nunca se cobra nada por esta preferencia.
 */
const KEY = "default_payment_v1";

export const PAYMENT_LABELS = {
  card: "Tarjeta o Google Pay",
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
