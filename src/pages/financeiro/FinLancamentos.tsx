import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Plus, Upload } from "lucide-react";

import { TituloManualFormDialog } from "@/components/financeiro/TituloManualFormDialog";
import { TitulosOperacionaisPanel } from "@/components/financeiro/TitulosOperacionaisPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { financeiroTitulosKeys } from "@/lib/repositories/financeiro-titulos";

const FinImportar = lazy(() => import("@/pages/financeiro/FinImportar"));
const FinLancamentosAnalise = lazy(() => import("@/pages/financeiro/FinLancamentosAnalise"));

const ROTA = "/financeiro/lancamentos";

type AbaLancamentos = "erp" | "totvs" | "importar";

function FinLancamentos() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [novoTituloOpen, setNovoTituloOpen] = useState(false);
  const [aba, setAba] = useState<AbaLancamentos>("erp");
  const podeCriar = can(ROTA, "I");
  const podeOperar = can(ROTA, "E");

  function alterarNovoTitulo(open: boolean) {
    setNovoTituloOpen(open);
    if (!open) {
      queryClient.invalidateQueries({ queryKey: financeiroTitulosKeys.list() });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">Lançamentos financeiros</h1>
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" /> ERP canônico
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Operação de contas a pagar e receber do ERP. Snapshots e lançamentos importados do TOTVS permanecem separados na análise.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podeCriar && (
            <Button onClick={() => setNovoTituloOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo título
            </Button>
          )}
          {podeCriar && (
            <Button variant="outline" onClick={() => setAba("importar")}>
              <Upload className="mr-2 h-4 w-4" /> Importar TOTVS
            </Button>
          )}
        </div>
      </header>

      <TituloManualFormDialog open={novoTituloOpen} onOpenChange={alterarNovoTitulo} />

      <Tabs value={aba} onValueChange={(value) => setAba(value as AbaLancamentos)} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="erp">Títulos ERP</TabsTrigger>
          <TabsTrigger value="totvs">Análise TOTVS</TabsTrigger>
          {podeCriar && <TabsTrigger value="importar">Importação TOTVS</TabsTrigger>}
        </TabsList>

        <TabsContent value="erp" className="mt-0">
          <TitulosOperacionaisPanel
            onNovoTitulo={() => setNovoTituloOpen(true)}
            podeCriar={podeCriar}
            podeOperar={podeOperar}
          />
        </TabsContent>

        <TabsContent value="totvs" className="mt-0">
          <div className="mb-4 rounded-lg border bg-muted/25 px-4 py-3">
            <p className="text-sm font-medium">Dados importados / referência TOTVS</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              As visões abaixo preservam snapshots, confronto e análise por natureza. Elas não são a fonte operacional dos novos títulos ERP.
            </p>
          </div>
          <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Carregando análise TOTVS…</div>}>
            <div className="[&>div]:!p-0 [&>div]:!space-y-4 [&>div>header]:hidden">
              <FinLancamentosAnalise />
            </div>
          </Suspense>
        </TabsContent>

        {podeCriar && (
          <TabsContent value="importar" className="mt-0">
            <div className="mb-4 rounded-lg border bg-muted/25 px-4 py-3">
              <p className="text-sm font-medium">Importação TOTVS</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use esta área para atualizar snapshots e dados de referência do TOTVS sem misturá-los aos títulos operacionais do ERP.
              </p>
            </div>
            <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Carregando importador…</div>}>
              <FinImportar />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default FinLancamentos;
