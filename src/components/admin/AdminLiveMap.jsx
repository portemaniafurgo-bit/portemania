"use client";

import dynamic from "next/dynamic";

// Leaflet solo en cliente (accede a window al importarse).
const AdminLiveMapInner = dynamic(
  () => import("@/components/admin/AdminLiveMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl overflow-hidden border border-border h-[360px] bg-muted animate-pulse" />
    ),
  }
);

export default function AdminLiveMap(props) {
  return <AdminLiveMapInner {...props} />;
}
