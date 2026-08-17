import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Banner global: aparece quando a Planifik (api.php) acumula 3 falhas em 5 min.
 * Estado é atualizado por `src/lib/api.ts` via evento `planifik:status`.
 */
export function PlanifikStatusBanner() {
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ healthy: boolean }>).detail;
      if (detail) setHealthy(detail.healthy);
    };
    window.addEventListener("planifik:status", onStatus);
    return () => window.removeEventListener("planifik:status", onStatus);
  }, []);

  if (healthy) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>Planifik indisponível — algumas ações podem falhar.</span>
    </div>
  );
}
