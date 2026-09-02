import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type ActivityEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Registro de actividad · NovaShield" },
      {
        name: "description",
        content:
          "Historial cronológico de sesiones, arranques, pausas y pruebas de proxy en la consola antidetect.",
      },
      { property: "og:title", content: "Registro de actividad · NovaShield" },
      {
        property: "og:description",
        content: "Auditoría de acciones por perfil, proxy y usuario.",
      },
    ],
  }),
  component: ActivityPage,
});

const LEVEL_STYLES: Record<ActivityEntry["level"], string> = {
  info: "border-primary/40 text-primary",
  warn: "border-warning/40 text-warning",
  error: "border-destructive/40 text-destructive",
};

function ActivityPage() {
  const { user, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const activityQuery = useQuery({ queryKey: ["activity"], queryFn: api.listActivity });

  const entries = useMemo(() => {
    const all = activityQuery.data ?? [];
    const scoped = isAdmin ? all : all.filter((e) => e.actor_name === user?.name);
    if (!query) return scoped;
    return scoped.filter((e) =>
      `${e.target} ${e.action} ${e.detail} ${e.actor_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  }, [activityQuery.data, isAdmin, user?.name, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="auditoría"
        title="Actividad"
        description={
          isAdmin
            ? "Todas las acciones registradas en la plataforma, en orden cronológico inverso."
            : "Tus acciones registradas en la plataforma, en orden cronológico inverso."
        }
      />

      <Input
        placeholder="Filtrar por perfil, proxy, acción o usuario…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {activityQuery.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <ol className="panel divide-y divide-border overflow-hidden">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="tabular w-36 shrink-0 text-xs text-muted-foreground">
                {new Date(entry.at).toLocaleString("es", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span
                className={cn(
                  "w-fit shrink-0 rounded border bg-surface-raised/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                  LEVEL_STYLES[entry.level],
                )}
              >
                {entry.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.target}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {entry.detail}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{entry.actor_name}</span>
            </li>
          ))}
          {entries.length === 0 ? (
            <li className="px-4 py-16 text-center text-sm text-muted-foreground">
              Sin registros que coincidan.
            </li>
          ) : null}
        </ol>
      )}
    </div>
  );
}
