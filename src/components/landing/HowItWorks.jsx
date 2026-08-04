"use client";

import { motion } from "framer-motion";

const steps = [
  {
    num: "1",
    title: "Elige tu servicio",
    desc: "Selecciona si necesitas un porte sencillo, una mini mudanza, entrega para tu tienda o envío de paquetería.",
  },
  {
    num: "2",
    title: "Introduce detalles",
    desc: "Indica direcciones, si necesitas ayuda, si hay ascensor o paradas extra. Obtén tu precio cerrado al instante.",
  },
  {
    num: "3",
    title: "Transporte en camino",
    desc: "Un conductor verificado recogerá tu carga y la entregará de forma segura. Sigue el proceso y confirma la entrega.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 bg-[#7145d6] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(white 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-5xl font-black tracking-tight leading-tight">
              ¿Cómo funciona <br />
              <span className="text-purple-200">ClicYVoy?</span>
            </h2>
            <p className="text-xl text-white/90 font-light leading-relaxed">
              Portes, mini mudanzas y envío de paquetes al instante, desde tu móvil o PC. La solución más rápida y
              eficiente para mover lo que necesites.
            </p>
            <div className="space-y-6 mt-8">
              {steps.map((s) => (
                <div key={s.num} className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-white text-[#7145d6] flex items-center justify-center font-bold text-xl shrink-0 shadow-lg">
                    {s.num}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">{s.title}</h4>
                    <p className="text-white/80">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Visual block */}
          <div className="relative h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 hidden lg:block bg-black">
            <img
              alt="Logistics App"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAYdHVbyVmZwuZJK1W4IeeD5v6fj-f4IY_scrI-xHt2dWScHiA9kZXcp0KlbFBXuTYwg38yZhCYsc2Yvxb02D5ZrPVCrpcCxlmF9uLYKRp506oWyzUfgLWFOYNZOG0tZdYeLLHuRySnjuOxpF0O46UC5vbHDHSBI55F7yRke-FZitxWe3OtfMEC8SQHUU8wRjXtjPTR2Nqj2nv0vb9wSISQ9Nc-dvbXMIGlLbyV7Qj0DUay3HNHQ_gJw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#7145d6]/90 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-10 w-full">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="font-bold tracking-wider uppercase text-xs">Descarga nuestra APP</span>
                </div>
                <div className="text-2xl font-bold mt-2">Realiza un envío</div>
                <p className="text-white/80 text-sm">Únete a la flota líder en Albacete.</p>
                <img
                  alt="Disponible en Google Play"
                  className="w-32 mt-3"
                  src="https://lh3.googleusercontent.com/aida/AP1WRLvUoH8HwMMk8SP0tElc4_KCrEmHAfzAjsWbWIMgShUMl_WOQW9U4qGQonbdz49n-ECG9CBCj_MIAuxv7m_6z2afzLrt-5aIazw60K9AjZ6rfNsrtUbA0hOOR51DCaxtGmYiFNhb9krSgr4YHc9Wv1rhfu92jE2F8DDPU_mcqASN7dLqvzuhA2LRpOYBOPSCihdvfIZm56hP4xJzu7v6V9Pt5sasWkg24f3dPVRuoEAAr7wQG4BYFxQoh7k"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
