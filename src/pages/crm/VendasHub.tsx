/**
 * Hub Vendas — Funil (Quadro) + Oportunidades (Lista) em abas.
 */
import { lazy } from "react";
import { TrendingUp, Users } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const CRMFunil = lazy(() => import("@/pages/crm/CRMFunil"));
const Oportunidades = lazy(() => import("@/pages/crm/Oportunidades"));

export default function VendasHub() {
  return (
    <HubTabs
      tabs={[
        { value: "board", label: "Quadro", icon: TrendingUp, element: <CRMFunil /> },
        { value: "lista", label: "Lista", icon: Users, element: <Oportunidades /> },
      ]}
    />
  );
}
