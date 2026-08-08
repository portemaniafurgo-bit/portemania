import Link from "next/link";

/**
 * Captación de conductores.
 *
 * Los tres botones de Google Play que había aquí enlazaban a /ser-conductor y
 * la app de Android aún no existe: prometían una descarga imposible. Ahora el
 * llamamiento es al formulario real y la app se anuncia como lo que es,
 * próxima.
 */
const steps = [
  {
    num: "1",
    title: "Envía tu candidatura",
    desc: "Un formulario de dos minutos con tus datos y los de tu furgoneta.",
  },
  {
    num: "2",
    title: "Verificamos tu documentación",
    desc: "Carnet, DNI, seguro y alta de autónomo. Revisamos y te damos de alta.",
  },
  {
    num: "3",
    title: "Empieza a recibir servicios",
    desc: "Te avisamos de cada trabajo compatible con tu furgoneta en Albacete capital.",
  },
];

export default function DriversSection() {
  return (
    <section className="py-20 md:py-24 bg-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="bg-[#7145d6] rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none -rotate-12">
            <span className="material-symbols-outlined text-[350px] text-white">local_shipping</span>
          </div>

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/30">
              <span className="material-symbols-outlined text-xl">person_pin_circle</span>
              <span className="font-semibold text-sm uppercase tracking-wider">Conductores</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              ¿Tienes una furgoneta?
              <br />
              Únete a ClicyVoy
            </h2>
            <p className="text-lg md:text-xl text-white/90 leading-relaxed font-light">
              Trabaja con tu propio vehículo y decide cuándo estás disponible. Tú eliges los
              servicios que aceptas y cobras por cada uno, sin jornadas interminables ni rutas
              impuestas.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/ser-conductor"
                className="bg-white text-[#7145d6] font-semibold px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-lg"
              >
                Quiero ser conductor
              </Link>
              <span className="text-sm text-white/70">
                App Android para conductores · próximamente
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.num} className="bg-white rounded-3xl border border-gray-200 p-8">
              <div className="w-12 h-12 rounded-full bg-[#7145d6] text-white flex items-center justify-center font-bold text-xl shadow-md mb-5">
                {step.num}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
