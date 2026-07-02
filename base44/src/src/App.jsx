import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "@/components/ProtectedRoute";
import IdleTimer from "@/components/auth/IdleTimer";

// Auth pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

// Public
import Landing from "@/pages/Landing";
import GuestRequest from "@/pages/client/GuestRequest";
import SolicitudEnviada from "@/pages/SolicitudEnviada";
import Terminos from "@/pages/legal/Terminos";
import Privacidad from "@/pages/legal/Privacidad";
import Cookies from "@/pages/legal/Cookies";
import Bienvenida from "@/pages/Bienvenida";
import LoginClientes from "@/pages/LoginClientes";
import LoginConductores from "@/pages/LoginConductores";

// Layout
import AppLayout from "@/components/layout/AppLayout";

// Client pages
import Dashboard from "@/pages/client/Dashboard";
import NewRequest from "@/pages/client/NewRequest";
import MyOrders from "@/pages/client/MyOrders";
import OrderDetail from "@/pages/client/OrderDetail";
import Profile from "@/pages/client/Profile";
import Payment from "@/pages/client/Payment";

// Driver pages
import DriverDashboard from "@/pages/driver/DriverDashboard";
import ActiveJob from "@/pages/driver/ActiveJob";
import DriverRequests from "@/pages/driver/DriverRequests";
import DriverHistory from "@/pages/driver/DriverHistory";
import DriverEarnings from "@/pages/driver/DriverEarnings";
import DriverProfilePage from "@/pages/driver/DriverProfilePage";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminIncidents from "@/pages/admin/AdminIncidents";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminWorkers from "@/pages/admin/AdminWorkers";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando PorteManía...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/bienvenida" element={<Bienvenida />} />
      <Route path="/solicitar" element={<GuestRequest />} />
      <Route path="/solicitud-enviada" element={<SolicitudEnviada />} />
      <Route path="/login-clientes" element={<LoginClientes />} />
      <Route path="/login-conductores" element={<LoginConductores />} />
      <Route path="/terminos" element={<Terminos />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          {/* Client */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-request" element={<NewRequest />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/order/:id" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/payment/:id" element={<Payment />} />

          {/* Driver */}
          <Route path="/driver" element={<DriverDashboard />} />
          <Route path="/driver/job/:id" element={<ActiveJob />} />
          <Route path="/driver/requests" element={<DriverRequests />} />
          <Route path="/driver/history" element={<DriverHistory />} />
          <Route path="/driver/earnings" element={<DriverEarnings />} />
          <Route path="/driver/profile" element={<DriverProfilePage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/drivers" element={<AdminDrivers />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/incidents" element={<AdminIncidents />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/workers" element={<AdminWorkers />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <IdleTimer />
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;