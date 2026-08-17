/**
 * Hub Cadastros Financeiros — agrupa Centros de Custo, Naturezas, Clientes
 * e Formas de Pagamento em abas.
 */
import { lazy } from "react";
import { Network, Tags, Contact, CreditCard } from "lucide-react";
import HubTabs from "@/components/common/HubTabs";

const FinCentros = lazy(() => import("@/pages/financeiro/FinCentros"));
const FinNaturezas = lazy(() => import("@/pages/financeiro/FinNaturezas"));
const FinClientes = lazy(() => import("@/pages/financeiro/FinClientes"));
const FormaPagamento = lazy(() => import("@/pages/financeiro/FormaPagamento"));

export default function CadastrosHub() {
  return (
    <HubTabs
      tabs={[
        { value: "centros", label: "Centros de Custo", icon: Network, element: <FinCentros /> },
        { value: "naturezas", label: "Naturezas", icon: Tags, element: <FinNaturezas /> },
        { value: "clientes", label: "Clientes", icon: Contact, element: <FinClientes /> },
        {
          value: "formas",
          label: "Formas de Pagamento",
          icon: CreditCard,
          element: <FormaPagamento />,
        },
      ]}
    />
  );
}
