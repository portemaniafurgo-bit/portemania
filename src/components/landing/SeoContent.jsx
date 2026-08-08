import Link from "next/link";
import { serviceHref } from "@/lib/services";

/**
 * Bloque de texto indexable de la home: es el H1 de la página y el que enlaza
 * con las cuatro landings de servicio (refuerzo interno de enlazado).
 *
 * Componente de servidor a propósito: el texto tiene que estar en el HTML que
 * recibe el buscador, no aparecer después por hidratación.
 */
export default function SeoContent() {
  return (
    <section className="py-20 md:py-24 bg-gray-50 border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 mb-6 leading-tight">
          Portes, mini mudanzas, envío de paquetes y transporte con furgoneta en Albacete
        </h1>

        <div className="prose-clicyvoy space-y-5 text-gray-600 leading-relaxed">
          <p>
            En <strong>ClicyVoy</strong> puedes contratar una <strong>furgoneta con conductor en
            Albacete</strong> para hacer portes, mini mudanzas, recogidas en tiendas, transporte de
            paquetes y traslados de objetos voluminosos de forma rápida y completamente online. Ves
            el precio antes de reservar y sigues al conductor en tiempo real desde el móvil.
          </p>
          <p>
            También trabajamos con comercios que quieren entregar a sus clientes sin contratar
            personal propio. Si tienes una tienda —de electrodomésticos, muebles o cualquier
            producto voluminoso— puedes automatizar tus repartos con nosotros: cada entrega queda
            geolocalizada y firmada por quien la recibe.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 pt-4">Nuestros servicios</h2>
          <p>Realizamos distintos tipos de transporte adaptados a cada necesidad:</p>
          <ul className="space-y-2 list-disc list-inside marker:text-[#7145d6]">
            <li>
              <Link href={serviceHref("porte")} className="text-[#7145d6] hover:underline">
                Portes de muebles y electrodomésticos
              </Link>{" "}
              en Albacete capital.
            </li>
            <li>
              <Link href={serviceHref("mini_mudanza")} className="text-[#7145d6] hover:underline">
                Mini mudanzas
              </Link>{" "}
              para habitaciones, estudios y pisos pequeños.
            </li>
            <li>
              <Link href={serviceHref("porte_tienda")} className="text-[#7145d6] hover:underline">
                Recogidas y entregas en tiendas
              </Link>
              , para particulares y para comercios.
            </li>
            <li>Transporte de compras hechas en Wallapop o Facebook Marketplace.</li>
            <li>
              <Link href={serviceHref("paquete")} className="text-[#7145d6] hover:underline">
                Envío de paquetes en Albacete y Villarrobledo
              </Link>
              .
            </li>
            <li>Transporte de objetos grandes que no caben en un turismo.</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 pt-4">
            Reserva una furgoneta con conductor en minutos
          </h2>
          <p>
            Con ClicyVoy no necesitas alquilar una furgoneta ni conducir un vehículo grande. Los
            conductores usan su propia furgoneta y se encargan del transporte: tú solo indicas
            dónde recogemos y dónde entregamos. Durante la reserva puedes añadir la ayuda del
            conductor si el servicio lo requiere.
          </p>

          <h3 className="text-xl font-bold text-gray-900 pt-4">¿Por qué elegir ClicyVoy?</h3>
          <p>
            Cada vez más personas buscan una forma rápida de transportar una compra, hacer un
            traslado pequeño o mover objetos voluminosos sin esperar varios días. Con nosotros
            tienes:
          </p>
          <ul className="space-y-2 list-disc list-inside marker:text-[#7145d6]">
            <li>Reserva online en pocos minutos, sin llamadas ni presupuestos.</li>
            <li>Conductores verificados, con su documentación revisada.</li>
            <li>Precio transparente y cerrado antes de contratar.</li>
            <li>Seguimiento del conductor en tiempo real.</li>
            <li>Chat directo durante el servicio.</li>
            <li>Distintos tipos de transporte según lo que necesites mover.</li>
          </ul>
          <p>
            Además ofrecemos <strong>envío de paquetería urgente a Villarrobledo</strong>, con
            recogida en Albacete y entrega a domicilio en 24 horas.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 pt-4">
            El transporte que necesitas, cuando lo necesitas
          </h2>
          <p>
            Tanto si necesitas hacer un porte, una mini mudanza, recoger una compra en una tienda o
            enviar un paquete —como si eres un comercio que quiere externalizar sus entregas— en
            ClicyVoy encontrarás una forma rápida, cómoda y segura de resolverlo. Solicita tu
            servicio online y descubre otra manera de mover cosas grandes sin complicaciones.
          </p>
        </div>
      </div>
    </section>
  );
}
