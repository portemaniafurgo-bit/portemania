"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import AccessModal from "@/components/landing/AccessModal";

export default function HeroSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const handleSolicitarTransporte = () => {
    if (isAuthenticated) {
      router.push("/new-request");
    } else {
      setShowModal(true);
    }
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Banner image */}
      <div className="relative w-full">
        <img
          src="https://media.base44.com/images/public/6a32f79927b9d0ad42c1c9e5/dcf2d978a_bannerweb.png"
          alt="PorteManía — Espacio para lo importante. Nosotros lo llevamos."
          className="w-full object-cover object-center"
          style={{ maxHeight: "520px" }}
        />
      </div>

      {/* CTAs below banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 justify-center px-6 py-6 bg-background"
      >
        <Button size="lg" onClick={handleSolicitarTransporte} className="rounded-full px-8 text-base font-semibold h-12 gap-2 shadow-md">
          Solicitar transporte
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Link href="/ser-conductor">
          <Button size="lg" variant="outline" className="rounded-full px-8 text-base font-semibold h-12 w-full sm:w-auto">
            Quiero ser conductor
          </Button>
        </Link>
      </motion.div>

      {/* Modal de acceso */}
      <AccessModal open={showModal} onClose={() => setShowModal(false)} />
    </section>
  );
}
