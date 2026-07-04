export const metadata = {
  title: "Política de Privacidad — ClicyVoy",
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Política de Privacidad</h1>
        <p className="text-sm text-muted-foreground mt-2">Última actualización: junio de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">1. Responsable del tratamiento</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El responsable del tratamiento de los datos personales recogidos a través de esta plataforma es <strong>ClicyVoy</strong>, con sede en Albacete, España. Para cualquier consulta relacionada con la privacidad, puede contactar a través del correo indicado en la plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">2. Datos que recopilamos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Recopilamos los siguientes datos según el tipo de usuario:</p>
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
          <li>Documento de identidad y seguro del vehículo</li>
          <li>Historial de servicios, valoraciones y ganancias</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">3. Finalidad del tratamiento</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Gestionar el registro y autenticación de usuarios</li>
          <li>Procesar y coordinar solicitudes de transporte</li>
          <li>Notificar a conductores de nuevos trabajos disponibles por correo electrónico</li>
          <li>Procesar pagos de forma segura</li>
          <li>Gestionar incidencias y resolución de conflictos</li>
          <li>Mejorar el servicio mediante análisis internos</li>
          <li>Cumplir con obligaciones legales</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">4. Base jurídica</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El tratamiento de los datos se basa en la ejecución del contrato de servicio (Art. 6.1.b RGPD), el cumplimiento de obligaciones legales (Art. 6.1.c RGPD) y, cuando corresponda, el consentimiento del usuario (Art. 6.1.a RGPD).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">5. Conservación de datos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Los datos se conservan durante el tiempo necesario para prestar el servicio y, posteriormente, durante los plazos legalmente exigibles. Los datos de conductores se conservan mientras la cuenta esté activa y hasta 5 años tras su baja para fines de auditoría.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">6. Derechos del usuario</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Conforme al RGPD, puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad de sus datos contactando con nosotros a través de la plataforma. También puede presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">7. Transferencias internacionales</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Algunos servicios de infraestructura utilizados por ClicyVoy pueden implicar transferencias de datos fuera del Espacio Económico Europeo. En tal caso, nos aseguramos de que existan garantías adecuadas conforme al RGPD.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">8. Seguridad</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aplicamos medidas técnicas y organizativas apropiadas para proteger sus datos contra acceso no autorizado, pérdida o destrucción, incluyendo cifrado en tránsito y en reposo.
        </p>
      </section>
    </div>
  );
}
