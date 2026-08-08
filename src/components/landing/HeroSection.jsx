"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

import { useAuth } from "@/lib/AuthContext";
import { useAvailableDrivers } from "@/lib/useDrivers";
import { buildRequestHref, resolveServiceKey } from "@/lib/requestIntent";
import { SERVICES } from "@/lib/services";
import { useTariffs, servicePriceFrom } from "@/lib/tariffs";
import { isInZone, postalCodeError, ZONES } from "@/lib/zones";
import ServicePicker from "@/components/request/ServicePicker";
import AccessModal from "@/components/landing/AccessModal";
import Logo from "@/components/landing/Logo";

const DriversMapInner = dynamic(() => import("@/components/landing/DriversMapSectionInner"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-neutral-200 animate-pulse" />,
});

/**
 * Hero: mapa de conductores en vivo como banner y arranque del pedido en un
 * toque.
 *
 * Aquí solo se elige servicio y se indican las dos direcciones; el asistente
 * completo vive en /solicitar y /new-request. Nada de condiciones ni recargos
 * en esta pantalla: eso llega dentro del proceso de compra, cuando el cliente
 * ya sabe qué quiere.
 */
export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tariffs = useTariffs();
  const { count: driversAvailable, isLoading: loadingDrivers } = useAvailableDrivers();

  const [showModal, setShowModal] = useState(false);
  const [serviceKey, setServiceKey] = useState(() => resolveServiceKey(searchParams));
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const service = SERVICES[serviceKey];
  const priceFrom = servicePriceFrom(tariffs, serviceKey);

  // Villarrobledo se elige dentro del asistente; el arranque asume la capital.
  const originError = postalCodeError(origin, "albacete");
  const destinationError = postalCodeError(destination, "albacete");
  const ready = isInZone(origin, "albacete") && isInZone(destination, "albacete");

  const start = () => {
    if (!ready) return;
    const path = isAuthenticated ? "/new-request" : "/solicitar";
    router.push(
      buildRequestHref(path, {
        service: serviceKey,
        origin_address: origin,
        destination_address: destination,
      }),
    );
  };

  return (
    <section className="relative flex flex-col md:flex-row h-auto md:h-[620px] overflow-hidden">
      {/* Arranque del pedido */}
      <div className="w-full md:w-[400px] lg:w-[460px] bg-[#7145d6] flex-shrink-0 flex flex-col z-20 shadow-2xl overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-5 pb-3 flex justify-center md:justify-start">
          <Logo className="h-10 md:h-12 w-auto" tone="light" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          <ServicePicker
            value={serviceKey}
            onChange={setServiceKey}
            variant="hero"
            title="¿Qué necesitas transportar hoy?"
          />

          <motion.div
            key={serviceKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-white/10 border border-white/30 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-white text-sm">{service.label}</p>
              <p className="text-xs text-white/70">{service.landingSubtitle}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-white leading-none">
                {serviceKey === "paquete" ? `${priceFrom.toFixed(2)}€` : `${priceFrom}€`}
              </p>
              <p className="text-[11px] text-white/70">
                {serviceKey === "mini_mudanza" ? "2 h incluidas" : "desde"}
              </p>
            </div>
          </motion.div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white" htmlFor="hero-origin">
              Dirección de recogida
            </label>
            <input
              id="hero-origin"
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all ${
                originError ? "border-red-300" : "border-white/40"
              }`}
              placeholder="Calle, número — Albacete"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
            <p className={`text-xs ${originError ? "text-red-200" : "text-white/70"}`}>
              {originError || ZONES.albacete.hint}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-white" htmlFor="hero-destination">
              Dirección de entrega
            </label>
            <input
              id="hero-destination"
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white placeholder:text-white/50 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all ${
                destinationError ? "border-red-300" : "border-white/40"
              }`}
              placeholder="Calle, número — Albacete"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            <p className={`text-xs ${destinationError ? "text-red-200" : "text-white/70"}`}>
              {destinationError || ZONES.albacete.hint}
            </p>
          </div>

          <motion.button
            onClick={start}
            disabled={!ready}
            whileTap={ready ? { scale: 0.97 } : undefined}
            className="w-full bg-white text-[#7145d6] py-4 rounded-full font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90"
          >
            Continuar
            <span className="material-symbols-outlined">arrow_forward</span>
          </motion.button>

          <p className="text-xs text-white/70 text-center">
            Sin registro obligatorio · Precio cerrado antes de reservar
          </p>
        </div>
      </div>

      {/* Mapa de conductores en vivo */}
      <div className="flex-1 relative bg-neutral-900 overflow-hidden min-h-[320px] md:min-h-full">
        <DriversMapInner onDriverClick={() => setShowModal(true)} />

        {!isAuthenticated && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-[1000] flex items-center gap-2 md:gap-3 bg-white/20 backdrop-blur-md p-2 md:p-3 rounded-2xl border border-white/30 shadow-xl">
            <Link
              href="/login-clientes"
              className="bg-white/90 backdrop-blur-sm text-black hover:bg-white font-bold text-xs md:text-sm transition-all px-3 md:px-6 py-2 md:py-3 rounded-xl shadow-sm border border-white/40"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="bg-black text-white hover:opacity-90 font-bold text-xs md:text-sm transition-all px-3 md:px-6 py-2 md:py-3 rounded-xl shadow-sm"
            >
              Registrarse
            </Link>
          </div>
        )}

        {/* Datos reales: el contador sale de get_public_drivers(), no es decorativo. */}
        <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 w-[95%] md:w-11/12 max-w-4xl bg-white/85 backdrop-blur-md rounded-2xl shadow-2xl p-3 md:p-6 z-[1000] border border-white/40">
          <h2 className="font-semibold text-base md:text-xl text-gray-900 mb-2 md:mb-4">
            Conductores en Albacete
          </h2>
          <div className="grid grid-cols-3 gap-2 md:gap-6">
            <HeroStat
              icon="person_pin_circle"
              label="Conductores activos"
              value={
                loadingDrivers
                  ? "Cargando…"
                  : driversAvailable > 0
                    ? `${driversAvailable} disponible${driversAvailable === 1 ? "" : "s"} ahora`
                    : "Servicio bajo demanda"
              }
            />
            <HeroStat
              icon="map"
              label="Zona de cobertura"
              value="Albacete y Villarrobledo"
            />
            <HeroStat icon="euro" label="Precio" value="Cerrado antes de reservar" />
          </div>
        </div>
      </div>

      <AccessModal
        open={showModal}
        onClose={() => setShowModal(false)}
        loginHref="/login-clientes"
        registerHref="/register"
        guestHref="/solicitar"
      />
    </section>
  );
}

function HeroStat({ icon, label, value }) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-lg md:text-2xl">{icon}</span>
      </div>
      <div className="text-center md:text-left">
        <div className="text-[8px] md:text-xs text-gray-500 mb-0.5">{label}</div>
        <div className="font-semibold text-[10px] md:text-sm text-gray-900">{value}</div>
      </div>
    </div>
  );
}
