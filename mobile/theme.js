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
  foreground: "#14141A", // el negro del canvas de rediseño (antes #1a1b20)
  card: "#FFFFFF",

  primary: "#7145d6", // morado de la landing
  primaryPressed: "#5a35b0", // hover/pressed de la landing
  primaryForeground: "#FFFFFF",
  primarySoft: "#FAF5FF", // purple-50: fondos suaves de lo seleccionado/activo

  accent: "#F5B400", // amarillo de la marca (logo, estrellas)

  secondary: "#F3F2F6",
  muted: "#F3F2F6",
  mutedForeground: "#6C6C78", // gris del canvas
  subtle: "#9A9AA6", // gris claro del canvas (metadatos, placeholders)
  destructive: "#C93434", // rojo del canvas
  destructiveForeground: "#FFFFFF",
  border: "#E1DFE6", // borde del canvas
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
  // Del canvas de rediseño: Poppins para titular, DM Sans para el cuerpo.
  // Ambas se cargan en app/_layout.js con fallback a la del sistema.
  heading: { fontSize: 20, fontFamily: "Poppins_700Bold", color: colors.foreground },
  title: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  body: { fontSize: 15, fontFamily: "DMSans_400Regular", color: colors.foreground },
  caption: { fontSize: 13, fontFamily: "DMSans_400Regular", color: colors.mutedForeground },
};
