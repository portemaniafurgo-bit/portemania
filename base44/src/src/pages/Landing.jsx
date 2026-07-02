import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import VehiclesSection from "@/components/landing/VehiclesSection";
import Footer from "@/components/landing/Footer";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { useAuth } from "@/lib/AuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "driver") navigate("/driver", { replace: true });
      else if (user.role === "admin") navigate("/admin", { replace: true });
      else navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user]);

  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <HeroSection />
      <HowItWorks />
      <VehiclesSection />
      <Footer />
    </div>
  );
}