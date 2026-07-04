export const metadata = {
  title: "Términos y Condiciones — ClicyVoy",
};

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Términos y Condiciones</h1>
        <p className="text-sm text-muted-foreground mt-2">Última actualización: junio de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">1. Objeto del servicio</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ClicyVoy es una plataforma digital que conecta a particulares y empresas con conductores autónomos verificados para la realización de servicios de transporte de mercancías y mudanzas dentro del municipio de <strong>Albacete capital</strong> (códigos postales 02001–02008). ClicyVoy actúa únicamente como intermediario y no es parte del contrato de transporte entre el cliente y el conductor.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">2. Ámbito geográfico</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El servicio opera exclusivamente en Albacete capital. No se aceptan solicitudes con origen o destino fuera de los códigos postales indicados. El sistema valida automáticamente el código postal de las direcciones introducidas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">3. Tipos de vehículo y precios</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ClicyVoy ofrece tres tipos de furgoneta:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Furgoneta pequeña</strong> — 40 € las primeras 2 horas</li>
          <li><strong>Furgoneta grande</strong> — 60 € las primeras 2 horas</li>
          <li><strong>Ayuda del conductor</strong> (subir/bajar mercancía) — suplemento de 30 €</li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cada hora adicional se factura a <strong>15 €/hora</strong>. El seguro opcional de mercancía tiene un coste de 12 €. Los precios incluyen IVA.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">4. Condiciones de recogida y entrega</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Todos los servicios son <strong>a pie de calle (curbside)</strong>. El conductor no está obligado a subir a pisos, áticos, sótanos ni realizar ningún tipo de montaje o desmontaje de muebles. La mercancía debe estar accesible en la puerta del edificio o en planta baja en el momento de la recogida.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">5. Obligaciones del cliente</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Proporcionar información veraz sobre la mercancía y las direcciones.</li>
          <li>Subir al menos una fotografía de la mercancía antes de confirmar la solicitud.</li>
          <li>Tener la mercancía lista y accesible a la hora acordada.</li>
          <li>No transportar artículos ilegales, peligrosos o prohibidos por la normativa vigente.</li>
          <li>Abonar el precio del servicio según el método de pago seleccionado.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">6. Conductores verificados</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Todos los conductores de ClicyVoy pasan por un proceso de verificación de identidad, licencia de conducción y seguro del vehículo antes de ser activados en la plataforma. ClicyVoy no garantiza la disponibilidad inmediata de conductores en todo momento.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">7. Cancelaciones</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El cliente puede cancelar una solicitud mientras esté en estado <em>pendiente</em> (sin conductor asignado) sin coste alguno. Una vez aceptada por un conductor, la cancelación puede implicar cargos según la política vigente en el momento del servicio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">8. Responsabilidad</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ClicyVoy no se responsabiliza de daños a la mercancía salvo que se haya contratado el seguro opcional. En caso de incidencia, el cliente debe reportarla a través de la plataforma en un plazo máximo de 24 horas tras la entrega. El seguro cubre hasta el valor declarado de los bienes transportados, sujeto a las condiciones del asegurador.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">9. Modificaciones</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ClicyVoy se reserva el derecho a modificar estos términos en cualquier momento. Los cambios serán comunicados a los usuarios registrados por correo electrónico con un preaviso mínimo de 15 días.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">10. Legislación aplicable</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de Albacete.
        </p>
      </section>
    </div>
  );
}
