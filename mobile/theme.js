/**
 * Tema de la app — los MISMOS tokens que la web (src/app/globals.css y
 * tailwind.config.js), convertidos de HSL a hex porque React Native no entiende
 * variables CSS. Si cambias un color en la web, cámbialo aquí.
 *
 * Las fuentes Space Grotesk / Inter hay que empaquetarlas con expo-font antes
 * de usarlas; mientras no estén, `heading` cae en la del sistema.
 */
export const colors = {
  background: "#F7F9FB", // 210 20% 98%
  foreground: "#0F172A", // 222 47% 11%
  card: "#FFFFFF",
  primary: "#3B82F6", // 217 91% 60% — azul ClicyVoy
  primaryForeground: "#FFFFFF",
  secondary: "#F1F5F9", // 210 40% 96%
  muted: "#F1F5F9",
  mutedForeground: "#64748B", // 215 16% 47%
  destructive: "#EF4444", // 0 84% 60%
  destructiveForeground: "#FFFFFF",
  border: "#E2E8F0", // 214 32% 91%
  success: "#10B981",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningBg: "#FFFBEB",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16, // equivalente al rounded-2xl que domina la web
  full: 999,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const typography = {
  heading: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  title: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  body: { fontSize: 15, color: colors.foreground },
  caption: { fontSize: 13, color: colors.mutedForeground },
};
