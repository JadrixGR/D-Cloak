import { cn } from "@/lib/utils";
import type { ProfileStatus } from "@/lib/api";

const MAP: Record<ProfileStatus, { label: string; dot: string; text: string; ring: string }> = {
  running: {
    label: "En ejecución",
    dot: "bg-success",
    text: "text-success",
    ring: "border-success/40 bg-success/10",
  },
  paused: {
    label: "Pausado",
    dot: "bg-warning",
    text: "text-warning",
    ring: "border-warning/40 bg-warning/10",
  },
  stopped: {
    label: "Detenido",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "border-border-strong bg-muted/40",
  },
  error: {
    label: "Con error",
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/40 bg-destructive/10",
  },
};

export function StatusPill({ status }: { status: ProfileStatus }) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        s.ring,
        s.text,
      )}
    >
      <span className="relative flex size-1.5">
        {status === "running" && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              s.dot,
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", s.dot)} />
      </span>
      {s.label}
    </span>
  );
}
