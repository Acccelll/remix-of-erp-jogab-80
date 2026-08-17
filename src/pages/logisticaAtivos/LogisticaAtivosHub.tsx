/**
 * Hub Logística (Ativos & Frotas) — Board (Kanban) + Lista de romaneios em abas.
 */
import { lazy } from "react";
import { LayoutGrid, List } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const QuadroRomaneios = lazy(() => import("@/pages/logisticaAtivos/QuadroRomaneios"));
const Romaneios = lazy(() => import("@/pages/logisticaAtivos/Romaneios"));

export default function LogisticaAtivosHub() {
  return (
    <HubTabs
      tabs={[
        { value: "board", label: "Quadro", icon: LayoutGrid, element: <QuadroRomaneios /> },
        { value: "lista", label: "Lista", icon: List, element: <Romaneios /> },
      ]}
    />
  );
}
