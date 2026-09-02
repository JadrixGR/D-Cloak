import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { USING_MOCK_BACKEND } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/profiles", label: "Perfiles", icon: Fingerprint },
  { to: "/proxies", label: "Proxies", icon: Network },
  { to: "/activity", label: "Actividad", icon: Activity },
  { to: "/settings", label: "Ajustes", icon: Settings },
  { to: "/admin/users", label: "Usuarios", icon: Users, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  function handleLogout() {
    logout();
    navigate({ to: "/login", replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
            {item.adminOnly ? (
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-violet">
                adm
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-sidebar-border pt-4">
      <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 p-3">
        <div className="grid size-9 place-items-center rounded-md bg-primary/15 font-display text-sm font-semibold text-primary">
          {user?.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn(
            "font-mono text-[10px] uppercase tracking-wider",
            isAdmin ? "border-violet/40 text-violet" : "border-primary/40 text-primary",
          )}
        >
          {isAdmin ? "Administrador" : "Usuario estándar"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="size-4" />
          Salir
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Brand />
        <div className="mt-6 flex flex-1 flex-col">{nav}</div>
        {identity}
      </aside>

      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 lg:hidden">
        <Brand compact />
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Menú">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-[57px] bottom-0 z-40 flex flex-col overflow-y-auto border-b border-border bg-sidebar p-4 lg:hidden">
          {nav}
          <div className="mt-6">{identity}</div>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {USING_MOCK_BACKEND ? (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
              <ShieldCheck className="size-3.5" />
              Modo simulado: define <code className="font-mono">VITE_API_BASE_URL</code> para
              conectar el backend Python.
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-lg border border-primary/40 bg-primary/10 glow-ring">
        <Fingerprint className="size-4.5 text-primary" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-bold tracking-tight">NOVASHIELD</p>
        {!compact ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            antidetect core
          </p>
        ) : null}
      </div>
    </div>
  );
}
