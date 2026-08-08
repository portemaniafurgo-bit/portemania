"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/entities";

/**
 * Conductores verificados y disponibles ahora mismo, con la posición
 * difuminada que devuelve `get_public_drivers()` por privacidad.
 *
 * Lo comparten el mapa del hero y el panel de datos que va encima: una sola
 * consulta cada 30 s en lugar de una por componente.
 */
export function useAvailableDrivers() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_drivers");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  return { drivers: data || [], count: data?.length ?? 0, isLoading };
}
