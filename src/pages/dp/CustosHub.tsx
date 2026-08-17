/**
 * Hub Custos de Pessoal — agrupa Custo do Colaborador, MOD, Provisões,
 * Homem/Hora e Histórico Salarial em abas.
 */
import { lazy } from "react";
import { Calculator, UserCog, Wallet, Timer, LineChart, TrendingUp } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Custos = lazy(() => import("@/pages/dp/Custos"));
const CustoColaboradorObra = lazy(() => import("@/pages/dp/CustoColaboradorObra"));
const Provisoes = lazy(() => import("@/pages/dp/Provisoes"));
const HomemHora = lazy(() => import("@/pages/dp/HomemHora"));
const HistoricoSalarial = lazy(() => import("@/pages/dp/HistoricoSalarial"));
const HorasExtras = lazy(() => import("@/pages/dp/HorasExtras"));

export default function CustosHub() {
  return (
    <HubTabs
      tabs={[
        {
          value: "colaborador",
          label: "Custo do Colaborador",
          icon: Calculator,
          element: <Custos />,
        },
        {
          value: "mod",
          label: "Mão de Obra Direta",
          icon: UserCog,
          element: <CustoColaboradorObra />,
        },
        { value: "provisoes", label: "Provisões", icon: Wallet, element: <Provisoes /> },
        { value: "horas-extras", label: "Horas Extras", icon: TrendingUp, element: <HorasExtras /> },
        { value: "homem-hora", label: "Homem/Hora", icon: Timer, element: <HomemHora /> },
        {
          value: "historico",
          label: "Histórico Salarial",
          icon: LineChart,
          element: <HistoricoSalarial />,
        },
      ]}
    />
  );
}
