import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Export original de Base44: solo referencia local, no se lintéa
    "base44/**",
    // Edge Functions (Deno, no Node)
    "supabase/functions/**",
    // App Android (React Native): otro entorno y otras reglas; se lintéa desde
    // mobile/ con la configuración de Expo, no con la de Next.
    "mobile/**",
  ]),
]);

export default eslintConfig;
