"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import dynamic from "next/dynamic";
import { MapPin, Package, Truck } from "lucide-react";
import { supabase } from "@/lib/entities";

const DriverTrackingMap = dynamic(() => import("@/components/common/DriverTrackingMap"), {
  ssr: false,
});

/**
 * Seguimiento compartido, SIN cuenta: el cliente manda este enlace a quien
 * espera la carga y ve llegar la furgoneta, como el «compartir viaje» de Uber.
 *
 * Solo enseña lo justo (estado, nombre de pila del conductor, su posición y a
 * dónde va) porque eso es lo único que devuelve `track_by_token`; ni precios,
 * ni teléfonos, ni datos del cliente. Y deja de funcionar al terminar.
 */
const ESTADOS = {
  accepted: "El conductor va hacia la recogida",
  in_transit: "En camino a recoger la carga",
  picked_up: "Carga recogida · en camino a la entrega",
};

export default function SeguimientoCompartido({ params }) {
  const { token } = use(params);
  const [info, setInfo] = useState(undefined);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("track_by_token", { p_token: token });
      if (active) setInfo(data || null);
    };
    load();
    // Cada 15 s: quien mira este enlace no tiene sesión, así que no hay
    // Realtime; con un sondeo suave sobra para ver moverse la furgoneta.
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);

  if (info === undefined) {
    return <Estado titulo="Cargando el seguimiento…" />;
  }
  if (!info) {
    return (
      <Estado
        titulo="Este enlace ya no está disponible"
        texto="Puede que el servicio haya terminado o que el enlace no sea correcto."
      />
    );
  }
  if (info.finished) {
    return (
      <Estado
        titulo={info.status === "delivered" ? "Entrega completada" : "El servicio ha terminado"}
        texto="Gracias por seguir el envío con ClicyVoy."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-5 space-y-4">
        <header className="flex items-center gap-2 pt-2">
          <span className="font-heading text-2xl font-extrabold">
            Clicy<span className="text-accent">Voy</span>
          </span>
        </header>

        <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Truck className="w-5 h-5" />
            <span className="font-heading font-semibold">{ESTADOS[info.status] || "En curso"}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {info.driver_name} lleva tu envío. Esta página se actualiza sola.
          </p>
        </div>

        {info.driver_lat && info.destination_lat ? (
          <DriverTrackingMap
            driverLocation={{ lat: info.driver_lat, lng: info.driver_lng }}
            destLat={info.destination_lat}
            destLng={info.destination_lng}
            height={320}
            badge={`${info.driver_name} en camino`}
          />
        ) : (
          <div className="bg-card rounded-2xl border border-border p-5 text-sm text-muted-foreground">
            Aún no hay posición del conductor. En cuanto empiece el trayecto aparecerá aquí.
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" /> Entrega en
          </div>
          <p className="text-sm">{info.destination_address}</p>
        </div>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Package className="w-3.5 h-3.5" /> Portes y mudanzas en Albacete · clicyvoy.es
        </p>
      </div>
    </div>
  );
}

function Estado({ titulo, texto }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-2">
        <h1 className="font-heading text-xl font-semibold">{titulo}</h1>
        {texto ? <p className="text-sm text-muted-foreground">{texto}</p> : null}
      </div>
    </div>
  );
}
