import HeroSection from "@/components/landing/HeroSection";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HowItWorks from "@/components/landing/HowItWorks";
import DriversSection from "@/components/landing/DriversSection";
import ServicesSection from "@/components/landing/ServicesSection";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <LandingNavbar />
      <HowItWorks />
      <ServicesSection />
      <DriversSection />
      <Footer />
    </div>
  );
}
