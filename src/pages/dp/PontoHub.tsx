/**
 * Hub de Ponto — agrupa as telas de apuração e conformidade do ponto eletrônico.
 * O recorte (período, obra, colaborador) é único e vive na URL, então trocar de aba
 * mantém o que estava sendo analisado.
 */
import { lazy, Suspense, useState } from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileCheck,
  HardDrive,
  RefreshCw,
  Scale,
  Upload,
  UserSearch,
  Users,
  Wallet,
} from "lucide-react";
import HubTabs, { type HubTabDef } from "@/components/common/HubTabs";
import PontoFiltrosBar from "@/components/dp/PontoFiltrosBar";
import PontoFechamentoBar from "@/components/dp/PontoFechamentoBar";
import { RhidSyncDialog } from "@/components/dp/RhidSyncDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { usePermissions } from "@/contexts/auth/usePermissions";

const PontoAnalise = lazy(() => import("@/pages/dp/PontoAnalise"));
const PontoEspelho = lazy(() => import("@/pages/dp/PontoEspelho"));
const PontoTratativas = lazy(() => import("@/pages/dp/PontoTratativas"));
const PontoJustificativas = lazy(() => import("@/pages/dp/PontoJustificativas"));
const PontoBancoHoras = lazy(() => import("@/pages/dp/PontoBancoHoras"));
const PontoConciliacaoFolha = lazy(() => import("@/pages/dp/PontoConciliacaoFolha"));
const PontoConciliacaoCadastro = lazy(() => import("@/pages/dp/PontoConciliacaoCadastro"));
const PontoRelogiosAfd = lazy(() => import("@/pages/dp/PontoRelogiosAfd"));
const PontoSincronizacoes = lazy(() => import("@/pages/dp/PontoSincronizacoes"));
// Pesada (parser de CSV + relatório de validação): só carrega ao abrir a gaveta.
const PontoImportar = lazy(() => import("@/pages/dp/PontoImportar"));

export default function PontoHub() {
  const filtros = usePontoFiltros();
  const { isGM } = usePermissions();
  const [importarAberto, setImportarAberto] = useState(false);

  // O AFD carrega CPF e PIS de toda a base: a aba nem aparece para quem não é
  // GM (a própria página repete a checagem, para o deep link também barrar).
  const abaFiscal: HubTabDef[] = isGM
    ? [
        {
          value: "relogios",
          label: "Relógios & AFD",
          icon: HardDrive,
          element: <PontoRelogiosAfd />,
        },
      ]
    : [];

  return (
    <div className="p-6">
      <HubTabs
        header={
          <div className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Ponto</h1>
                <p className="text-sm text-muted-foreground">
                  Apuração, exceções e conformidade do ponto eletrônico
                </p>
              </div>
              <div className="flex gap-2">
                <RhidSyncDialog />
                <Sheet open={importarAberto} onOpenChange={setImportarAberto}>
                  <SheetTrigger asChild>
                    <Button>
                      <Upload className="w-4 h-4 mr-2" /> Importar CSV
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Importar relatório de ponto</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <Suspense
                        fallback={
                          <div className="text-sm text-muted-foreground py-8">Carregando…</div>
                        }
                      >
                        <PontoImportar />
                      </Suspense>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </header>
            <PontoFiltrosBar filtros={filtros} />
            <PontoFechamentoBar inicio={filtros.inicio} fim={filtros.fim} />
          </div>
        }
        tabs={[
          {
            value: "analise",
            label: "Visão Geral",
            icon: BarChart3,
            element: <PontoAnalise />,
          },
          {
            value: "espelho",
            label: "Espelho",
            icon: UserSearch,
            element: <PontoEspelho />,
          },
          {
            value: "tratativas",
            label: "Tratativas",
            icon: ClipboardCheck,
            element: <PontoTratativas />,
          },
          {
            value: "justificativas",
            label: "Justificativas",
            icon: FileCheck,
            element: <PontoJustificativas />,
          },
          {
            value: "banco-horas",
            label: "Banco de Horas",
            icon: Wallet,
            element: <PontoBancoHoras />,
          },
          {
            value: "folha",
            label: "Ponto × Folha",
            icon: Scale,
            element: <PontoConciliacaoFolha />,
          },
          {
            value: "cadastro",
            label: "Cadastro RHiD",
            icon: Users,
            element: <PontoConciliacaoCadastro />,
          },
          ...abaFiscal,
          {
            value: "sincronizacoes",
            label: "Sincronizações",
            icon: RefreshCw,
            element: <PontoSincronizacoes />,
          },
        ]}
      />
    </div>
  );
}
