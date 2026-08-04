import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "ClicyVoy — Tu transporte en minutos",
  description:
    "La forma más rápida y segura de transportar tus cosas. Furgonetas para portes y mudanzas con conductores verificados.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        {/* Carga directa de la fuente, estilo antiguo pero 100% efectivo */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        {/* Clase de iconos con máxima prioridad */}
        <style>{`
          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined' !important;
            font-weight: normal !important;
            font-style: normal !important;
            font-size: 24px !important;
            line-height: 1 !important;
            letter-spacing: normal !important;
            text-transform: none !important;
            display: inline-block !important;
            white-space: nowrap !important;
            word-wrap: normal !important;
            direction: ltr !important;
            font-feature-settings: 'liga' !important;
            -webkit-font-smoothing: antialiased !important;
          }
        `}</style>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
