/**
 * Hub de Suprimentos — porta única para compras, produção, cadastros,
 * orçamento, estoque/recebimento e configurações do módulo.
 */
import { lazy } from "react";
import {
  BarChart3,
  Boxes,
  Calculator,
  ClipboardList,
  FileText,
  Kanban,
  Layers,
  Package,
  PackageCheck,
  Scale,
  Settings,
  ShieldAlert,
  Truck,
} from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const Compras = lazy(() => import("@/pages/suprimentos/QuadroCompras"));
const Producao = lazy(() => import("@/pages/suprimentos/QuadroProducao"));
const Requisicoes = lazy(() => import("@/pages/suprimentos/Requisicoes"));
const Cotacoes = lazy(() => import("@/pages/suprimentos/Cotacoes"));
const OrdensCompra = lazy(() => import("@/pages/suprimentos/OrdensCompra"));
const Estoque = lazy(() => import("@/pages/suprimentos/Estoque"));
const Recebimento = lazy(() => import("@/pages/suprimentos/Recebimento"));
const Fornecedores = lazy(() => import("@/pages/suprimentos/Fornecedores"));
const Insumos = lazy(() => import("@/pages/suprimentos/Insumos"));
const Composicoes = lazy(() => import("@/pages/suprimentos/Composicoes"));
const Orcamento = lazy(() => import("@/pages/suprimentos/Orcamento"));
const CurvaABC = lazy(() => import("@/pages/suprimentos/CurvaABC"));
const Alcadas = lazy(() => import("@/pages/suprimentos/Alcadas"));
const GruposNegociacao = lazy(() => import("@/pages/suprimentos/GruposNegociacao"));

export default function SuprimentosHub() {
  return (
    <HubTabs
      tabs={[
        { value: "compras", label: "Compras", icon: Kanban, element: <Compras /> },
        { value: "producao", label: "Produção", icon: Kanban, element: <Producao /> },
        { value: "requisicoes", label: "Requisições", icon: ClipboardList, element: <Requisicoes /> },
        { value: "cotacoes", label: "Cotações", icon: Scale, element: <Cotacoes /> },
        { value: "ordens", label: "Ordens", icon: FileText, element: <OrdensCompra /> },
        { value: "estoque", label: "Estoque", icon: Boxes, element: <Estoque /> },
        {
          value: "recebimento",
          label: "Recebimento",
          icon: PackageCheck,
          element: <Recebimento />,
        },
        { value: "fornecedores", label: "Fornecedores", icon: Truck, element: <Fornecedores /> },
        { value: "insumos", label: "Insumos", icon: Package, element: <Insumos /> },
        { value: "composicoes", label: "Composições", icon: Layers, element: <Composicoes /> },
        { value: "orcamento", label: "Orçamento", icon: Calculator, element: <Orcamento /> },
        { value: "curva-abc", label: "Curva ABC", icon: BarChart3, element: <CurvaABC /> },
        { value: "alcadas", label: "Alçadas", icon: ShieldAlert, element: <Alcadas /> },
        { value: "grupos", label: "Grupos", icon: Settings, element: <GruposNegociacao /> },
      ]}
    />
  );
}