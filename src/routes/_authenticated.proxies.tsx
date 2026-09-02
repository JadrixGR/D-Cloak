import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Loader2, Plus, Trash2 } from "lucide-react";
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
import { api, type ProxyInput, type ProxyType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/proxies")({
  head: () => ({
    meta: [
      { title: "Pool de proxies · NovaShield" },
      {
        name: "description",
        content:
          "Administra el pool de proxies reutilizables, prueba latencia e IP detectada y asígnalos a perfiles.",
      },
      { property: "og:title", content: "Pool de proxies · NovaShield" },
      {
        property: "og:description",
        content: "Proxies HTTP, SOCKS5 y túneles SSH con test de latencia e IP detectada.",
      },
    ],
  }),
  component: ProxiesPage,
});

const EMPTY: ProxyInput = {
  label: "",
  type: "socks5",
  host: "",
  port: 1080,
  username: null,
  password: null,
  country: "PE",
};

function ProxiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProxyInput>(EMPTY);

  const proxiesQuery = useQuery({ queryKey: ["proxies"], queryFn: api.listProxies });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["proxies"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const testMutation = useMutation({
    mutationFn: (id: string) => api.testProxy(id, user!),
    onSuccess: (proxy) => {
      invalidate();
      if (proxy.healthy)
        toast.success(`${proxy.label}: ${proxy.latency_ms} ms · ${proxy.detected_ip}`);
      else toast.error(`${proxy.label} no respondió`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: (input: ProxyInput) => api.createProxy(input),
    onSuccess: () => {
      invalidate();
      toast.success("Proxy añadido al pool");
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProxy(id),
    onSuccess: () => {
      invalidate();
      toast.success("Proxy eliminado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="red de salida"
        title="Proxies"
        description="Pool reutilizable de nodos de salida. Prueba cada nodo antes de asignarlo a una instancia."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Añadir proxy
          </Button>
        }
      />

      {proxiesQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(proxiesQuery.data ?? []).map((proxy) => {
            const busy = testMutation.isPending && testMutation.variables === proxy.id;
            return (
              <div key={proxy.id} className="panel space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{proxy.label}</p>
                    <p className="tabular truncate text-xs text-muted-foreground">
                      {proxy.host}:{proxy.port}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-[10px] uppercase",
                      proxy.healthy
                        ? "border-success/40 text-success"
                        : "border-destructive/40 text-destructive",
                    )}
                  >
                    {proxy.healthy ? "activo" : "sin verificar"}
                  </Badge>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Tipo</dt>
                    <dd className="font-mono uppercase">{proxy.type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">País</dt>
                    <dd className="font-mono">{proxy.country}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latencia</dt>
                    <dd className="tabular">{proxy.latency_ms ? `${proxy.latency_ms} ms` : "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">IP detectada</dt>
                    <dd className="tabular">{proxy.detected_ip ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Perfiles</dt>
                    <dd className="tabular">{proxy.profiles_count}</dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => testMutation.mutate(proxy.id)}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Activity className="size-3.5" />
                    )}
                    Probar nodo
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar proxy"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(proxy.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Añadir proxy</SheetTitle>
            <SheetDescription>
              Este nodo quedará disponible para todos tus perfiles.
            </SheetDescription>
          </SheetHeader>
          <form
            className="space-y-5 px-4 pb-8"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="label">Etiqueta</Label>
              <Input
                id="label"
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Residencial MX-CDMX"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as ProxyType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                    <SelectItem value="ssh">SSH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">País (ISO)</Label>
                <Input
                  id="country"
                  maxLength={2}
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input
                  id="host"
                  required
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="font-mono text-xs"
                  placeholder="node.proxy.net"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Puerto</Label>
                <Input
                  id="port"
                  type="number"
                  required
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                  className="tabular"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={form.username ?? ""}
                  onChange={(e) => setForm({ ...form, username: e.target.value || null })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password ?? ""}
                  onChange={(e) => setForm({ ...form, password: e.target.value || null })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar proxy
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
