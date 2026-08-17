/**
 * Hub Estoque & Recebimento — agrupa saldos de estoque, recebimento de NF
 * e (PRO-012) planos de contagem cíclica.
 */
import { lazy } from "react";
import { Boxes, PackageCheck, ClipboardList } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Estoque = lazy(() => import("@/pages/suprimentos/Estoque"));
const Recebimento = lazy(() => import("@/pages/suprimentos/Recebimento"));
const ContagensCiclicas = lazy(() => import("@/pages/suprimentos/ContagensCiclicas"));

export default function EstoqueHub() {
  return (
    <HubTabs
      tabs={[
        { value: "estoque", label: "Estoque", icon: Boxes, element: <Estoque /> },
        {
          value: "recebimento",
          label: "Recebimento",
          icon: PackageCheck,
          element: <Recebimento />,
        },
        {
          value: "contagens",
          label: "Contagens",
          icon: ClipboardList,
          element: <ContagensCiclicas />,
        },
      ]}
    />
  );
}
