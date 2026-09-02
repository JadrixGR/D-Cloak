import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell, Brand } from "@/components/app/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "anonymous") navigate({ to: "/login", replace: true });
  }, [status, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center grid-backdrop">
        <div className="flex flex-col items-center gap-4">
          <Brand />
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            verificando sesión…
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
