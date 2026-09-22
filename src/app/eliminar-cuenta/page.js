export const metadata = {
  title: "Eliminar tu cuenta — ClicyVoy",
};

// Página pública EXIGIDA por Google Play: toda app que permite crear cuenta
// tiene que publicar una URL donde se explique cómo borrarla, accesible sin
// iniciar sesión. Se declara en Play Console → Seguridad de los datos.
// Mismo correo de contacto que la política de privacidad.
const CONTACT_EMAIL = "portemaniafurgo@gmail.com";

export default function EliminarCuentaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Eliminar tu cuenta de ClicyVoy</h1>
        <p className="text-sm text-muted-foreground mt-2">Última actualización: septiembre de 2026</p>
      </div>

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puede eliminar su cuenta de ClicyVoy cuando quiera, sin dar explicaciones y sin coste. Esta página vale tanto para los <strong>clientes</strong> como para los <strong>conductores</strong>, y da igual si se registró desde la aplicación Android (<strong>ClicyVoy</strong>, paquete <code>com.clicyvoy.app</code>) o desde la web <strong>https://clicyvoy.es</strong>: la cuenta es la misma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Desde la app (inmediato)</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Es la forma más rápida: el borrado se ejecuta en el momento, sin esperas ni intermediarios.
        </p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Abra la aplicación de ClicyVoy con su cuenta iniciada.</li>
          <li>Entre en la pestaña <strong>Perfil</strong>.</li>
          <li>Pulse <strong>«Eliminar mi cuenta»</strong>, al final de la pantalla.</li>
          <li>Pulse <strong>«Borrar definitivamente»</strong> y confirme en el aviso que aparece.</li>
        </ol>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El borrado es <strong>inmediato e irreversible</strong>: al terminar se cierra la sesión automáticamente y ya no se puede volver a entrar con esas credenciales. Si es conductor y tiene un servicio en curso, la app no le dejará borrarla hasta terminarlo o cancelarlo: hay un cliente esperando.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Desde la web</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          La web de ClicyVoy todavía no incluye el botón de borrado: el borrado automático vive solo en la aplicación. Si no usa la app, solicítelo por correo (apartado siguiente) y lo hacemos nosotros.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Por correo electrónico</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Escriba a <a href={`mailto:${CONTACT_EMAIL}?subject=Baja%20de%20cuenta`} className="text-primary hover:underline">{CONTACT_EMAIL}</a> <strong>desde la misma dirección de correo con la que se registró</strong> (así comprobamos que la cuenta es suya) y ponga como asunto <strong>«Baja de cuenta»</strong>.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Atendemos la solicitud en un <strong>máximo de 30 días</strong> —normalmente en mucho menos— y le confirmamos por correo cuando la cuenta ya esté eliminada.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Qué se elimina y qué se conserva</h2>
        <p className="text-sm font-medium text-foreground">Se elimina:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Su perfil y sus credenciales de acceso.</li>
          <li>Sus datos personales: nombre, correo electrónico, teléfono y direcciones.</li>
          <li>La documentación del conductor (documento de identidad, carnet, seguro, fotos del vehículo y justificantes).</li>
          <li>Los tokens de notificaciones de sus dispositivos: deja de recibir avisos al instante.</li>
          <li>Los mensajes de chat de sus servicios.</li>
        </ul>
        <p className="text-sm font-medium text-foreground mt-2">Se conserva:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Los <strong>servicios ya realizados, de forma anonimizada</strong> (importe, fecha y trayecto, sin datos que permitan identificarle): son la base de nuestra facturación y la ley obliga a conservarlos.</li>
          <li>En el caso de los conductores, los datos que exige la normativa fiscal y laboral durante los plazos legales de conservación, tal y como se detalla en la <a href="/privacidad" className="text-primary hover:underline">Política de Privacidad</a>.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold text-foreground">Más información</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Puede consultar cómo tratamos sus datos en la <a href="/privacidad" className="text-primary hover:underline">Política de Privacidad</a> y las condiciones del servicio en los <a href="/terminos" className="text-primary hover:underline">Términos y Condiciones</a>. Para cualquier duda, escríbanos a <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}
