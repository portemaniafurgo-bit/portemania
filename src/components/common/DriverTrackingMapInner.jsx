"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const driverIcon = L.divIcon({
  html: `
    <style>
      @keyframes driverPulse {
        0% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.6); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
    </style>
    <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;animation:driverPulse 1.5s ease-out infinite;"></div>
      <div style="background:#3b82f6;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;position:relative;z-index:1;">🚐</div>
    </div>`,
  className: "",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const originIcon = L.divIcon({
  html: `<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const destIcon = L.divIcon({
  html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function PanTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position, { animate: true });
  }, [position?.lat, position?.lng]);
  return null;
}

export default function DriverTrackingMapInner({ driverLocation, originLat, originLng, destLat, destLng }) {
  const center = driverLocation
    ? [driverLocation.lat, driverLocation.lng]
    : originLat && originLng
    ? [originLat, originLng]
    : [39.0, -1.86]; // Albacete por defecto

  return (
    <div className="rounded-2xl overflow-hidden border border-border relative">
      {driverLocation && (
        <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs font-medium text-foreground shadow flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Conductor en tiempo real
        </div>
      )}
      <MapContainer center={center} zoom={14} style={{ height: "220px", width: "100%", zIndex: 1 }} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {driverLocation && (
          <>
            <PanTo position={driverLocation} />
            <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
              <Popup>🚐 Conductor</Popup>
            </Marker>
          </>
        )}

        {originLat && originLng && (
          <Marker position={[originLat, originLng]} icon={originIcon}>
            <Popup>Recogida</Popup>
          </Marker>
        )}

        {destLat && destLng && (
          <Marker position={[destLat, destLng]} icon={destIcon}>
            <Popup>Entrega</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
