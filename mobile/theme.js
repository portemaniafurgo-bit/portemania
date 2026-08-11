/**
 * Tema de la app — la línea gráfica es la de la LANDING ACTUAL de clicyvoy.es
 * (rediseño de agosto 2026), no los tokens azules antiguos del área interna:
 *
 *   - Morado #7145d6 como color principal (botones, enlaces, activo) con
 *     #5a35b0 al pulsar — exactamente los que usa la landing.
 *   - Amarillo #F5B400 de la marca (logo, estrellas) como acento.
 *   - Fondos claros, tarjetas blancas, esquinas muy redondeadas.
 *
 * Si el negocio cambia la línea en la web, este archivo es el ÚNICO sitio que
 * hay que tocar en la app: ninguna pantalla lleva colores en duro.
 */
export const colors = {
  background: "#F7F7FA",
  foreground: "#1a1b20", // el negro de la landing
  card: "#FFFFFF",

  primary: "#7145d6", // morado de la landing
  primaryPressed: "#5a35b0", // hover/pressed de la landing
  primaryForeground: "#FFFFFF",
  primarySoft: "#FAF5FF", // purple-50: fondos suaves de lo seleccionado/activo

  accent: "#F5B400", // amarillo de la marca (logo, estrellas)

  secondary: "#F4F4F6",
  muted: "#F4F4F6",
  mutedForeground: "#64748B",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "#E5E7EB",
  success: "#10B981",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16, // rounded-2xl de las tarjetas
  full: 999, // los botones de la landing son rounded-full
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const typography = {
  heading: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  title: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  body: { fontSize: 15, color: colors.foreground },
  caption: { fontSize: 13, color: colors.mutedForeground },
};
