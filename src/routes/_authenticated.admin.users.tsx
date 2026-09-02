import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Usuarios y roles · NovaShield" },
      {
        name: "description",
        content:
          "Administración de cuentas: alta de usuarios, cambio de rol entre administrador y usuario estándar.",
      },
      { property: "og:title", content: "Usuarios y roles · NovaShield" },
      {
        property: "og:description",
        content: "Gestión de cuentas y permisos de la consola antidetect.",
      },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; name: string; role: Role }>({
    email: "",
    name: "",
    role: "user",
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: api.listUsers,
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createUser(form),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(`Usuario creado · contraseña temporal: ${created.temporary_password}`, {
        duration: 20_000,
      });
      setOpen(false);
      setForm({ email: "", name: "", role: "user" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; role?: Role; status?: "active" | "suspended" }) =>
      api.updateUser(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario actualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) {
    return (
      <div className="panel grid place-items-center gap-3 p-16 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Esta sección solo está disponible para cuentas con rol de Administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="administración"
        title="Usuarios y roles"
        description="Controla quién accede a la consola y con qué nivel de permisos."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Nuevo usuario
          </Button>
        }
      />

      {usersQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-surface-raised/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Último acceso</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(usersQuery.data ?? []).map((u) => (
                <tr key={u.id} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.role}
                      onValueChange={(v) => updateMutation.mutate({ id: u.id, role: v as Role })}
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="user">Usuario estándar</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[10px] uppercase",
                        u.status === "active"
                          ? "border-success/40 text-success"
                          : "border-destructive/40 text-destructive",
                      )}
                    >
                      {u.status === "active" ? "activo" : "suspendido"}
                    </Badge>
                  </td>
                  <td className="tabular px-4 py-3 text-xs text-muted-foreground">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString("es", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          id: u.id,
                          status: u.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      {u.status === "active" ? "Suspender" : "Reactivar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuevo usuario</SheetTitle>
            <SheetDescription>
              Se creará con una contraseña temporal que el usuario deberá cambiar.
            </SheetDescription>
          </SheetHeader>
          <form
            className="space-y-5 px-4 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuario estándar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear usuario
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
