"use client";

import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useAdminGuard } from "@/lib/useAdminGuard";

const ROLES = [
  { value: "client", label: "Cliente" },
  { value: "driver", label: "Conductor" },
  { value: "staff", label: "Empleado" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsers() {
  const canRender = useAdminGuard();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  if (!canRender) return null;

  const filtered = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Usuarios</h1>
        <span className="text-sm text-muted-foreground">{users.length} total</span>
      </div>

      <p className="text-sm text-muted-foreground">
        El rol <strong>Empleado</strong> puede operar pedidos e incidencias, pero no tocar tarifas, usuarios, finanzas ni conductores.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </div>
                    {user.full_name || "—"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  {user.id === me?.id ? (
                    <span className="capitalize text-muted-foreground">{user.role} (tú)</span>
                  ) : (
                    <select
                      value={user.role || "client"}
                      onChange={e => roleMutation.mutate({ id: user.id, role: e.target.value })}
                      disabled={roleMutation.isPending}
                      className="h-9 rounded-xl border border-input bg-background px-2 text-sm"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.created_date && format(new Date(user.created_date), "dd/MM/yyyy")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
