"use client";

import dynamic from "next/dynamic";

// Leaflet accede a `window` al importarse, así que cargamos el mapa solo en
// cliente (sin SSR). Mantiene la API original: <DriverTrackingMap .../>
const DriverTrackingMapInner = dynamic(
  () => import("@/components/common/DriverTrackingMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl overflow-hidden border border-border h-[220px] bg-muted animate-pulse" />
    ),
  }
);

export default function DriverTrackingMap(props) {
  return <DriverTrackingMapInner {...props} />;
}
