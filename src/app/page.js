import { Suspense } from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import ServicesSection from "@/components/landing/ServicesSection";
import HowItWorks from "@/components/landing/HowItWorks";
import SeoContent from "@/components/landing/SeoContent";
import GoogleReviews from "@/components/landing/GoogleReviews";
import DriversSection from "@/components/landing/DriversSection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* En móvil el navbar va arriba y fijo; en escritorio, bajo el hero. */}
      <div className="md:hidden sticky top-0 z-50">
        <LandingNavbar />
      </div>

      <Suspense fallback={<div className="h-[620px] bg-purple-100 animate-pulse" />}>
        <HeroSection />
      </Suspense>

      <div className="hidden md:block">
        <LandingNavbar />
      </div>

      <ServicesSection />
      <HowItWorks />
      <SeoContent />
      <GoogleReviews />
      <DriversSection />
      <Footer />
    </div>
  );
}
