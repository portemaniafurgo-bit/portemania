import Link from "next/link";
import { buildRequestHref } from "@/lib/requestIntent";

export default function Footer() {
  return (
    <footer className="bg-[#1a1b20] text-white/70 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          {/* Logo SVG en lugar del texto */}
          <Link
            href="/"
            className="mb-6 block opacity-80 hover:opacity-100 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 900 220"
              className="h-8 w-auto"
              aria-label="ClicYVoy"
            >
              <defs>
                <style>{`.black{fill:#ffffff;}.yellow{fill:#F5B400;}.txt{font-family:'Poppins','Montserrat','Arial',sans-serif;font-weight:700;font-size:108px;}`}</style>
              </defs>
              <g transform="translate(20 15)">
                <path
                  className="black"
                  d="M90 20 C55 20 28 47 28 82 V145 H58 V82 C58 64 72 50 90 50 H110 C128 50 142 64 142 82 V145 H172 V82 C172 47 145 20 110 20 Z"
                />
                <path
                  className="yellow"
                  d="M28 160 H58 V178 C58 202 76 220 100 220 C124 220 142 202 142 178 V160 H172 V178 C172 217 143 250 100 278 C57 250 28 217 28 178 Z"
                  transform="translate(0 -60)"
                />
                <path className="yellow" d="M100 188 L74 162 H126 Z" />
                <circle className="yellow" cx="100" cy="102" r="16" />
              </g>
              <text x="225" y="145" className="txt">
                <tspan className="black">Clicy</tspan>
                <tspan className="yellow">Voy</tspan>
              </text>
            </svg>
          </Link>
          <p className="text-sm">
            © 2024 ClicYVoy. All rights reserved. Precise logistics for modern
            startups.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Servicios</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={buildRequestHref("/solicitar", { service: "porte" })}
                className="hover:text-white transition-colors"
              >
                Porte
              </Link>
            </li>
            <li>
              <Link
                href={buildRequestHref("/solicitar", {
                  service: "mini_mudanza",
                })}
                className="hover:text-white transition-colors"
              >
                Mini Mudanza
              </Link>
            </li>
            <li>
              <Link
                href={buildRequestHref("/solicitar", {
                  service: "compra_tienda",
                })}
                className="hover:text-white transition-colors"
              >
                Shop Delivery
              </Link>
            </li>
            <li>
              <Link
                href={buildRequestHref("/solicitar", {
                  service: "envio_paquete",
                })}
                className="hover:text-white transition-colors"
              >
                Package
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Empresa</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/ser-conductor"
                className="hover:text-white transition-colors"
              >
                Sé conductor
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-white transition-colors">
                Blog
              </Link>
            </li>
            <li>
              <Link
                href="/#como-funciona"
                className="hover:text-white transition-colors"
              >
                Cómo funciona
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/privacidad"
                className="hover:text-white transition-colors"
              >
                Política de Privacidad
              </Link>
            </li>
            <li>
              <Link
                href="/terminos"
                className="hover:text-white transition-colors"
              >
                Términos de Servicio
              </Link>
            </li>
            <li>
              <Link
                href="/cookies"
                className="hover:text-white transition-colors"
              >
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
