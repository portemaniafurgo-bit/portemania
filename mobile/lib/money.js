/**
 * Importes en formato español, como los rotula el canvas: «46 €», «39,10 €»,
 * «3.482 €». Coma decimal y punto de millar — nada de toFixed a la americana.
 */
export function euro(value, decimals) {
  const n = Number(value) || 0;
  const d = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
}

/** «4,9» para valoraciones. */
export function rating1(value) {
  return Number(value).toFixed(1).replace(".", ",");
}
