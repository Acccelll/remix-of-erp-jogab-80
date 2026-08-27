/**
 * Hub Contratos — cobre DUAS entidades de negócio diferentes que só
 * compartilham a palavra "contrato" e esta rota-guarda-chuva:
 *
 * - Locação (abas Painel/Quadro/Lista): contratos de locação de
 *   equipamento/máquina ou serviço terceirizado ("locacao_servico",
 *   "tipo_maquina" — ver `case 'contratos':` em api.php), mobilizados por
 *   obra no mesmo padrão de Frotas/Patrimônios. Vive 100% em MySQL
 *   (`useContratos.ts`/`ContratosContext`).
 * - Fornecimento (aba Fornecimento): contrato de fornecimento com
 *   medições e aditivos, Postgres nativo (`useContratosFornecimento.ts`).
 *
 * Rotas/tabelas internas não foram renomeadas (mudaria o contrato da rota
 * MySQL já em uso); só os rótulos visíveis foram desambiguados — ver
 * documento de system design (system-design v0, §5.4/§9) para o histórico
 * dessa decisão.
 *
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
            label: "Painel de Locações",
            icon: LayoutDashboard,
            element: <ContratosOverview />,
          },
          {
            value: "board",
            label: "Quadro de Locações",
            icon: FileSignature,
            element: <QuadroContratos />,
          },
          { value: "lista", label: "Locações", icon: Files, element: <Contratos /> },
          {
            value: "fornecimento",
            label: "Contratos de Fornecimento",
            icon: Handshake,
            element: <Fornecimento />,
          },
        ]}
      />
    </div>
  );
}
