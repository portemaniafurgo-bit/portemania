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
  ink: "#31313B", // gris oscuro del canvas: importes de desglose y cuerpo denso
  mutedForeground: "#6C6C78", // gris del canvas
  subtle: "#9A9AA6", // gris claro del canvas (metadatos, placeholders)
  hairline: "#EDEBF2", // separadores finos del canvas (más claros que el borde)
  destructive: "#C93434", // rojo del canvas
  destructiveForeground: "#FFFFFF",
  border: "#E7E5EC", // borde de tarjeta del canvas
  success: "#10B981",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
};

export const radius = {
  sm: 8,
  md: 14, // input del canvas
  lg: 20, // tarjeta del canvas
  sheet: 28, // hoja del canvas
  full: 999, // chips y botones
};

// Espaciado del canvas: 4 · 8 · 12 · 16 · 20 · 24, margen de pantalla 20.
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, screen: 20, xl: 24, xxl: 32 };

// Botón principal del canvas: 54 de alto, radio 27, Poppins 600 16.
export const button = { height: 54, radius: 27, fontSize: 16 };

export const typography = {
  // ESCALA MEDIDA SOBRE EL CANVAS (estilos en línea de los artboards):
  //   título de pantalla Poppins 600 25-27 con tracking negativo
  //   título de tarjeta Poppins 600 16-17 · cuerpo DM Sans 13,5/1,5
  //   metadatos 12 · etiquetas de sección DM Sans 500 12 en #9A9AA6
  display: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: "Poppins_600SemiBold",
    color: colors.foreground,
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 25,
    lineHeight: 30,
    fontFamily: "Poppins_600SemiBold",
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  title: { fontSize: 17, fontFamily: "Poppins_600SemiBold", color: colors.foreground },
  body: { fontSize: 13.5, fontFamily: "DMSans_400Regular", color: colors.ink, lineHeight: 20 },
  caption: { fontSize: 12, fontFamily: "DMSans_400Regular", color: colors.mutedForeground, lineHeight: 17 },
  overline: { fontSize: 12, fontFamily: "DMSans_500Medium", color: colors.subtle },
};
