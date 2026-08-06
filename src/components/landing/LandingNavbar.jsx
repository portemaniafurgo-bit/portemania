"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Home,
  Package,
  FileText,
  Phone,
  User,
  LogIn,
  UserPlus,
  Truck,
  LayoutGrid,
} from "lucide-react";

export default function LandingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/servicios", label: "Servicios", icon: Package },
    { href: "/como-funciona", label: "Cómo funciona", icon: LayoutGrid },
    { href: "/conductores", label: "Conductores", icon: Truck },
    { href: "/contacto", label: "Contacto", icon: Phone },
  ];

  return (
    <nav className="bg-white border-b border-border-light sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo - izquierda */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2"
              onClick={closeMenu}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 900 220"
                className="h-8 w-auto"
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

          {/* Desktop Menu - centrado */}
          <div className="hidden md:flex items-center justify-center flex-1 gap-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-700 hover:text-[#7145d6] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons - derecha */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard">
                  <Button variant="outline" className="rounded-xl text-sm">
                    <User className="w-4 h-4 mr-2" />
                    {user?.name || "Mi cuenta"}
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <Link href="/login-clientes">
                  <Button variant="outline" className="rounded-xl text-sm">
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="rounded-xl text-sm bg-[#7145d6] hover:bg-[#5a35b0]">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Registrarse
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button (Hamburguesa) - ARRIBA DERECHA */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
            aria-label="Menú"
          >
            {isOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu (desplegable) */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#7145d6]/5 hover:text-[#7145d6] rounded-lg transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            {/* Separador */}
            <div className="border-t border-gray-100 my-3"></div>

            {/* Auth buttons en móvil */}
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#7145d6]/5 hover:text-[#7145d6] rounded-lg transition-colors"
              >
                <User className="w-5 h-5" />
                Mi cuenta
              </Link>
            ) : (
              <>
                <Link
                  href="/login-clientes"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#7145d6]/5 hover:text-[#7145d6] rounded-lg transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  Entrar
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#7145d6] bg-[#7145d6]/5 hover:bg-[#7145d6]/10 rounded-lg transition-colors"
                >
                  <UserPlus className="w-5 h-5" />
                  Registrarse
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
