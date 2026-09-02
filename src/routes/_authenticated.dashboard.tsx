import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Fingerprint,
  Network,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel de control · NovaShield" },
      {
        name: "description",
        content:
          "Estadísticas de uso, perfiles activos y salud de proxies en la consola antidetect NovaShield.",
      },
      { property: "og:title", content: "Panel de control · NovaShield" },
      {
        property: "og:description",
        content: "Métricas de sesiones, perfiles en ejecución y estado de la red de proxies.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: api.listProfiles });
  const activity = useQuery({ queryKey: ["activity"], queryFn: api.listActivity });

  const cards = [
    {
      label: "Perfiles totales",
      value: stats.data?.profiles_total,
      icon: Fingerprint,
      accent: "text-primary",
    },
    {
      label: "En ejecución",
      value: stats.data?.profiles_running,
      icon: PlayCircle,
      accent: "text-success",
    },
    {
      label: "Pausados",
      value: stats.data?.profiles_paused,
      icon: PauseCircle,
      accent: "text-warning",
    },
    {
      label: "Sesiones hoy",
      value: stats.data?.sessions_today,
      icon: Activity,
      accent: "text-violet",
    },
    {
      label: "Proxies sanos",
      value: stats.data ? `${stats.data.proxies_healthy}/${stats.data.proxies_total}` : undefined,
      icon: Network,
      accent: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="visión general"
        title="Panel de control"
        description="Telemetría en vivo de tus instancias antidetect, consumo de sesiones y estado de la red."
        actions={
          <Button asChild>
            <Link to="/profiles">
              Gestionar perfiles <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="panel p-4 transition-colors hover:border-border-strong">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <card.icon className={`size-4 ${card.accent}`} />
            </div>
            {card.value === undefined ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : (
              <p className="tabular mt-2 text-3xl font-semibold">{card.value}</p>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Uso de los últimos 7 días</h2>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              sesiones / minutos
            </span>
          </div>
          <div className="mt-6 h-64">
            {stats.data ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.data.usage} margin={{ left: -20, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    name="Minutos"
                    stroke="var(--chart-2)"
                    fill="url(#gMinutes)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    name="Sesiones"
                    stroke="var(--chart-1)"
                    fill="url(#gSessions)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="size-full" />
            )}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-base font-semibold">Actividad reciente</h2>
          <ul className="mt-4 space-y-3">
            {(activity.data ?? []).slice(0, 6).map((entry) => (
              <li key={entry.id} className="border-b border-border/60 pb-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-primary">{entry.action}</span>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {new Date(entry.at).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm">{entry.target}</p>
                <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>
              </li>
            ))}
            {!activity.data ? <Skeleton className="h-40 w-full" /> : null}
          </ul>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Perfiles activos</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/profiles">Ver todos</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {(profiles.data ?? []).slice(0, 5).map((profile) => (
            <li
              key={profile.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm hover:bg-surface-raised/60"
            >
              <span className="min-w-40 flex-1 truncate font-medium">{profile.name}</span>
              <StatusPill status={profile.status} />
              <span className="tabular text-xs text-muted-foreground">{profile.effective_ip}</span>
              <span className="text-xs text-muted-foreground">{profile.os}</span>
            </li>
          ))}
          {!profiles.data ? <Skeleton className="m-5 h-32" /> : null}
        </ul>
      </section>
    </div>
  );
}
