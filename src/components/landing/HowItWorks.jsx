"use client";

import { motion } from "framer-motion";

const steps = [
  {
    num: "1",
    title: "Elige tu servicio",
    desc: "Porte, mini mudanza, compra en tienda o envío de paquete. Cada uno con su precio cerrado.",
  },
  {
    num: "2",
    title: "Reserva en dos minutos",
    desc: "Indicas recogida y entrega, subes una foto de la carga y ves el desglose del precio antes de confirmar. Sin llamadas ni presupuestos.",
  },
  {
    num: "3",
    title: "Sigue al conductor en directo",
    desc: "Un conductor verificado acepta tu servicio y lo ves avanzar en el mapa en tiempo real. Puedes escribirle por el chat durante todo el trayecto.",
  },
  {
    num: "4",
    title: "Recibe, firma y valora",
    desc: "En envíos de paquetes y entregas a tiendas se firma la recepción. Pagas con tarjeta o en efectivo al conductor, y después lo valoras.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 md:py-24 bg-[#7145d6] text-white relative overflow-hidden">
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
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              ¿Cómo funciona <br />
              <span className="text-purple-200">ClicyVoy?</span>
            </h2>
            <p className="text-lg md:text-xl text-white/90 font-light leading-relaxed">
              Portes, mini mudanzas y envío de paquetes al instante, desde el móvil o el ordenador.
              La forma más rápida de mover lo que necesites en Albacete.
            </p>

            <div className="space-y-6 mt-8">
              {steps.map((s, i) => (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.08, duration: 0.35 }}
                  className="flex gap-4"
                >
                  <div className="w-12 h-12 rounded-full bg-white text-[#7145d6] flex items-center justify-center font-bold text-xl shrink-0 shadow-lg">
                    {s.num}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{s.title}</h3>
                    <p className="text-white/80">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative h-[560px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 hidden lg:block bg-black">
            <img
              alt="Conductor de ClicyVoy realizando un porte en Albacete"
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAYdHVbyVmZwuZJK1W4IeeD5v6fj-f4IY_scrI-xHt2dWScHiA9kZXcp0KlbFBXuTYwg38yZhCYsc2Yvxb02D5ZrPVCrpcCxlmF9uLYKRp506oWyzUfgLWFOYNZOG0tZdYeLLHuRySnjuOxpF0O46UC5vbHDHSBI55F7yRke-FZitxWe3OtfMEC8SQHUU8wRjXtjPTR2Nqj2nv0vb9wSISQ9Nc-dvbXMIGlLbyV7Qj0DUay3HNHQ_gJw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#7145d6]/90 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 p-10 w-full">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="font-bold tracking-wider uppercase text-xs">
                    Seguimiento en tiempo real
                  </span>
                </div>
                <p className="text-2xl font-bold mt-2">Sabes dónde está tu envío</p>
                <p className="text-white/80 text-sm mt-1">
                  Mapa en vivo, chat con el conductor y aviso en cada cambio de estado.
                </p>
                {/* La app de Android llega en la siguiente fase: hasta entonces no
                    se anuncia una descarga que todavía no existe. */}
                <p className="inline-flex items-center gap-2 mt-4 text-xs font-semibold uppercase tracking-wider bg-white/15 border border-white/25 rounded-full px-3 py-1.5">
                  App Android · próximamente
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
