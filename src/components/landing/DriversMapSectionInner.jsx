"use client";

import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAvailableDrivers } from "@/lib/useDrivers";
import { vehicleData } from "@/components/common/VehicleCard";

const ALBACETE_CENTER = [38.9943, -1.8585];
const ZONE_BOUNDS = [
  [38.945, -1.91],
  [39.03, -1.81],
];

// Icono de conductor (furgoneta)
const driverIcon = L.divIcon({
  html: `
    <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;animation:pulse 1.5s ease-out infinite;"></div>
      <div style="background:#3b82f6;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;position:relative;z-index:1;">🚐</div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
    </style>
  `,
  className: "",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// Icono de visitante (usuario)
const visitorIcon = L.divIcon({
  html: `<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(16,185,129,0.25), 0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function inZone([lat, lng]) {
  return (
    lat >= ZONE_BOUNDS[0][0] &&
    lat <= ZONE_BOUNDS[1][0] &&
    lng >= ZONE_BOUNDS[0][1] &&
    lng <= ZONE_BOUNDS[1][1]
  );
}

function PanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position, { animate: true });
  }, [map, position]);
  return null;
}

export default function DriversMapSectionInner({ onDriverClick }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  // Misma consulta que alimenta el contador del hero: una sola cada 30 s.
  const { drivers } = useAvailableDrivers();
  const [visitorPos, setVisitorPos] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  // Forzar montaje: Leaflet solo puede montarse en cliente, tras el primer render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  // Forzar re-render del mapa después del montaje y en resize
  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => setMapKey((prev) => prev + 1), 100);
      return () => clearTimeout(timer);
    }
  }, [isMounted]);

  useEffect(() => {
    const handleResize = () => setMapKey((prev) => prev + 1);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Geolocalización
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude];
        if (inZone(pos)) setVisitorPos(pos);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  const handleDriverClick = () => {
    if (onDriverClick) {
      onDriverClick();
    } else if (isAuthenticated) {
      router.push("/new-request");
    } else {
      router.push("/solicitar");
    }
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[300px] bg-neutral-200 animate-pulse" />
    );
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      <div className="relative w-full h-full min-h-[300px] z-0">
        <MapContainer
          key={mapKey}
          center={visitorPos || ALBACETE_CENTER}
          zoom={14}
          minZoom={13}
          style={{
            height: "100%",
            width: "100%",
            zIndex: 1,
            minHeight: "300px", // 🔥 FORZAMOS ALTURA MÍNIMA EN PÍXELES
          }}
          maxBounds={ZONE_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom={false}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {visitorPos && (
            <>
              <PanTo position={visitorPos} />
              <Marker position={visitorPos} icon={visitorIcon}>
                <Tooltip direction="top" offset={[0, -10]}>
                  Estás aquí
                </Tooltip>
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
                {d.name} · {vehicleData[d.vehicle_type]?.name || "Furgoneta"}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
