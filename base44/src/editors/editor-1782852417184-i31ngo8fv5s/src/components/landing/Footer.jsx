import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white/70 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary rounded-xl p-1.5">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M13 16V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1m8-1a1 1 0 0 1-1 1H9m4-1V8a1 1 0 0 1 1-1h2.586a1 1 0 0 1 .707.293l3.414 3.414a1 1 0 0 1 .293.707V16a1 1 0 0 1-1 1h-1m-6-1a1 1 0 0 0 1 1h1M5 17a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0m6 0a2 2 0 1 0 4 0m-4 0a2 2 0 1 1 4 0" />
                  </svg>
                </div>
                <span className="text-xl font-display font-bold text-white">
                  Porte<span className="text-primary">Manía</span>
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              La forma más rápida y segura de transportar tus cosas. Disponible en las principales ciudades.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Servicios</h4>
            <ul className="space-y-2 text-sm">
              <li>Mudanzas</li>
              <li>Transporte de muebles</li>
              <li>Electrodomésticos</li>
              <li>Material de construcción</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm">
              <li>Sobre nosotros</li>
              <li>Sé conductor</li>
              <li>Para empresas</li>
              <li>Contacto</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terminos" className="hover:text-white transition-colors">Términos y condiciones</Link></li>
              <li><Link to="/privacidad" className="hover:text-white transition-colors">Política de privacidad</Link></li>
              <li><Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm">© 2026 PorteManía. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-sm">
            <span>🇪🇸 España</span>
            <span>🇵🇹 Portugal</span>
            <span>🇫🇷 Francia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}