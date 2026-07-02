import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "PorteManía — Tu transporte en minutos",
  description:
    "La forma más rápida y segura de transportar tus cosas. Furgonetas para portes y mudanzas con conductores verificados.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
