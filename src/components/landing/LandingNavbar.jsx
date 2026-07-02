"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Home, LogIn, Truck, UserPlus, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/common/Logo";
import { useAuth } from "@/lib/AuthContext";

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const close = () => setOpen(false);

  const isAdmin = user?.role === "admin";

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-5 py-3 max-w-7xl mx-auto">
          <Link href="/" onClick={close}>
            <Logo size="small" />
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="p-2 rounded-xl hover:bg-muted transition-colors">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.div
              className="fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-50 flex flex-col shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
            >
              <div className="p-5 border-b border-border flex items-center justify-between">
                <Logo size="small" />
                <button onClick={close} className="p-2 rounded-xl hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                <MenuItem icon={Home} label="Inicio" to="/" onClick={close} />
                <div className="pt-3 pb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Acceso</p>
                </div>
                <MenuItem icon={LogIn} label="Inicio de sesión clientes" to="/login-clientes" onClick={close} />
                <MenuItem icon={Truck} label="Inicio de sesión conductor" to="/login-conductores" onClick={close} />
                {!isAuthenticated && (
                  <MenuItem icon={UserPlus} label="Registrarse" to="/bienvenida" onClick={close} />
                )}
                {isAdmin && (
                  <>
                    <div className="pt-3 pb-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">Administración</p>
                    </div>
                    <MenuItem icon={Users} label="Gestionar trabajadores" to="/admin/workers" onClick={close} />
                  </>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuItem({ icon: Icon, label, to, onClick }) {
  return (
    <Link
      href={to}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}
