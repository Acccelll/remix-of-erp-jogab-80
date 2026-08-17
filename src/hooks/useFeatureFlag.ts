import { useQuery } from "@tanstack/react-query";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";

/**
 * H3.1.a — Resolve uma feature flag para uma obra (ou globalmente).
 * Fallback: flag específica da obra > flag global > false.
 */
export function useFeatureFlag(flagKey: string, obraId?: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["feature_flag", flagKey, obraId ?? null],
    queryFn: () => featureFlagsRepo.isEnabled(flagKey, obraId ?? null),
    staleTime: 60_000,
  });
  return { enabled: Boolean(data), isLoading };
}
