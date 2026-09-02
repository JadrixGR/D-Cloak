import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Brand } from "@/components/app/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NovaShield · Acceso a la consola antidetect" },
      {
        name: "description",
        content:
          "Punto de entrada a NovaShield: gestión multi-perfil antidetect con proxies, estadísticas y roles.",
      },
      { property: "og:title", content: "NovaShield · Consola antidetect" },
      {
        property: "og:description",
        content: "Gestión multi-perfil antidetect con proxies individuales y control de sesiones.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate({ to: "/dashboard", replace: true });
    if (status === "anonymous") navigate({ to: "/login", replace: true });
  }, [status, navigate]);

  return (
    <div className="grid min-h-screen place-items-center grid-backdrop">
      <div className="flex flex-col items-center gap-4">
        <Brand />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          inicializando consola…
        </p>
      </div>
    </div>
  );
}
