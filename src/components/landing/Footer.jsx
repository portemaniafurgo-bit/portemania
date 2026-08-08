import Link from "next/link";
import Logo from "@/components/landing/Logo";
import { SERVICE_LIST, serviceHref } from "@/lib/services";

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="bg-[#1a1b20] text-white/70 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <Link href="/" className="mb-6 block opacity-80 hover:opacity-100 transition-opacity">
            <Logo className="h-8 w-auto" tone="light" />
          </Link>
          <p className="text-sm leading-relaxed">
            Furgoneta con conductor en Albacete para portes, mini mudanzas, entregas para tiendas y
            envío de paquetes.
          </p>
          <p className="text-sm mt-4">© {year} ClicyVoy. Todos los derechos reservados.</p>
        </div>

        <div>
          <h2 className="font-semibold mb-4 text-white">Servicios</h2>
          <ul className="space-y-2 text-sm">
            {SERVICE_LIST.map((service) => (
              <li key={service.key}>
                <Link href={serviceHref(service.key)} className="hover:text-white transition-colors">
                  {service.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-4 text-white">Empresa</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/ser-conductor" className="hover:text-white transition-colors">
                Quiero ser conductor
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-white transition-colors">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/#como-funciona" className="hover:text-white transition-colors">
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link href="/solicitar" className="hover:text-white transition-colors">
                Reservar un transporte
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold mb-4 text-white">Legal</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/privacidad" className="hover:text-white transition-colors">
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link href="/terminos" className="hover:text-white transition-colors">
                Términos de servicio
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
