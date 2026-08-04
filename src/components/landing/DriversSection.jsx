import Link from "next/link";

export default function DriversSection() {
  return (
    <section className="py-24 bg-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="bg-[#7145d6] rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none transform -rotate-12">
            <span className="material-symbols-outlined text-[350px] text-white">local_shipping</span>
          </div>
          <div className="flex-1 space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-sm border border-white/30">
              <span className="material-symbols-outlined text-xl">person_pin_circle</span>
              <span className="font-semibold text-sm uppercase tracking-wider">Conductores</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">¿Tienes una furgoneta?<br />Únete a ClicYVoy</h2>
            <p className="text-lg md:text-xl text-white/90 leading-relaxed max-w-2xl font-light">Convierte tu vehículo en una fuente de ingresos. Descarga nuestra app para conductores y empieza hoy mismo en Albacete.</p>
            <div className="pt-4">
              <Link href="/ser-conductor">
                <img alt="Disponible en Google Play" className="w-40 hover:scale-105 transition-transform" src="https://lh3.googleusercontent.com/aida/AP1WRLshCvwSEgJi7T4aWfDvai3hiy-1ayVW6vXhw1mQ9KSXJOBIAjTwA5HoqZyTce4PX30DuIY_k3hgA0OXV5tXaC1CSraly1d6PX86A7l_x9GEfrzAcKt1O9dY3nEtYYoBY0pgLoVWNe4xf85z2Wu4IyLP-Hk6---SdhgVPAgdERegmeWT5xbvMP7ZVjdiad0mGGUSMoA_CFhpbtiCBQXQdzEJBT7dkBspfD19bhjza93BaFY9WgmGv8H58xDb" />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-xl">
            <img alt="Conductor profesional en Albacete" className="absolute inset-0 w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtwekFpEHYnau7Pov4naXBItzP0kjWUFrRTR8OkZzu8IX7-HGCAAhfKHcaDvRayrnEE-OLeTEgC8RLf8u9HV6moMlDHBzlT7PdztDm5H8ekQVueafftnaWibfUhpPjoVImZcd_nkouz0MfdEt6V--7Yq-AKp3x-yViQbcyoxr0atWK50z9Z-GleT94DT_Wtg4Nz9nOZoRcUo6XxpPKtu2EdtqY5f_uGA9glcsYyO0SulX0Te_BZQyq0Q" />
          </div>
          <div className="space-y-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-8">Pasos para ganar dinero</h3>
            {[ { num: "1", title: "Descarga la app", desc: "" }, { num: "2", title: "Regístrate", desc: "Completa tu perfil y los datos de tu vehículo." }, { num: "3", title: "Recibe tu primera solicitud", desc: "Empieza a aceptar pedidos en Albacete capital." } ].map((s) => (
              <div key={s.num} className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[#7145d6] text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-md">{s.num}</div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{s.title}</h4>
                  {s.desc && <p className="text-gray-500">{s.desc}</p>}
                  {s.num === "1" && <img alt="Google Play" className="w-40 mt-3" src="https://lh3.googleusercontent.com/aida/AP1WRLshCvwSEgJi7T4aWfDvai3hiy-1ayVW6vXhw1mQ9KSXJOBIAjTwA5HoqZyTce4PX30DuIY_k3hgA0OXV5tXaC1CSraly1d6PX86A7l_x9GEfrzAcKt1O9dY3nEtYYoBY0pgLoVWNe4xf85z2Wu4IyLP-Hk6---SdhgVPAgdERegmeWT5xbvMP7ZVjdiad0mGGUSMoA_CFhpbtiCBQXQdzEJBT7dkBspfD19bhjza93BaFY9WgmGv8H58xDb" />}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-8 md:p-12">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Mismo ingreso, más libertad.</h2>
              <p className="text-lg text-gray-500">Tú decides cuándo termina tu jornada. Optimiza tu tiempo con nuestro modelo directo.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
              <div className="bg-neutral-100 p-8 rounded-3xl border-2 border-neutral-200 shadow-inner flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6"><span className="text-lg font-bold text-neutral-500 uppercase tracking-widest">Tradicional</span><span className="text-xl font-black text-neutral-600">10-12 Horas</span></div>
                  <div className="space-y-3"><div className="w-full bg-neutral-300 h-6 rounded-lg overflow-hidden relative"><div className="bg-neutral-500 h-full w-full" /></div><div className="flex justify-between text-xs text-neutral-400 font-bold"><span>0h</span><span>4h</span><span>8h</span><span>12h</span></div></div>
                </div>
                <div className="mt-8 pt-6 border-t border-neutral-200"><p className="text-sm text-neutral-500 leading-relaxed font-medium">Jornadas interminables, rutas prefijadas y múltiples paradas para alcanzar un salario base digno.</p></div>
              </div>
              <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between group transition-all duration-300 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-[#7145d6]" />
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(white 0.8px, transparent 0.8px)", backgroundSize: "16px 16px" }} />
                <div className="absolute inset-0 backdrop-blur-md bg-white/5 border border-white/20" />
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-white text-2xl">bolt</span><span className="text-lg font-bold text-white uppercase tracking-widest">ClicYVoy</span></div><span className="text-2xl font-black text-white">~4 Horas</span></div>
                  <div className="space-y-3"><div className="w-full bg-white/10 h-6 rounded-lg overflow-hidden relative border border-white/20"><div className="bg-white h-full w-1/3 shadow-[0_0_20px_rgba(255,255,255,0.5)]" /></div><div className="flex justify-between text-xs text-white/60 font-bold"><span>0h</span><span>4h</span><span className="opacity-30">8h</span><span className="opacity-30">12h</span></div></div>
                </div>
                <div className="relative z-10 mt-8 pt-6 border-t border-white/10"><p className="text-sm text-white/90 leading-relaxed font-semibold">3 Portes rápidos seleccionados por ti. Gana lo mismo en la mitad de tiempo y vuelve antes a casa.</p></div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-6">
              <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Comienza tu nueva etapa</p>
              <Link href="/ser-conductor"><img alt="Google Play" className="w-48 hover:scale-105 transition-transform" src="https://lh3.googleusercontent.com/aida/AP1WRLshCvwSEgJi7T4aWfDvai3hiy-1ayVW6vXhw1mQ9KSXJOBIAjTwA5HoqZyTce4PX30DuIY_k3hgA0OXV5tXaC1CSraly1d6PX86A7l_x9GEfrzAcKt1O9dY3nEtYYoBY0pgLoVWNe4xf85z2Wu4IyLP-Hk6---SdhgVPAgdERegmeWT5xbvMP7ZVjdiad0mGGUSMoA_CFhpbtiCBQXQdzEJBT7dkBspfD19bhjza93BaFY9WgmGv8H58xDb" /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
