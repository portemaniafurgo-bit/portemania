import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/common/StatusBadge";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

const typeLabels = {
  damage: "Daño", delay: "Retraso", lost_item: "Objeto perdido",
  payment: "Pago", behavior: "Comportamiento", other: "Otro",
};

export default function AdminIncidents() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [resolution, setResolution] = useState("");

  const { data: incidents = [] } = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: () => base44.entities.Incident.list("-created_date", 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Incident.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
      setSelectedId(null);
      setResolution("");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Incidencias</h1>

      {incidents.length === 0 ? (
        <div className="text-center py-16">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-3">No hay incidencias registradas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    inc.priority === "urgent" ? "bg-red-100 text-red-700" :
                    inc.priority === "high" ? "bg-orange-100 text-orange-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {inc.priority?.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-foreground">{typeLabels[inc.type] || inc.type}</span>
                </div>
                <StatusBadge status={inc.status} />
              </div>

              <p className="text-sm text-foreground">{inc.description}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Reportado por: {inc.reporter_name || "—"} · {inc.created_date && format(new Date(inc.created_date), "d MMM yyyy, HH:mm", { locale: es })}
              </p>

              {inc.resolution && (
                <div className="mt-3 bg-emerald-50 rounded-xl p-3 text-sm text-emerald-800">
                  <strong>Resolución:</strong> {inc.resolution}
                </div>
              )}

              {inc.status !== "resolved" && inc.status !== "closed" && (
                <div className="mt-3 space-y-2">
                  {selectedId === inc.id ? (
                    <>
                      <Textarea
                        placeholder="Escribe la resolución..."
                        value={resolution}
                        onChange={e => setResolution(e.target.value)}
                        className="rounded-xl"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => updateMutation.mutate({
                            id: inc.id,
                            data: { status: "resolved", resolution }
                          })}
                        >
                          Resolver
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setSelectedId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => setSelectedId(inc.id)}>
                        <MessageCircle className="w-3 h-3" /> Resolver
                      </Button>
                      {inc.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => updateMutation.mutate({ id: inc.id, data: { status: "in_progress" } })}
                        >
                          En proceso
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}