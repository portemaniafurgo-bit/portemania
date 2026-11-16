"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { fetchDashboard } from "@/lib/partners";
import PartnerActivate from "@/components/partners/PartnerActivate";
import PartnerPanel from "@/components/partners/PartnerPanel";
import { ErrorBox, LoadingBox } from "@/components/partners/ui";

/**
 * "Gana con ClicyVoy": área del comercial, para cualquier rol con sesión.
 * Sin perfil de comercial enseña el programa y el alta; con perfil, el panel.
 */
export default function PartnerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const dashboard = useQuery({
    queryKey: ["partner-dashboard", user?.id],
    queryFn: fetchDashboard,
    enabled: !!user?.id,
  });

  if (dashboard.isLoading) return <LoadingBox />;
  if (dashboard.isError) {
    return (
      <div className="max-w-xl">
        <ErrorBox text="No se ha podido cargar tu panel de comercial." onRetry={dashboard.refetch} />
      </div>
    );
  }

  const d = dashboard.data;
  if (d?.ok) return <PartnerPanel d={d} userId={user?.id} />;

  // La base de datos aún no tiene el programa (migración sin aplicar).
  if (d?.reason === "not_installed") {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-display font-bold text-foreground">Gana con ClicyVoy</h1>
        <div className="bg-muted rounded-2xl p-5 text-sm text-muted-foreground">
          El programa no está disponible ahora mismo. Vuelve a mirarlo más adelante.
        </div>
      </div>
    );
  }

  if (d?.reason === "not_partner") {
    return (
      <div className="max-w-3xl">
        <PartnerActivate
          defaultName={user?.full_name && user.full_name !== user.email ? user.full_name : ""}
          onActivated={() => queryClient.invalidateQueries({ queryKey: ["partner-dashboard"] })}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <ErrorBox text="No se ha podido comprobar tu cuenta. Vuelve a entrar si persiste." onRetry={dashboard.refetch} />
    </div>
  );
}
