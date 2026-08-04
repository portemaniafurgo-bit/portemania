"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { buildRequestHref } from "@/lib/requestIntent";

const serviceLinksBase = [
  { label: "Porte", service: "porte" },
  { label: "Mini Mudanza", service: "mini_mudanza" },
  { label: "Compra en tienda", service: "compra_tienda" },
  { label: "Envío de paquete", service: "envio_paquete" },
];

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const requestPath = isAuthenticated ? "/new-request" : "/solicitar";
  const serviceLinks = serviceLinksBase.map((item) => ({
    ...item,
    href: buildRequestHref(requestPath, { service: item.service }),
  }));

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold text-gray-900 hover:opacity-90">ClicYVoy</Link>
        <div className="hidden md:flex space-x-8 items-center">
          <div className="relative group">
            <button className="text-gray-600 hover:text-[#7145d6] transition-colors font-medium text-sm flex items-center">
              Servicios <span className="material-symbols-outlined ml-1 text-xl">expand_more</span>
            </button>
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-2">
              {serviceLinks.map((s) => (
                <Link key={s.label} href={s.href} className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors">{s.label}</Link>
              ))}
            </div>
          </div>
          <Link href="/#como-funciona" className="text-gray-600 hover:text-[#7145d6] transition-colors font-medium text-sm">Cómo funciona</Link>
          <Link href="/ser-conductor" className="text-[#7145d6] font-medium text-sm bg-purple-50 px-4 py-1.5 rounded-full hover:bg-purple-100 transition-colors">Quiero conducir</Link>
          {!isAuthenticated ? (
            <>
              <Link href="/login-clientes" className="bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 font-semibold text-sm px-6 py-3 rounded-xl shadow-sm">Entrar</Link>
              <Link href="/register" className="bg-black text-white hover:opacity-90 font-semibold text-sm px-6 py-3 rounded-xl shadow-sm">Registrarse</Link>
            </>
          ) : (
            <Link href="/dashboard" className="bg-[#7145d6] text-white px-4 py-2 rounded-xl text-sm font-semibold">Mi cuenta</Link>
          )}
        </div>
        <button onClick={() => setOpen((v) => !v)} className="md:hidden p-2 rounded-xl hover:bg-gray-100">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 overflow-hidden">
            {serviceLinks.map((s) => (
              <Link key={s.label} href={s.href} onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">{s.label}</Link>
            ))}
            <hr />
            <Link href="/#como-funciona" onClick={() => setOpen(false)} className="block py-2 text-gray-700 font-medium">Cómo funciona</Link>
            <Link href="/ser-conductor" onClick={() => setOpen(false)} className="block py-2 text-[#7145d6] font-medium">Quiero conducir</Link>
            {!isAuthenticated ? (
              <div className="flex gap-3 pt-2">
                <Link href="/login-clientes" onClick={() => setOpen(false)} className="flex-1 text-center border border-gray-300 rounded-xl py-2 font-semibold text-sm">Entrar</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="flex-1 text-center bg-black text-white rounded-xl py-2 font-semibold text-sm">Registrarse</Link>
              </div>
            ) : (
              <Link href="/dashboard" onClick={() => setOpen(false)} className="block w-full text-center bg-[#7145d6] text-white rounded-xl py-2 font-semibold">Mi cuenta</Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
