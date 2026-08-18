/**
 * Probabilidad de que un conductor acepte una oferta del cliente, según lo que
 * se aleje de la tarifa calculada (idea de Renato, 18/08/2026): cuanto más baja
 * la oferta más difícil, y cuanto más sube, más fácil.
 *
 * Mismos tramos que la app (mobile/components/OfferControl.js): si se tocan
 * aquí, hay que tocarlos allí — el cliente no puede leer dos mensajes
 * distintos para el mismo importe.
 */
export function acceptanceOf(value, closed) {
  const ratio = closed > 0 ? value / closed : 1;

  if (ratio < 0.75) {
    return {
      key: "hard",
      label: "Difícil de aceptar",
      hint: "Muy por debajo de la tarifa: puede que ningún conductor lo coja.",
      bg: "bg-red-50",
      dot: "bg-red-500",
      text: "text-red-600",
    };
  }
  if (ratio < 0.92) {
    return {
      key: "slow",
      label: "Puede tardar",
      hint: "Por debajo de la tarifa: alguno lo aceptará, pero esperarás más.",
      bg: "bg-amber-50",
      dot: "bg-amber-500",
      text: "text-amber-600",
    };
  }
  if (ratio < 1) {
    return {
      key: "likely",
      label: "Probable",
      hint: "Cerca de la tarifa: lo normal es que te lo acepten.",
      bg: "bg-primary/10",
      dot: "bg-primary",
      text: "text-primary",
    };
  }
  if (ratio === 1) {
    return {
      key: "usual",
      label: "Lo habitual",
      hint: "Justo la tarifa de ClicyVoy: se acepta casi siempre a la primera.",
      bg: "bg-primary/10",
      dot: "bg-primary",
      text: "text-primary",
    };
  }
  return {
    key: "easy",
    label: "Muy fácil",
    hint: "Por encima de la tarifa: tendrás conductor enseguida.",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
  };
}
