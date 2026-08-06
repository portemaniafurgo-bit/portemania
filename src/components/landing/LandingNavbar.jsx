"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogIn, UserPlus } from "lucide-react";
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
      {" "}
      {/* ← sin sticky */}
      <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href="/" className="block">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 900 220"
              className="h-10 w-auto"
              aria-label="ClicYVoy"
            >
              <defs>
                <style>{`.black{fill:#111111;}.yellow{fill:#F5B400;}.txt{font-family:'Poppins','Montserrat','Arial',sans-serif;font-weight:700;font-size:108px;}`}</style>
              </defs>
              <g transform="translate(0 15)">
                <path
                  className="black"
                  d="M90 20 C55 20 28 47 28 82 V145 H58 V82 C58 64 72 50 90 50 H110 C128 50 142 64 142 82 V145 H172 V82 C172 47 145 20 110 20 Z"
                />
                <path
                  className="yellow"
                  d="M28 160 H58 V178 C58 202 76 220 100 220 C124 220 142 202 142 178 V160 H172 V178 C172 217 143 250 100 278 C57 250 28 217 28 178 Z"
                  transform="translate(0 -60)"
                />
                <path className="yellow" d="M100 188 L74 162 H126 Z" />
                <circle className="yellow" cx="100" cy="102" r="16" />
              </g>
              <text x="225" y="145" className="txt">
                <tspan className="black">Clicy</tspan>
                <tspan className="yellow">Voy</tspan>
              </text>
            </svg>
          </Link>
        </div>

        {/* Menú desktop */}
        <div className="hidden md:flex items-center justify-center flex-1 gap-8 ml-8">
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
                  className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors text-gray-700"
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

        {/* Botones desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login-clientes">
            <button className="text-gray-600 hover:text-[#7145d6] transition-colors font-medium text-sm px-4 py-2">
              Entrar
            </button>
          </Link>
          <Link href="/register">
            <button className="bg-[#7145d6] text-white font-medium text-sm px-5 py-2 rounded-full hover:bg-[#5a35b0] transition-colors shadow-sm">
              Registrarse
            </button>
          </Link>
        </div>

        {/* Hamburguesa móvil */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
          aria-label="Menú"
        >
          {open ? (
            <X className="w-6 h-6 text-gray-700" />
          ) : (
            <Menu className="w-6 h-6 text-gray-700" />
          )}
        </button>
      </div>
      {/* Menú móvil desplegable */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-2 overflow-hidden"
          >
            {serviceLinks.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-gray-700 font-medium text-sm hover:text-[#7145d6] transition-colors"
              >
                {s.label}
              </Link>
            ))}
            <hr className="border-gray-100" />
            <Link
              href="/#como-funciona"
              onClick={() => setOpen(false)}
              className="block py-2.5 text-gray-700 font-medium text-sm hover:text-[#7145d6] transition-colors"
            >
              Cómo funciona
            </Link>
            <Link
              href="/ser-conductor"
              onClick={() => setOpen(false)}
              className="block py-2.5 text-[#7145d6] font-medium text-sm hover:text-[#5a35b0] transition-colors"
            >
              Quiero conducir
            </Link>
            <hr className="border-gray-200 my-2" />
            <Link
              href="/login-clientes"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-2.5 text-gray-700 font-medium text-sm hover:text-[#7145d6] transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 py-2.5 text-white font-medium text-sm bg-[#7145d6] rounded-xl px-4 hover:bg-[#5a35b0] transition-colors justify-center"
            >
              <UserPlus className="w-4 h-4" />
              Registrarse
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
