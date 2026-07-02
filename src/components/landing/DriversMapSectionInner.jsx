"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/entities";
import { useAuth } from "@/lib/AuthContext";
import { vehicleData } from "@/components/common/VehicleCard";
import AccessModal from "@/components/landing/AccessModal";

// Zona de servicio: Albacete capital (CP 02001–02008).
const ALBACETE_CENTER = [38.9943, -1.8585];
const ZONE_BOUNDS = [
  [38.945, -1.91], // suroeste
  [39.03, -1.81], // noreste
];
const REFRESH_MS = 30000;

const driverIcon = L.divIcon({
  html: `
    <style>
      @keyframes landingDriverPulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
    </style>
    <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;animation:landingDriverPulse 1.5s ease-out infinite;"></div>
      <div style="background:#3b82f6;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;position:relative;z-index:1;">🚐</div>
    </div>`,
  className: "",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const visitorIcon = L.divIcon({
  html: `<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(16,185,129,0.25), 0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Dentro de la zona → true (el mapa siempre se queda en Albacete capital).
function inZone([lat, lng]) {
  return (
    lat >= ZONE_BOUNDS[0][0] && lat <= ZONE_BOUNDS[1][0] &&
    lng >= ZONE_BOUNDS[0][1] && lng <= ZONE_BOUNDS[1][1]
  );
}

function PanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position, { animate: true });
  }, [map, position]);
  return null;
}

export default function DriversMapSectionInner() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [visitorPos, setVisitorPos] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Conductores públicos (RPC anónima, posiciones ya saneadas a la zona 02001–02008)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_public_drivers");
      if (!error && active) setDrivers(data || []);
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Geoposición del visitante: si está dentro de la zona, centramos ahí.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude];
        if (inZone(pos)) setVisitorPos(pos);
      },
      () => {}, // denegado o sin señal: se queda el centro de Albacete
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const handleDriverClick = () => {
    if (isAuthenticated) {
      router.push("/new-request");
    } else {
      setShowModal(true);
    }
  };

  return (
    <div className="w-full">
      {/* z-0 crea un stacking context propio: los controles internos de Leaflet
          (z-index 1000) no se montan sobre el navbar ni sobre los modales. */}
      <div className="relative w-full z-0">
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-medium text-foreground shadow flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {drivers.length} conductor{drivers.length === 1 ? "" : "es"} disponible{drivers.length === 1 ? "" : "s"} · CP 02001–02008
        </div>
        <MapContainer
          center={visitorPos || ALBACETE_CENTER}
          zoom={14}
          minZoom={13}
          style={{ height: "420px", width: "100%", zIndex: 1 }}
          maxBounds={ZONE_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {visitorPos && (
            <>
              <PanTo position={visitorPos} />
              <Marker position={visitorPos} icon={visitorIcon}>
                <Tooltip direction="top" offset={[0, -10]}>Estás aquí</Tooltip>
              </Marker>
            </>
          )}
          {drivers.map((d) => (
            <Marker
              key={d.id}
              position={[d.lat, d.lng]}
              icon={driverIcon}
              eventHandlers={{ click: handleDriverClick }}
            >
              <Tooltip direction="top" offset={[0, -22]}>
                {d.name} · {vehicleData[d.vehicle_type]?.name || "Furgoneta"} — toca para solicitar
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <AccessModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
