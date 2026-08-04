"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { buildRequestHref } from "@/lib/requestIntent";

export default function ServicesSection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const go = (service, vehicle = null) => {
    const path = isAuthenticated ? "/new-request" : "/solicitar";
    router.push(buildRequestHref(path, { service, vehicle }));
  };

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div onClick={() => go("mini_mudanza", "large")} className="group relative bg-[#7145d6] rounded-3xl p-8 shadow-2xl overflow-hidden text-white transition-transform hover:-translate-y-2 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 p-6 opacity-20 transform translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-500"><span className="material-symbols-outlined text-[120px]">home</span></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full w-fit mb-6 border border-white/30"><span className="material-symbols-outlined">local_shipping</span><span className="font-bold tracking-wide uppercase text-sm">Furgoneta Grande</span></div>
              <h3 className="text-4xl font-bold mb-2">Mini Mudanza</h3>
              <p className="text-white/80 text-lg mb-8">2 horas incluidas. Tu mudanza en Albacete en minutos.</p>
              <div className="flex items-end gap-2 mb-8"><span className="text-5xl font-black">99€</span><span className="text-white/70 mb-1">/ 2h inc.</span></div>
              <ul className="space-y-4 mb-8 flex-1"><li className="flex items-start gap-3 bg-white/10 p-3 rounded-xl border border-white/20"><span className="material-symbols-outlined shrink-0 mt-0.5">group_add</span><div><strong className="block">Ayuda del Conductor (+39€)</strong><span className="text-sm text-white/80">Trabajo colaborativo: el cliente debe ayudar.</span></div></li></ul>
              <div className="bg-black/20 p-4 rounded-xl text-center text-sm backdrop-blur-sm border border-white/10 mt-auto">Si no se solicita ayuda: <strong>Recogida y entrega a pie de calle.</strong></div>
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <div onClick={() => go("porte", "small")} className="bg-gray-50 rounded-3xl p-8 border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 text-[#7145d6]"><span className="material-symbols-outlined text-3xl">local_shipping</span></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Porte</h3>
                <p className="text-gray-500 mb-6">Entrega máxima en 2 horas, seguimiento en tiempo real.</p>
                <div className="flex items-end gap-2 mb-6"><span className="text-4xl font-black text-[#7145d6]">40€</span><span className="text-gray-500 font-medium mb-1">tarifa plana</span></div>
              </div>
              <div className="bg-white p-4 rounded-xl text-sm text-gray-500 shadow-sm border border-gray-100"><div className="flex items-start gap-3"><span className="material-symbols-outlined text-[#7145d6] shrink-0">info</span><p>Recogida a pie de calle solamente.</p></div></div>
            </div>
            <div onClick={() => go("compra_tienda")} className="bg-[#1a1b20] text-white rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col justify-between cursor-pointer">
              <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6"><div className="w-14 h-14 bg-[#7145d6] rounded-2xl flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-3xl">shopping_bag</span></div></div>
                <h3 className="text-2xl font-bold mb-2">Compra en tienda</h3>
                <p className="text-white/70 mb-6">Tú compras, nosotros te lo llevamos (Entrega y subida).</p>
                <div className="flex items-end gap-2 mb-6"><span className="text-3xl font-black">30€</span><span className="text-white/60 font-medium mb-1">/ servicio</span></div>
                <ul className="space-y-3 text-sm text-white/80 mt-auto"><li className="flex items-center gap-2"><span className="material-symbols-outlined text-[#7145d6] text-xl">check_circle</span>Incluye entrega y subida a domicilio</li></ul>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-3xl p-1 shadow-md hover:shadow-xl transition-shadow">
            <div onClick={() => go("envio_paquete")} className="bg-white rounded-[23px] p-8 h-full relative overflow-hidden flex flex-col md:flex-row items-center gap-8 cursor-pointer">
              <div className="absolute -right-12 top-8 rotate-45 bg-[#7145d6] text-white py-1 px-14 font-bold text-sm shadow-lg text-center">PREMIUM</div>
              <div className="md:w-1/3 flex flex-col items-center text-center md:items-start md:text-left border-b md:border-b-0 md:border-r border-gray-200 pb-6 md:pb-0 md:pr-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-[#7145d6] mb-4"><span className="material-symbols-outlined text-4xl">speed</span></div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Envío de paquete</h3>
                <p className="text-gray-500">Recogida y entrega de paquetes urgente, entrega garantizada en 2 horas.</p>
              </div>
              <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                <div className="bg-white p-6 rounded-2xl border-2 border-purple-400 relative shadow-md">
                  <div className="absolute -top-3 -left-3 bg-[#7145d6] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse">URGENTE</div>
                  <h4 className="font-bold text-lg mb-2 text-gray-900 flex items-center gap-2"><span className="material-symbols-outlined text-[#7145d6]">schedule</span> Entrega 2h</h4>
                  <p className="text-sm text-gray-500 mb-4">Servicio prioritario en Albacete capital.</p>
                  <div className="text-3xl font-black text-[#7145d6]">Desde 4.99€</div>
                </div>
                <div className="flex flex-col justify-center gap-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-700"><span className="material-symbols-outlined text-sm">inventory_2</span></div><div><div className="font-bold text-sm">Seguimiento Real</div><div className="text-xs text-gray-500">Control total desde la app</div></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
