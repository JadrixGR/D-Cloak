import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ExternalLink,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { api, type Profile, type ProfileInput, type ProfileStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profiles")({
  head: () => ({
    meta: [
      { title: "Perfiles antidetect · NovaShield" },
      {
        name: "description",
        content:
          "Lista detallada de perfiles antidetect: inicia, pausa o elimina instancias y asigna proxies individuales.",
      },
      { property: "og:title", content: "Perfiles antidetect · NovaShield" },
      {
        property: "og:description",
        content: "Control de instancias, huellas, IP efectiva y proxies por perfil.",
      },
    ],
  }),
  component: ProfilesPage,
});

const EMPTY: ProfileInput = {
  name: "",
  os: "Windows 11",
  timezone: "America/Lima",
  locale: "es-PE",
  use_default_ip: true,
  proxy_id: null,
};

const FILTERS: { value: ProfileStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "running", label: "En ejecución" },
  { value: "paused", label: "Pausados" },
  { value: "stopped", label: "Detenidos" },
  { value: "error", label: "Con error" },
];

function ProfilesPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProfileStatus | "all">("all");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [toDelete, setToDelete] = useState<Profile | null>(null);

  const profilesQuery = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });
  const proxiesQuery = useQuery({ queryKey: ["proxies"], queryFn: api.listProxies });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["profiles"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["proxies"] });
  };

  const launchMutation = useMutation({
    mutationFn: ({ id }: { id: string; tab: Window }) => api.launchProfile(id, user!),
    onSuccess: (launch, vars) => {
      invalidate();
      vars.tab.location.replace(launch.live_view_url);
      toast.success(`${launch.profile.name} abierto en una pestaña nueva`);
    },
    onError: (error: Error, vars) => {
      vars.tab.close();
      toast.error(error.message);
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.stopProfile(id, user!),
    onSuccess: (profile) => {
      invalidate();
      toast.success(`${profile.name} pausado y guardado`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProfile(id, user!),
    onSuccess: () => {
      invalidate();
      toast.success("Perfil eliminado");
      setToDelete(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveMutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      editing ? api.updateProfile(editing.id, input, user!) : api.createProfile(input, user!),
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Perfil actualizado" : "Perfil creado");
      setSheetOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = useMemo(() => {
    const all = profilesQuery.data ?? [];
    const scoped = isAdmin ? all : all.filter((p) => p.owner_id === user?.id);
    return scoped.filter((p) => {
      const matchesQuery =
        !query ||
        `${p.name} ${p.effective_ip} ${p.os} ${p.owner_name}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesFilter = filter === "all" || p.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [profilesQuery.data, isAdmin, user?.id, query, filter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY,
      timezone: settingsQuery.data?.default_timezone ?? EMPTY.timezone,
      locale: settingsQuery.data?.default_locale ?? EMPTY.locale,
    });
    setSheetOpen(true);
  }

  function openEdit(profile: Profile) {
    setEditing(profile);
    setForm({
      name: profile.name,
      os: profile.os,
      timezone: profile.timezone,
      locale: profile.locale,
      use_default_ip: profile.use_default_ip,
      proxy_id: profile.proxy_id,
    });
    setSheetOpen(true);
  }

  function openRemoteProfile(profile: Profile) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Permite las ventanas emergentes para abrir el navegador remoto");
      return;
    }
    tab.opener = null;
    launchMutation.mutate({ id: profile.id, tab });
  }

  const proxies = proxiesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="instancias"
        title="Perfiles"
        description="Cada perfil es un navegador aislado con su propia huella y salida de red. Inicia, pausa o elimina instancias en un clic."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Nuevo perfil
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, IP, sistema o propietario…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {profilesQuery.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : visible.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-16 text-center">
          <p className="text-sm font-medium">Sin perfiles que coincidan</p>
          <p className="text-xs text-muted-foreground">
            Ajusta la búsqueda o crea una nueva instancia.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabla densa */}
          <div className="panel hidden overflow-hidden lg:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Sistema / huella</th>
                  <th className="px-4 py-3 font-medium">IP efectiva</th>
                  <th className="px-4 py-3 font-medium">Proxy</th>
                  <th className="px-4 py-3 font-medium">Última sesión</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((profile) => {
                  const proxy = proxies.find((p) => p.id === profile.proxy_id);
                  const busy =
                    (launchMutation.isPending && launchMutation.variables?.id === profile.id) ||
                    (stopMutation.isPending && stopMutation.variables === profile.id);
                  return (
                    <tr key={profile.id} className="transition-colors hover:bg-surface-raised/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">{profile.owner_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={profile.status} />
                      </td>
                      <td className="px-4 py-3">
                        <p>{profile.os}</p>
                        <p className="text-xs text-muted-foreground">{profile.fingerprint}</p>
                      </td>
                      <td className="tabular px-4 py-3 text-xs">
                        {profile.effective_ip}
                        {profile.use_default_ip ? (
                          <span className="ml-2 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                            server
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {proxy ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Globe
                              className={cn(
                                "size-3.5",
                                proxy.healthy ? "text-success" : "text-destructive",
                              )}
                            />
                            {proxy.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">IP por defecto</span>
                        )}
                      </td>
                      <td className="tabular px-4 py-3 text-xs text-muted-foreground">
                        {profile.last_session_at
                          ? new Date(profile.last_session_at).toLocaleString("es", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          profile={profile}
                          busy={busy}
                          onStart={() => openRemoteProfile(profile)}
                          onStop={() => stopMutation.mutate(profile.id)}
                          onEdit={() => openEdit(profile)}
                          onDelete={() => setToDelete(profile)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <div className="grid gap-3 lg:hidden">
            {visible.map((profile) => {
              const proxy = proxies.find((p) => p.id === profile.proxy_id);
              const busy =
                (launchMutation.isPending && launchMutation.variables?.id === profile.id) ||
                (stopMutation.isPending && stopMutation.variables === profile.id);
              return (
                <div key={profile.id} className="panel space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.os} · {profile.owner_name}
                      </p>
                    </div>
                    <StatusPill status={profile.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">IP efectiva</dt>
                      <dd className="tabular">{profile.effective_ip}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Proxy</dt>
                      <dd className="truncate">{proxy?.label ?? "IP por defecto"}</dd>
                    </div>
                  </dl>
                  <RowActions
                    profile={profile}
                    busy={busy}
                    onStart={() => openRemoteProfile(profile)}
                    onStop={() => stopMutation.mutate(profile.id)}
                    onEdit={() => openEdit(profile)}
                    onDelete={() => setToDelete(profile)}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar perfil" : "Nuevo perfil"}</SheetTitle>
            <SheetDescription>
              Define la huella y la salida de red de esta instancia.
            </SheetDescription>
          </SheetHeader>

          <form
            className="space-y-5 px-4 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Ads Manager · Foxtrot"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sistema</Label>
                <Select
                  value={form.os}
                  onValueChange={(v) => setForm({ ...form, os: v as Profile["os"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Windows 11", "macOS 14", "Linux", "Android 14"].map((os) => (
                      <SelectItem key={os} value={os}>
                        {os}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">Idioma</Label>
                <Input
                  id="locale"
                  value={form.locale}
                  onChange={(e) => setForm({ ...form, locale: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tz">Zona horaria</Label>
              <Input
                id="tz"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-surface-raised/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Usar IP del servidor por defecto</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {settingsQuery.data?.default_server_ip ?? "—"} · definida en Ajustes
                  </p>
                </div>
                <Switch
                  checked={form.use_default_ip}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      use_default_ip: checked,
                      proxy_id: checked ? null : form.proxy_id,
                    })
                  }
                />
              </div>

              {!form.use_default_ip ? (
                <div className="space-y-2">
                  <Label>Proxy individual</Label>
                  <Select
                    value={form.proxy_id ?? ""}
                    onValueChange={(v) => setForm({ ...form, proxy_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un proxy del pool" />
                    </SelectTrigger>
                    <SelectContent>
                      {proxies.map((proxy) => (
                        <SelectItem key={proxy.id} value={proxy.id}>
                          {proxy.label} · {proxy.country} · {proxy.type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Sin proxy seleccionado la instancia no podrá iniciarse.
                  </p>
                </div>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? "Guardar cambios" : "Crear perfil"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{toDelete?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán la huella, cookies y datos de sesión de esta instancia. La acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  profile,
  busy,
  onStart,
  onStop,
  onEdit,
  onDelete,
}: {
  profile: Profile;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const running = profile.status === "running";
  return (
    <div className="flex items-center justify-end gap-1.5">
      {running ? (
        <>
          <Button size="sm" onClick={onStart} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            Abrir
          </Button>
          <Button variant="outline" size="sm" onClick={onStop} disabled={busy}>
            <Pause className="size-3.5" />
            Pausar
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={onStart} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          Abrir perfil
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Configurar perfil">
        <Settings2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Eliminar perfil"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
