import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, Loader2, Lock, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, type PlatformSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Ajustes globales · NovaShield" },
      {
        name: "description",
        content:
          "Configura la IP del servidor por defecto, la huella base y los límites de concurrencia de la plataforma.",
      },
      { property: "og:title", content: "Ajustes globales · NovaShield" },
      {
        property: "og:description",
        content: "IP del servidor por defecto, zona horaria base y protección WebRTC.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (patch: PlatformSettings) => api.updateSettings(patch, user!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["activity"] });
      toast.success("Ajustes guardados");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(passwords.current, passwords.next),
    onSuccess: () => {
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Contraseña actualizada. Inicia sesión de nuevo.");
      logout();
      void navigate({ to: "/login", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!form) return <Skeleton className="h-96 w-full" />;

  const disabled = !isAdmin;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="configuración"
        title="Ajustes globales"
        description="Valores por defecto que heredan todos los perfiles nuevos y la salida de red compartida."
      />

      {disabled ? (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Solo un administrador puede modificar estos valores.
        </p>
      ) : null}

      <form
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate(form);
        }}
      >
        <section className="panel space-y-5 p-5">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Salida de red</h2>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip">IP del servidor por defecto</Label>
            <Input
              id="ip"
              disabled={disabled}
              value={form.default_server_ip}
              onChange={(e) => setForm({ ...form, default_server_ip: e.target.value })}
              className="tabular"
            />
            <p className="text-xs text-muted-foreground">
              Los perfiles sin proxy individual saldrán por esta dirección.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-raised/50 p-3">
            <div>
              <p className="text-sm font-medium">Protección WebRTC</p>
              <p className="text-xs text-muted-foreground">Evita fugas de la IP real del host.</p>
            </div>
            <Switch
              disabled={disabled}
              checked={form.webrtc_protection}
              onCheckedChange={(v) => setForm({ ...form, webrtc_protection: v })}
            />
          </div>
        </section>

        <section className="panel space-y-5 p-5">
          <h2 className="text-base font-semibold">Huella y arranque</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tz">Zona horaria base</Label>
              <Input
                id="tz"
                disabled={disabled}
                value={form.default_timezone}
                onChange={(e) => setForm({ ...form, default_timezone: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Idioma base</Label>
              <Input
                id="loc"
                disabled={disabled}
                value={form.default_locale}
                onChange={(e) => setForm({ ...form, default_locale: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Perfiles concurrentes máximos</Label>
            <Input
              id="max"
              type="number"
              min={1}
              disabled={disabled}
              value={form.max_concurrent_profiles}
              onChange={(e) =>
                setForm({ ...form, max_concurrent_profiles: Number(e.target.value) })
              }
              className="tabular"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-raised/50 p-3">
            <div>
              <p className="text-sm font-medium">Iniciar al crear</p>
              <p className="text-xs text-muted-foreground">
                Levanta la instancia justo después de crearla.
              </p>
            </div>
            <Switch
              disabled={disabled}
              checked={form.auto_start_on_create}
              onCheckedChange={(v) => setForm({ ...form, auto_start_on_create: v })}
            />
          </div>
        </section>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={disabled || saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar ajustes
          </Button>
        </div>
      </form>

      <form
        className="panel max-w-2xl space-y-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (passwords.next !== passwords.confirm) {
            toast.error("La confirmación no coincide");
            return;
          }
          passwordMutation.mutate();
        }}
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Seguridad de la cuenta</h2>
            <p className="text-xs text-muted-foreground">
              Cambia la contraseña temporal después del primer acceso.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.current}
              onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={passwords.next}
              onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={passwords.confirm}
              onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
            />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={passwordMutation.isPending}>
          {passwordMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Actualizar contraseña
        </Button>
      </form>
    </div>
  );
}
