import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { vehicleData } from "@/components/common/VehicleCard";
import { Check, ArrowRight, LogIn, UserPlus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

export default function VehiclesSection() {
  const vehicles = Object.entries(vehicleData);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const handleContratar = (vehicleKey = null) => {
    if (isAuthenticated) {
      navigate(vehicleKey ? `/new-request?vehicle=${vehicleKey}` : "/new-request");
    } else {
      setSelectedVehicle(vehicleKey);
      setShowModal(true);
    }
  };

  return (
    <section className="py-24 bg-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider">Flota</span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mt-2">
            Furgonetas para portes pequeños
          </h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Ideal para transportar unas pocas piezas. Recogida y entrega siempre a pie de calle.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {vehicles.map(([key, vehicle], i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{vehicle.icon}</div>
              <h3 className="font-heading font-bold text-lg text-foreground">{vehicle.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{vehicle.description}</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>{vehicle.capacity}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Conductor profesional</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Entrega a pie de calle</span>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-foreground">{vehicle.basePrice}€</span>
                  <span className="text-muted-foreground text-sm"> /2h</span>
                </div>
                <Button onClick={() => handleContratar(key)} className="rounded-full px-5 font-semibold gap-1.5">
                  Contratar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mt-12"
        >
          <Button
            size="lg"
            onClick={() => handleContratar(null)}
            className="rounded-full px-10 text-base font-bold h-14 gap-2 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground text-lg"
          >
            Contratar servicio
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>

      {/* Modal de acceso */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-0"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🚐</div>
                <h2 className="text-xl font-display font-bold text-foreground">¿Cómo quieres continuar?</h2>
                <p className="text-sm text-muted-foreground mt-1">Elige una opción para solicitar tu transporte</p>
              </div>
              <div className="space-y-3">
                <Link to={`/login-clientes${selectedVehicle ? `?vehicle=${selectedVehicle}` : ""}`} onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                      <LogIn className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Iniciar sesión</p>
                      <p className="text-xs text-muted-foreground">Accede a tu cuenta para seguimiento completo</p>
                    </div>
                  </button>
                </Link>
                <Link to={`/register${selectedVehicle ? `?vehicle=${selectedVehicle}` : ""}`} onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/30 hover:bg-muted transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Crear cuenta</p>
                      <p className="text-xs text-muted-foreground">Gratis · Gestiona tus pedidos online</p>
                    </div>
                  </button>
                </Link>
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Link to={`/solicitar${selectedVehicle ? `?vehicle=${selectedVehicle}` : ""}`} onClick={() => setShowModal(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/30 hover:bg-muted transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Continuar como invitado</p>
                      <p className="text-xs text-muted-foreground">Sin cuenta · Pago en efectivo al conductor</p>
                    </div>
                  </button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}