"use client";

import dynamic from "next/dynamic";

// Leaflet accede a `window` al importarse: el mapa se carga solo en cliente.
const DriversMapInner = dynamic(
  () => import("@/components/landing/DriversMapSectionInner"),
  {
    ssr: false,
    loading: () => <div className="w-full h-[300px] md:h-[420px] bg-muted animate-pulse" />,
  }
);

export default function DriversMapSection() {
  return (
    <section className="w-full">
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-4 pb-4 md:pb-6 text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
          Conductores en tu zona
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
          Furgonetas disponibles ahora mismo en Albacete capital. Toca un conductor para solicitar tu transporte.
        </p>
      </div>
      <div className="w-full h-[300px] md:h-[420px]">
        <DriversMapInner />
      </div>
    </section>
  );
}