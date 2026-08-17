/**
 * Hub de Qualidade — unifica Inspeções, NCs, Agenda, QR Codes e Dashboard
 * em abas, eliminando 4 itens redundantes do menu lateral.
 */
import { lazy } from "react";
import { ClipboardList, Gauge, CalendarRange, QrCode, ShieldAlert } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Inspecoes = lazy(() => import("@/pages/qualidade/Inspecoes"));
const InspecoesDashboard = lazy(() => import("@/pages/qualidade/InspecoesDashboard"));
const InspecoesAgenda = lazy(() => import("@/pages/qualidade/InspecoesAgenda"));
const InspecoesQR = lazy(() => import("@/pages/qualidade/InspecoesQR"));
const NaoConformidades = lazy(() => import("@/pages/qualidade/NaoConformidades"));

export default function QualidadeHub() {
  return (
    <HubTabs
      tabs={[
        { value: "lista", label: "Inspeções", icon: ClipboardList, element: <Inspecoes /> },
        { value: "dashboard", label: "Dashboard", icon: Gauge, element: <InspecoesDashboard /> },
        { value: "agenda", label: "Agenda", icon: CalendarRange, element: <InspecoesAgenda /> },
        { value: "qr", label: "QR Codes", icon: QrCode, element: <InspecoesQR /> },
        {
          value: "ncs",
          label: "Não Conformidades",
          icon: ShieldAlert,
          element: <NaoConformidades />,
        },
      ]}
    />
  );
}
