"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { fetchDashboard, fetchProgramSettings, isStaffUser } from "@/lib/partners";
import PartnerActivate from "@/components/partners/PartnerActivate";
import PartnerPanel from "@/components/partners/PartnerPanel";
import { ErrorBox, LoadingBox } from "@/components/partners/ui";

function Unavailable() {
  return (
    <div className="max-w-xl space-y-2">
      <h1 className="text-2xl font-display font-bold text-foreground">Gana con ClicyVoy</h1>
      <div className="bg-muted rounded-2xl p-5 text-sm text-muted-foreground">
        El programa no está disponible ahora mismo. Vuelve a mirarlo más adelante.
      </div>
    </div>
  );
}

/**
 * "Gana con ClicyVoy": área del comercial, para cualquier rol con sesión.
 * Sin perfil de comercial enseña el programa y el alta; con perfil, el panel.
 * Mientras el programa no esté abierto al público (lanzamiento privado), quien
 * no es comercial ni del personal ve la pantalla neutra «no disponible».
 */
export default function PartnerPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const staff = isStaffUser(user);

  const dashboard = useQuery({
    queryKey: ["partner-dashboard", user?.id],
    queryFn: fetchDashboard,
    enabled: !!user?.id,
  });
  // Misma clave que el menú y el alta: se comparte la lectura (ya suele estar
  // en caché por el menú).
  const program = useQuery({ queryKey: ["partner-program"], queryFn: fetchProgramSettings });

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
  if (d?.reason === "not_installed") return <Unavailable />;

  if (d?.reason === "not_partner") {
    if (!staff) {
      if (program.isPending) return <LoadingBox />;
      if (program.isError) {
        return (
          <div className="max-w-xl">
            <ErrorBox text="No se ha podido cargar el programa." onRetry={program.refetch} />
          </div>
        );
      }
      const s = program.data;
      if (!s || s.enabled !== true || s.public !== true) return <Unavailable />;
    }
    return (
      <div className="max-w-3xl">
        <PartnerActivate
          defaultName={user?.full_name && user.full_name !== user.email ? user.full_name : ""}
          onActivated={() => {
            queryClient.invalidateQueries({ queryKey: ["partner-dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["partner-is-partner"] });
          }}
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
