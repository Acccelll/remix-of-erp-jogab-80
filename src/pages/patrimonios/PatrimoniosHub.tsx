/**
 * Hub Patrimônios — Board (Kanban) + Lista em abas.
 */
import { lazy } from "react";
import { Package, Archive } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const QuadroPatrimonios = lazy(() => import("@/pages/patrimonios/QuadroPatrimonios"));
const Patrimonios = lazy(() => import("@/pages/patrimonios/Patrimonios"));

export default function PatrimoniosHub() {
  return (
    <HubTabs
      tabs={[
        { value: "board", label: "Quadro", icon: Package, element: <QuadroPatrimonios /> },
        { value: "lista", label: "Lista", icon: Archive, element: <Patrimonios /> },
      ]}
    />
  );
}
