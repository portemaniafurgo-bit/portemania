"use client";

import dynamic from "next/dynamic";

// Leaflet accede a `window` al importarse: el mapa se carga solo en cliente.
// El encabezado queda fuera para que se sirva con SSR.
const DriversMapInner = dynamic(
  () => import("@/components/landing/DriversMapSectionInner"),
  {
    ssr: false,
    loading: () => <div className="w-full h-[420px] bg-muted animate-pulse" />,
  }
);

export default function DriversMapSection() {
  return (
    <section className="w-full">
      <div className="max-w-5xl mx-auto px-6 pt-4 pb-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
          Conductores en tu zona
        </h2>
        <p className="text-muted-foreground mt-2">
          Furgonetas disponibles ahora mismo en Albacete capital. Toca un conductor para solicitar tu transporte.
        </p>
      </div>
      <DriversMapInner />
    </section>
  );
}
