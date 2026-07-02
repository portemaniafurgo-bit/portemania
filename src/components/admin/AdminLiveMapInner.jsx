"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { vehicleData } from "@/components/common/VehicleCard";

const ALBACETE_CENTER = [38.9943, -1.8585];

// Icono de furgoneta: verde si está disponible, gris si no.
function driverIcon(available) {
  const color = available ? "#10b981" : "#94a3b8";
  return L.divIcon({
    html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🚐</div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function AdminLiveMapInner({ drivers = [] }) {
  const located = drivers.filter(d => d.current_lat && d.current_lng);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border z-0">
      <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-medium text-foreground shadow">
        {located.length} conductor{located.length === 1 ? "" : "es"} con posición
      </div>
      <MapContainer center={ALBACETE_CENTER} zoom={13} style={{ height: "360px", width: "100%", zIndex: 1 }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {located.map(d => (
          <Marker key={d.id} position={[d.current_lat, d.current_lng]} icon={driverIcon(d.is_available && d.status === "verified")}>
            <Popup>
              <div style={{ fontSize: 13 }}>
                <strong>{d.full_name}</strong>
                <br />{vehicleData[d.vehicle_type]?.name || d.vehicle_type || "Furgoneta"}
                {d.phone ? <><br />📞 {d.phone}</> : null}
                <br />{d.status === "verified" ? (d.is_available ? "🟢 Disponible" : "⚪ No disponible") : "⏳ Sin verificar"}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
