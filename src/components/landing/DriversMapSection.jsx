"use client";

import dynamic from "next/dynamic";

// Leaflet accede a `window` al importarse: solo en cliente (sin SSR).
const DriversMapSectionInner = dynamic(
  () => import("@/components/landing/DriversMapSectionInner"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[420px] bg-muted animate-pulse" />
    ),
  }
);

export default function DriversMapSection() {
  return <DriversMapSectionInner />;
}
