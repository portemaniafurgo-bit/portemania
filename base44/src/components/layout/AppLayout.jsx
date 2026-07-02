import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import Logo from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Home, Package, Clock, MessageCircle, User, Settings,
  Truck, BarChart3, Users, AlertTriangle, Menu, X, LogOut, ChevronRight
} from "lucide-react";
import { useState } from "react";

const clientNav = [
  { label: "Inicio", icon: Home, path: "/dashboard" },
  { label: "Nuevo transporte", icon: Package, path: "/new-request" },
  { label: "Mis pedidos", icon: Clock, path: "/my-orders" },
  { label: "Perfil", icon: User, path: "/profile" },
  { label: "Página principal", icon: ChevronRight, path: "/" },
];

const driverNav = [
  { label: "Panel", icon: Home, path: "/driver" },
  { label: "Solicitudes", icon: Package, path: "/driver/requests" },
  { label: "Historial", icon: Clock, path: "/driver/history" },
  { label: "Ganancias", icon: BarChart3, path: "/driver/earnings" },
  { label: "Perfil", icon: User, path: "/driver/profile" },
  { label: "Administración", icon: Settings, path: "/admin" },
];

const adminNav = [
  { label: "Conductores", icon: Truck, path: "/admin" },
  { label: "Pedidos", icon: Package, path: "/admin/orders" },
  { label: "Incidencias", icon: AlertTriangle, path: "/admin/incidents" },
  { label: "Página principal", icon: ChevronRight, path: "/" },
];

const ADMIN_EMAIL = "renato.0550.calero@gmail.com";

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = user?.role || "user";

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Determinar el nav según la ruta actual (más fiable que el rol de plataforma)
  const baseDriverNav = isAdmin ? driverNav : driverNav.filter(item => item.path !== "/admin");
  const navItems = location.pathname.startsWith("/admin")
    ? adminNav
    : location.pathname.startsWith("/driver")
    ? baseDriverNav
    : clientNav;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 h-screen w-64 bg-card border-r border-border z-50 flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <Logo size="small" />
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4.5 h-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">
                {user?.full_name?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => {
              import("@/api/base44Client").then(m => m.base44.auth.logout("/"));
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <Logo size="small" />
        </div>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}