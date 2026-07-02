import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import DriversMapSection from "@/components/landing/DriversMapSection";
import VehiclesSection from "@/components/landing/VehiclesSection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <LandingNavbar />
      <HeroSection />
      <HowItWorks />
      <DriversMapSection />
      <VehiclesSection />
      <Footer />
    </div>
  );
}
