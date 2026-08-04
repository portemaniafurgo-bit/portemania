export const metadata = {
  title: "Política de Privacidad — ClicyVoy",
};

// Correo de contacto público (privacidad y verificación de Google OAuth).
// Cambiar aquí si el negocio usa otra dirección.
const CONTACT_EMAIL = "portemaniafurgo@gmail.com";

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mt-2">Última actualización: julio de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">1. Responsable del tratamiento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El responsable del tratamiento de los datos personales recogidos a través de esta plataforma es <strong>ClicyVoy</strong>, con sede en Albacete, España. La plataforma está disponible en <strong>https://clicyvoy.es</strong>. Para cualquier consulta relacionada con la privacidad o el ejercicio de sus derechos, puede escribir a <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">2. Datos que recopilamos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Recopilamos los siguientes datos según el tipo de usuario. Los datos se obtienen directamente del usuario al registrarse o usar la plataforma y, si elige iniciar sesión con Google, de su cuenta de Google (ver apartado 3):</p>
        <p className="text-sm font-medium text-foreground mt-2">Clientes:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Nombre completo y correo electrónico (registro)</li>
          <li>Número de teléfono</li>
          <li>Direcciones de recogida y entrega</li>
          <li>Fotografías de la mercancía</li>
          <li>Datos de pago (gestionados de forma segura por Stripe; no almacenamos datos de tarjeta)</li>
          <li>Historial de servicios y valoraciones</li>
        </ul>
        <p className="text-sm font-medium text-foreground mt-2">Conductores:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Nombre, email y teléfono</li>
          <li>Fotografía de perfil</li>
          <li>Número de licencia de conducción y documentación del vehículo</li>
          <li>Documento de identidad, seguro del vehículo, recibo de autónomo y situación censal</li>
          <li>Historial de servicios, valoraciones y ganancias</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">3. Inicio de sesión con Google</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Si elige la opción «Continuar con Google» para registrarse o iniciar sesión, Google nos comunica únicamente la información básica de su perfil: su <strong>nombre</strong>, su <strong>dirección de correo electrónico</strong> y su <strong>foto de perfil</strong>. Usamos estos datos con la <strong>única finalidad</strong> de crear y autenticar su cuenta en ClicyVoy e identificarle dentro de la plataforma.
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>No accedemos a ningún otro dato de su cuenta de Google (contactos, Gmail, Google Drive, calendario, ubicación, etc.).</li>
          <li>No vendemos ni cedemos esta información a terceros con fines publicitarios ni de ningún otro tipo.</li>
          <li>Solo la compartimos con los proveedores estrictamente necesarios para operar la plataforma (ver apartado 6).</li>
          <li>Puede revocar el acceso en cualquier momento desde la configuración de seguridad de su cuenta de Google (myaccount.google.com → Seguridad → Conexiones con terceros).</li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El uso y la transferencia de la información recibida de las APIs de Google se ajustan a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Política de Datos de Usuario de los Servicios de las APIs de Google</a>, incluidos sus requisitos de Uso Limitado (<em>Limited Use</em>).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">4. Finalidad del tratamiento</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Gestionar el registro y autenticación de usuarios (incluido el inicio de sesión con Google)</li>
          <li>Procesar y coordinar solicitudes de transporte</li>
          <li>Notificar a conductores de nuevos trabajos disponibles por correo electrónico</li>
          <li>Procesar pagos de forma segura</li>
          <li>Gestionar incidencias y resolución de conflictos</li>
          <li>Mejorar el servicio mediante análisis internos</li>
          <li>Cumplir con obligaciones legales</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">5. Base jurídica</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El tratamiento de los datos se basa en la ejecución del contrato de servicio (Art. 6.1.b RGPD), el cumplimiento de obligaciones legales (Art. 6.1.c RGPD) y, cuando corresponda, el consentimiento del usuario (Art. 6.1.a RGPD). El inicio de sesión con Google se basa en su consentimiento, otorgado en la pantalla de autorización de Google.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">6. Proveedores y encargados del tratamiento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para prestar el servicio recurrimos a proveedores que tratan datos por cuenta de ClicyVoy, bajo las garantías exigidas por el RGPD:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Google</strong> — autenticación con «Continuar con Google» (inicio de sesión).</li>
          <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento de documentos.</li>
          <li><strong>Stripe</strong> — procesamiento de pagos con tarjeta (no almacenamos datos de tarjeta).</li>
          <li><strong>Resend</strong> — envío de correos transaccionales (invitaciones, avisos, recuperación de contraseña).</li>
          <li><strong>Vercel</strong> — alojamiento de la aplicación web.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">7. Conservación de datos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Los datos se conservan durante el tiempo necesario para prestar el servicio y, posteriormente, durante los plazos legalmente exigibles. Los datos de conductores se conservan mientras la cuenta esté activa y hasta 5 años tras su baja para fines de auditoría. Si elimina su cuenta, los datos obtenidos a través de Google (nombre, email y foto) se suprimen junto con el resto de datos de la cuenta, salvo obligación legal de conservación.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">8. Derechos del usuario</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conforme al RGPD, puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad de sus datos escribiendo a <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>. También puede presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">9. Transferencias internacionales</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Algunos servicios de infraestructura utilizados por ClicyVoy pueden implicar transferencias de datos fuera del Espacio Económico Europeo. En tal caso, nos aseguramos de que existan garantías adecuadas conforme al RGPD (cláusulas contractuales tipo u otros mecanismos válidos).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">10. Seguridad</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aplicamos medidas técnicas y organizativas apropiadas para proteger sus datos contra acceso no autorizado, pérdida o destrucción, incluyendo cifrado en tránsito y en reposo. Los documentos de identidad y de los conductores se almacenan en un espacio privado accesible solo mediante enlaces firmados de acceso restringido.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">11. Contacto</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para cualquier cuestión sobre esta Política de Privacidad o el tratamiento de sus datos, puede contactar con ClicyVoy en <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}
