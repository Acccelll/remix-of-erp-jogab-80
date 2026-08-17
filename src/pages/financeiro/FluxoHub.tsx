/**
 * Hub Fluxo & Dívidas — agrupa fluxo de caixa e evolução de dívidas.
 */
import { lazy } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const FinFluxo = lazy(() => import("@/pages/financeiro/FinFluxo"));
const FinDividas = lazy(() => import("@/pages/financeiro/FinDividas"));

export default function FluxoHub() {
  return (
    <HubTabs
      tabs={[
        { value: "fluxo", label: "Fluxo de Caixa", icon: TrendingUp, element: <FinFluxo /> },
        {
          value: "dividas",
          label: "Evolução de Dívidas",
          icon: TrendingDown,
          element: <FinDividas />,
        },
      ]}
    />
  );
}
