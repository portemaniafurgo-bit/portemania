"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import ReferralClaimer from "@/components/partners/ReferralClaimer";

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        {children}
        <ReferralClaimer />
        <Toaster />
        <SonnerToaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
