import Link from "next/link";
import { buildRequestHref } from "@/lib/requestIntent";

export default function Footer() {
  return (
    <footer className="bg-[#1a1b20] text-white/70 py-16">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <Link href="/" className="text-2xl font-bold text-white mb-6 block opacity-80 hover:opacity-100">ClicYVoy</Link>
          <p className="text-sm">© 2024 ClicYVoy. All rights reserved. Precise logistics for modern startups.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Servicios</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href={buildRequestHref("/solicitar", { service: "porte" })} className="hover:text-white transition-colors">Porte</Link></li>
            <li><Link href={buildRequestHref("/solicitar", { service: "mini_mudanza" })} className="hover:text-white transition-colors">Mini Mudanza</Link></li>
            <li><Link href={buildRequestHref("/solicitar", { service: "compra_tienda" })} className="hover:text-white transition-colors">Shop Delivery</Link></li>
            <li><Link href={buildRequestHref("/solicitar", { service: "envio_paquete" })} className="hover:text-white transition-colors">Package</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Empresa</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/ser-conductor" className="hover:text-white transition-colors">Sé conductor</Link></li>
            <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            <li><Link href="/#como-funciona" className="hover:text-white transition-colors">Cómo funciona</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4 text-white">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacidad" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
            <li><Link href="/terminos" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
            <li><Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
