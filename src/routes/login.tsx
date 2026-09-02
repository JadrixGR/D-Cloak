import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USING_MOCK_BACKEND } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión · NovaShield" },
      {
        name: "description",
        content:
          "Accede a la consola NovaShield con tu cuenta de administrador o usuario estándar.",
      },
      { property: "og:title", content: "Iniciar sesión · NovaShield" },
      {
        property: "og:description",
        content: "Autenticación con roles de administrador y usuario estándar.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(USING_MOCK_BACKEND ? "admin@antidetect.io" : "");
  const [password, setPassword] = useState(USING_MOCK_BACKEND ? "admin123" : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "authenticated") navigate({ to: "/dashboard", replace: true });
  }, [status, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(email, password);
      toast.success(`Bienvenido, ${user.name}`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-backdrop lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border p-12 lg:flex">
        <Brand />
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">
            Control total de tus <span className="text-primary">huellas digitales</span>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Orquesta cientos de perfiles aislados, asigna proxies individuales o la IP del servidor
            por defecto, y sigue cada sesión desde un único panel.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["Perfiles aislados", "∞"],
              ["Latencia media", "38 ms"],
              ["Uptime nodos", "99.9%"],
            ].map(([label, value]) => (
              <div key={label}>
                <dd className="tabular text-lg text-primary">{value}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          backend python · render ready
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          <div className="panel p-6 sm:p-8">
            <div className="flex items-center gap-2 text-primary">
              <LockKeyhole className="size-4" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
                acceso seguro
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Usa tus credenciales de la plataforma.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending ? "Verificando…" : "Entrar a la consola"}
              </Button>
            </form>

            {USING_MOCK_BACKEND ? (
              <div className="mt-6 space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" /> Cuentas de demostración
                </p>
                <p className="font-mono">admin@antidetect.io · admin123</p>
                <p className="font-mono">user@antidetect.io · user123</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
