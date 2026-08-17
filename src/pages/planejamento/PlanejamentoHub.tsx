/**
 * Hub de Planejamento Lean — agrupa Dashboard, Lean, Pacotes, Restrições,
 * Lookahead, PPC, Riscos, Lições e RDO em abas.
 */
import { lazy } from "react";
import {
  Gauge,
  Activity,
  Package,
  ShieldAlert,
  CalendarRange,
  BarChart3,
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Upload,
} from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const PlanejamentoDashboard = lazy(() => import("@/pages/planejamento/PlanejamentoDashboard"));
const PlanejamentoDashLean = lazy(() => import("@/pages/planejamento/DashboardLean"));
const PacotesTrabalho = lazy(() => import("@/pages/planejamento/PacotesTrabalho"));
const PlanejamentoRestricoes = lazy(() => import("@/pages/planejamento/Restricoes"));
const PlanejamentoLookahead = lazy(() => import("@/pages/planejamento/Lookahead"));
const PlanejamentoPPC = lazy(() => import("@/pages/planejamento/PPC"));
const PlanejamentoRiscos = lazy(() => import("@/pages/planejamento/Riscos"));
const PlanejamentoLicoes = lazy(() => import("@/pages/planejamento/LicoesAprendidas"));
const PlanejamentoRdo = lazy(() => import("@/pages/planejamento/RdoConsolidado"));
const ChecklistImport = lazy(() => import("@/pages/planejamento/ChecklistImport"));

export default function PlanejamentoHub() {
  return (
    <HubTabs
      tabs={[
        { value: "dashboard", label: "Dashboard", icon: Gauge, element: <PlanejamentoDashboard /> },
        {
          value: "lean",
          label: "Dashboard Lean",
          icon: Activity,
          element: <PlanejamentoDashLean />,
        },
        { value: "pacotes", label: "Pacotes", icon: Package, element: <PacotesTrabalho /> },
        {
          value: "restricoes",
          label: "Restrições",
          icon: ShieldAlert,
          element: <PlanejamentoRestricoes />,
        },
        {
          value: "lookahead",
          label: "Lookahead",
          icon: CalendarRange,
          element: <PlanejamentoLookahead />,
        },
        { value: "ppc", label: "PPC & Causas", icon: BarChart3, element: <PlanejamentoPPC /> },
        { value: "riscos", label: "Riscos", icon: AlertTriangle, element: <PlanejamentoRiscos /> },
        { value: "licoes", label: "Lições", icon: BookOpen, element: <PlanejamentoLicoes /> },
        { value: "rdo", label: "RDO", icon: ClipboardList, element: <PlanejamentoRdo /> },
        {
          value: "checklist-import",
          label: "Importar Checklist",
          icon: Upload,
          element: <ChecklistImport />,
        },
      ]}
    />
  );
}
