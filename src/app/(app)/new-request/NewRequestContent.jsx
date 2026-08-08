"use client";

import { useAuth } from "@/lib/AuthContext";
import RequestWizard from "@/components/request/RequestWizard";

/** Nueva solicitud del cliente con cuenta: añade pago con tarjeta al asistente. */
export default function NewRequestContent() {
  const { user } = useAuth();
  return <RequestWizard authenticated user={user} />;
}
