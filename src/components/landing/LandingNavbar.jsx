"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const serviceLinks = [
  { label: "Porte", href: "/solicitar?service=porte" },
  { label: "Mini Mudanza", href: "/solicitar?service=mini_mudanza" },
  { label: "Compra en tienda", href: "/solicitar?service=compra_tienda" },
  { label: "Envío de paquete", href: "/solicitar?service=envio_paquete" },
];

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto">
        {/* Logo con SVG inline */}

        {/* Menú desktop */}
        <div className="hidden md:flex space-x-8 items-center">
          <div className="relative group">
            <button className="text-gray-600 hover:text-[#7145d6] transition-colors font-medium text-sm flex items-center">
              Servicios
              <svg
                className="ml-1 w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2">
              {serviceLinks.map((s) => (
                <Link
                  key={s.label}
                  href={s.href}
                  className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            href="/#como-funciona"
            className="text-gray-600 hover:text-[#7145d6] transition-colors font-medium text-sm"
          >
            Cómo funciona
          </Link>
          <Link
            href="/ser-conductor"
            className="text-[#7145d6] font-medium text-sm bg-purple-50 px-4 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
          >
            Quiero conducir
          </Link>
        </div>

        {/* Hamburguesa móvil */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Menú móvil */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 overflow-hidden"
          >
            {serviceLinks.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                onClick={() => setOpen(false)}
                className="block py-2 text-gray-700 font-medium"
              >
                {s.label}
              </Link>
            ))}
            <hr />
            <Link
              href="/#como-funciona"
              onClick={() => setOpen(false)}
              className="block py-2 text-gray-700 font-medium"
            >
              Cómo funciona
            </Link>
            <Link
              href="/ser-conductor"
              onClick={() => setOpen(false)}
              className="block py-2 text-[#7145d6] font-medium"
            >
              Quiero conducir
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
