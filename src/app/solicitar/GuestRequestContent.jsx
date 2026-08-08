"use client";

import RequestWizard from "@/components/request/RequestWizard";

/**
 * Solicitud sin cuenta. Mismo asistente que el del cliente autenticado
 * (`RequestWizard`); solo cambia que aquí se piden nombre y teléfono y el pago
 * es en efectivo al conductor.
 */
export default function GuestRequestContent() {
  return (
    <div className="px-4 py-6">
      <RequestWizard authenticated={false} />
    </div>
  );
}
