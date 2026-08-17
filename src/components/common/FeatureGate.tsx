import type { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface FeatureGateProps {
  flag: string;
  obraId?: string | null;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * H3.1.a — Renderiza `children` apenas se a feature flag estiver ligada
 * para a obra (ou globalmente). Default = oculto enquanto carrega.
 */
export function FeatureGate({ flag, obraId, fallback = null, children }: FeatureGateProps) {
  const { enabled, isLoading } = useFeatureFlag(flag, obraId);
  if (isLoading || !enabled) return <>{fallback}</>;
  return <>{children}</>;
}
