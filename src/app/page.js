import { Suspense } from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import DriversSection from "@/components/landing/DriversSection";
import ServicesSection from "@/components/landing/ServicesSection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* 🔥 Navbar MÓVIL: sticky arriba, solo visible en móvil */}
      <div className="md:hidden sticky top-0 z-50">
        <LandingNavbar />
      </div>

      {/* Hero Section */}
      <Suspense fallback={<div className="h-[600px] bg-purple-100 animate-pulse" />}>
        <HeroSection />
      </Suspense>

      {/* 🔥 Navbar DESKTOP: debajo del hero, solo visible en desktop */}
      <div className="hidden md:block">
        <LandingNavbar />
      </div>

      <ServicesSection />
      <HowItWorks />
      <DriversSection />
      <Footer />
    </div>
  );
}