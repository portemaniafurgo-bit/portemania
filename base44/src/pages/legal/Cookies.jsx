export default function Cookies() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Política de Cookies</h1>
        <p className="text-sm text-muted-foreground mt-2">Última actualización: junio de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">¿Qué son las cookies?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas una página web. Permiten recordar tus preferencias, mantener tu sesión activa y analizar el uso de la plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Cookies que utilizamos</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Tipo</th>
                <th className="text-left py-2 pr-4 font-semibold text-foreground">Finalidad</th>
                <th className="text-left py-2 font-semibold text-foreground">Duración</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium text-foreground">Técnicas / esenciales</td>
                <td className="py-3 pr-4">Mantener la sesión iniciada y el funcionamiento básico de la plataforma.</td>
                <td className="py-3">Sesión</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium text-foreground">Autenticación</td>
                <td className="py-3 pr-4">Recordar que el usuario ha iniciado sesión como cliente o conductor.</td>
                <td className="py-3">7 días</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-4 font-medium text-foreground">Preferencias</td>
                <td className="py-3 pr-4">Guardar ajustes de visualización y preferencias del usuario.</td>
                <td className="py-3">1 año</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-foreground">Analíticas</td>
                <td className="py-3 pr-4">Medir el uso de la plataforma de forma anónima para mejorar el servicio.</td>
                <td className="py-3">13 meses</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Cookies de terceros</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          PorteManía utiliza servicios de terceros que pueden instalar sus propias cookies:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Stripe</strong> — procesamiento de pagos con tarjeta. Consulta su política en <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">stripe.com/es/privacy</a>.</li>
          <li><strong>Google (OAuth)</strong> — inicio de sesión con cuenta de Google. Consulta su política en <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">policies.google.com/privacy</a>.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Gestión de cookies</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puedes configurar tu navegador para rechazar o eliminar cookies en cualquier momento. Ten en cuenta que deshabilitar las cookies técnicas puede afectar al funcionamiento de la plataforma, impidiendo el inicio de sesión o el uso de ciertas funciones.
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" target="_blank" rel="noopener noreferrer" className="text-primary underline">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary underline">Safari</a></li>
          <li><a href="https://support.microsoft.com/es-es/windows/eliminar-y-administrar-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" rel="noopener noreferrer" className="text-primary underline">Microsoft Edge</a></li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Contacto</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para cualquier consulta sobre el uso de cookies en PorteManía, puedes contactarnos a través de la plataforma.
        </p>
      </section>
    </div>
  );
}