/**
 * Hub Contratos — Painel + Board (Kanban) + Lista + Fornecimento em abas.
 * PRO-019: banner de alertas de vencimento/renovação no topo.
 * PRO-032.slice-01: nova aba Painel com indicadores consolidados M12.
 */
import { lazy } from "react";
import { FileSignature, Files, Handshake, LayoutDashboard } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";
import ContratosAlertaBanner from "@/components/contratos/ContratosAlertaBanner";
import ContratosOverview from "@/components/contratos/ContratosOverview";

const QuadroContratos = lazy(() => import("@/pages/contratos/QuadroContratos"));
const Contratos = lazy(() => import("@/pages/contratos/Contratos"));
const Fornecimento = lazy(() => import("@/pages/contratos/Fornecimento"));

export default function ContratosHub() {
  return (
    <div className="space-y-3">
      <ContratosAlertaBanner />
      <HubTabs
        tabs={[
          {
            value: "painel",
            label: "Painel",
            icon: LayoutDashboard,
            element: <ContratosOverview />,
          },
          { value: "board", label: "Quadro", icon: FileSignature, element: <QuadroContratos /> },
          { value: "lista", label: "Lista", icon: Files, element: <Contratos /> },
          {
            value: "fornecimento",
            label: "Fornecimento",
            icon: Handshake,
            element: <Fornecimento />,
          },
        ]}
      />
    </div>
  );
}
