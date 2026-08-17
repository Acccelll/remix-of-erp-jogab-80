import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileText, Download, MoreVertical, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { brl } from "@/lib/billing";
import { StatusObraBadge, type ObraStatus } from "@/components/obra/StatusObraBadge";
import { exportObraToExcel } from "@/lib/obras/export";
import { exportObraToPDF } from "@/lib/obras/export-pdf";
import {
  empresaParametrizacaoRepo,
  getInstitucionalHeaderLines,
} from "@/lib/empresa/parametrizacao";
import { LimparImportadosButton } from "@/components/obra-detalhe/LimparImportadosButton";
import { ObraTabs } from "@/components/obra-detalhe/ObraTabs";
import { EditObraDialog } from "@/components/obra/EditObraDialog";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { obrasRepo } from "@/lib/repositories/obras";
import {
  cronogramaFns as cronogramaRepo,
  cronogramaRevisoesFns as cronogramaRevisoesRepo,
} from "@/hooks/obras/useCronograma";
import {
  medicoesRepo,
  itensMedicaoRepo,
  notasFiscaisRepo,
  recebimentosRepo,
} from "@/lib/repositories/medicoes";
import { bmsPrevistasRepo, bmsRedistribuicaoRepo } from "@/lib/repositories/obraDetalhe";
import { financeiroRepo } from "@/lib/repositories/financeiro";
import { useObraMembership } from "@/hooks/obras/useObraMembership";
import { syncObraToSupabase } from "@/lib/obras/sync";
import { useAntecipacaoObraCusto } from "@/hooks/useAntecipacaoNfse";

function ObraDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasAccess } = usePermissions();
  const { obras, updateObra } = useObrasContext();
  const { canEdit: canEditMembership, canManage } = useObraMembership(id);
  // Gate final: precisa da permissão global (RBAC de página) E do vínculo com a obra.
  const canEdit = hasAccess("obras_div", "editar") && canEditMembership;
  // Dados financeiros da obra (medições, NFs, recebimentos, BMs) exigem o
  // módulo Financeiro. Desligar as consultas evita 403 repetido a cada visita e
  // — mais importante — impede que as abas exibam totais zerados como se
  // fossem reais. As abas mostram o aviso do que falta (ver ObraTabs).
  const temFinanceiro = hasAccess("financeiro", "visualizar");
  const [editOpen, setEditOpen] = useState(false);
  const [repairingObra, setRepairingObra] = useState(false);
  const [repairAttempted, setRepairAttempted] = useState(false);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
  const localObra = obras.find(
    (o) => String(o.flowcastId) === String(id) || String(o.id) === String(id),
  );
  const rawTab = searchParams.get("tab") ?? "resumo";
  // Fase 2 — compat de deep link: `?tab=gantt|comparar` viraram visões
  // internas de Cronograma (`?tab=cronograma&cView=…`). Redireciona em background.
  useEffect(() => {
    if (rawTab === "gantt" || rawTab === "comparar") {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("tab", "cronograma");
          p.set("cView", rawTab);
          return p;
        },
        { replace: true },
      );
    }
  }, [rawTab, setSearchParams]);
  const tab = rawTab === "gantt" || rawTab === "comparar" ? "cronograma" : rawTab;
  const setTab = (v: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", v);
        // Ao trocar de aba principal, limpar a sub-visão do cronograma para não vazar estado.
        if (v !== "cronograma") p.delete("cView");
        return p;
      },
      { replace: true },
    );
  };

  const {
    data: obra,
    isLoading: obraLoading,
    isError: obraIsError,
    error: obraError,
  } = useQuery({
    queryKey: ["obra", id],
    queryFn: async () => (isUuid ? obrasRepo.getById(id!) : null),
  });
  const canLoadObraRelations = isUuid && !!obra;
  const canLoadFinanceiro = canLoadObraRelations && temFinanceiro;
  useEffect(() => {
    if (obra !== null || !localObra || repairAttempted) return;

    setRepairAttempted(true);
    setRepairingObra(true);
    syncObraToSupabase(localObra)
      .then((newId) => {
        updateObra(localObra.id, { flowcastId: newId });
        const query = searchParams.toString();
        navigate(`/obras/${newId}${query ? `?${query}` : ""}`, { replace: true });
      })
      .catch((err: any) => toast.error(err?.message ?? "Não foi possível abrir a obra"))
      .finally(() => setRepairingObra(false));
  }, [obra, localObra, repairAttempted, navigate, searchParams, updateObra]);

  const { data: crono } = useQuery({
    queryKey: ["crono", id],
    queryFn: async () => cronogramaRepo.listByObra(id!),
    enabled: canLoadObraRelations,
  });
  const { data: medicoes } = useQuery({
    queryKey: ["medicoes", id],
    queryFn: async () => medicoesRepo.listByObra(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: itensMedicao } = useQuery({
    queryKey: ["itens_medicao", id],
    queryFn: async () => itensMedicaoRepo.listByMedicaoIds((medicoes ?? []).map((m: any) => m.id)),
    enabled: canLoadFinanceiro && !!medicoes?.length,
  });
  const { data: nfs } = useQuery({
    queryKey: ["nfs", id],
    queryFn: async () => notasFiscaisRepo.listByObra(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: receb } = useQuery({
    queryKey: ["receb", id],
    queryFn: async () => recebimentosRepo.listByObra(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: bmsPrev } = useQuery({
    queryKey: ["bms_prev", id],
    queryFn: async () => bmsPrevistasRepo.listByObra(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: redistrib } = useQuery({
    queryKey: ["bms_redistribuicao", id],
    queryFn: async () => bmsRedistribuicaoRepo.listByObra(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: revisoes } = useQuery({
    queryKey: ["revisoes", id],
    queryFn: async () => cronogramaRevisoesRepo.listByObra(id!),
    enabled: canLoadObraRelations,
  });
  const { data: valores } = useQuery({
    queryKey: ["obra_valores", id],
    queryFn: async () => financeiroRepo.vwObraValores(id!),
    enabled: canLoadFinanceiro,
  });
  const { data: antecipCusto } = useAntecipacaoObraCusto(canLoadObraRelations ? id : undefined);

  if (!obra && !obraIsError && (obraLoading || obra === undefined || repairingObra)) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-9 w-9" />
        </div>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
          <Skeleton className="h-32 rounded-lg md:row-span-2" />
          <div className="grid gap-3 grid-cols-2 md:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!obra || obraIsError) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Link
          to="/obras"
          className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Obra não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            O vínculo local desta obra estava desatualizado ou o registro não existe mais no
            backend.
          </p>
          {obraIsError && (
            <p className="text-sm text-destructive">
              {(obraError as any)?.message ?? "Erro ao carregar obra"}
            </p>
          )}
        </div>
      </div>
    );
  }

  const totalFaturado = Number(valores?.faturamento_liquido ?? 0);
  const totalRecebido = Number(valores?.receita_baixada ?? 0);
  const totalPrevisto = Number(valores?.receita_a_receber ?? 0) + totalRecebido;
  const valorContratoAtual = Number(valores?.valor_contrato_atual ?? obra.valor_contrato ?? 0);
  const valorContratoOriginal =
    valores?.valor_contrato_original != null
      ? Number(valores.valor_contrato_original)
      : Number(obra.valor_contrato ?? 0);
  const pctFat = valorContratoAtual ? (totalFaturado / valorContratoAtual) * 100 : 0;
  const saldoAFaturar = Math.max(0, valorContratoAtual - totalFaturado);

  // Avanço físico previsto × realizado
  // Usamos os valores agregados que já consideram custo/baseline se disponíveis,
  // mas como fallback a lógica do frontend permanece a mesma para consistência visual.
  const somaCustoBase = (crono ?? []).reduce(
    (a: number, i) => a + Number(i.custo_baseline ?? i.custo ?? 0),
    0,
  );
  const somaPrevExec = (crono ?? []).reduce((a: number, i) => {
    const custo = Number(i.custo_baseline ?? i.custo ?? 0);
    const base =
      custo > 0
        ? custo
        : (Number(i.percentual_previsto || 0) / 100) * Number(obra.valor_contrato || 0);
    return a + base;
  }, 0);
  const somaRealExec = (crono ?? []).reduce((a: number, i) => {
    const custo = Number(i.custo_baseline ?? i.custo ?? 0);
    const base =
      custo > 0
        ? custo
        : (Number(i.percentual_previsto || 0) / 100) * Number(obra.valor_contrato || 0);
    return a + (base * Number(i.percentual_realizado || 0)) / 100;
  }, 0);
  const denomFisico = valorContratoAtual > 0 ? valorContratoAtual : somaCustoBase || 1;

  // No detalhe da obra, o percentual físico pode vir da visão consolidada se disponível,
  // caso contrário usamos o cálculo local dos itens do cronograma.
  const pctFisicoReal =
    valores?.valor_executado && valorContratoAtual > 0
      ? (Number(valores.valor_executado) / valorContratoAtual) * 100
      : (somaRealExec / denomFisico) * 100;

  const pctFisicoPrev =
    valores?.valor_planejado_baseline && valorContratoAtual > 0
      ? (Number(valores.valor_planejado_baseline) / valorContratoAtual) * 100
      : (somaPrevExec / denomFisico) * 100;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link
        to="/financeiro/obras"
        className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-semibold">{obra.nome}</h1>
          <p className="text-sm text-muted-foreground">
            Cód. {obra.codigo} · {obra.clientes?.nome ?? "—"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusObraBadge obra={obra} />
            <Select
              value={(obra.status ?? "em_andamento") as string}
              disabled={!canEdit}
              onValueChange={async (v) => {
                try {
                  await obrasRepo.update(id!, { status: v as ObraStatus });
                } catch (err: any) {
                  return toast.error(err?.message ?? "Erro");
                }
                toast.success("Status atualizado");
                qc.invalidateQueries({ queryKey: ["obra", id] });
              }}
            >
              <SelectTrigger className="h-7 text-xs w-[160px]" aria-label="Alterar status da obra">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="paralisada">Paralisada</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Previsão término:</span>
              <DatePickerField
                className="w-[150px]"
                inputClassName="h-7 text-xs"
                aria-label="Previsão de término da obra"
                disabled={!canEdit}
                value={obra.data_previsao_termino ?? obra.data_fim ?? ""}
                onChange={async (novaData) => {
                  const v = novaData || null;
                  try {
                    await obrasRepo.update(id!, { data_previsao_termino: v });
                  } catch (err: any) {
                    return toast.error(err?.message ?? "Erro");
                  }
                  qc.invalidateQueries({ queryKey: ["obra", id] });
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 flex-wrap">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              aria-label="Editar obra"
            >
              <Pencil className="h-4 w-4 mr-2" /> Editar obra
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Mais ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() =>
                  exportObraToExcel({
                    obra,
                    medicoes: medicoes ?? [],
                    itensMedicao: itensMedicao ?? [],
                    nfs: nfs ?? [],
                    recebimentos: receb ?? [],
                    crono: crono ?? [],
                  })
                }
              >
                <Download className="h-4 w-4 mr-2" /> Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  exportObraToPDF({
                    obra,
                    medicoes: medicoes ?? [],
                    itensMedicao: itensMedicao ?? [],
                    nfs: nfs ?? [],
                    recebimentos: receb ?? [],
                    crono: crono ?? [],
                    logoDataUrl:
                      typeof (obra as any)?.empresa_id === "string"
                        ? (empresaParametrizacaoRepo.get((obra as any).empresa_id).logoUrl ??
                          undefined)
                        : undefined,
                    institucionalLines: getInstitucionalHeaderLines(
                      typeof (obra as any)?.empresa_id === "string"
                        ? (obra as any).empresa_id
                        : null,
                    ),
                  })
                }
              >
                <FileText className="h-4 w-4 mr-2" /> Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <LimparImportadosButton
                asMenuItem
                obraId={id}
                temMedicoes={(medicoes ?? []).length > 0}
                temNfs={(nfs ?? []).length > 0}
                temRecebimentos={(receb ?? []).some((r: any) => r.data_recebimento)}
                onDone={() => {
                  qc.invalidateQueries({ queryKey: ["crono", id] });
                  qc.invalidateQueries({ queryKey: ["revisoes", id] });
                  qc.invalidateQueries({ queryKey: ["receb", id] });
                  qc.invalidateQueries({ queryKey: ["nfs", id] });
                  qc.invalidateQueries({ queryKey: ["medicoes", id] });
                  qc.invalidateQueries({ queryKey: ["itens_medicao", id] });
                  qc.invalidateQueries({ queryKey: ["obra_valores", id] });
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Fase 0 — barra de contexto enxuta: KPIs sintéticos sempre visíveis.
          Os 4 cards executivos foram movidos para a aba "Resumo". */}
      <div
        className="rounded-lg border bg-muted/30 px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4"
        role="group"
        aria-label="Indicadores resumidos da obra"
      >
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Contrato
          </div>
          <div
            className="text-sm font-semibold tabular-nums truncate"
            title={brl(valorContratoAtual)}
          >
            {brl(valorContratoAtual)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Faturado
          </div>
          <div className="text-sm font-semibold tabular-nums">{pctFat.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Físico realizado
          </div>
          <div className="text-sm font-semibold tabular-nums">{pctFisicoReal.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Físico previsto
          </div>
          <div className="text-sm font-semibold tabular-nums text-muted-foreground">
            {pctFisicoPrev.toFixed(1)}%
          </div>
        </div>
      </div>

      {antecipCusto && antecipCusto.titulos > 0 && (
        <Link
          to="/financeiro/antecipacao"
          className="block rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/10 transition"
          title="Ver operações de antecipação"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">
              Custo de antecipação
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1 min-w-0">
              <MiniStat label="Face antecipada" value={brl(antecipCusto.valorFace)} />
              <MiniStat label="Deságio" value={brl(antecipCusto.desagio)} />
              <MiniStat
                label="IOF + tarifas"
                value={brl(antecipCusto.iof + antecipCusto.tarifas)}
              />
              <MiniStat label="Custo total" value={brl(antecipCusto.custoTotal)} strong />
              <MiniStat
                label="% do faturado"
                value={
                  totalFaturado > 0
                    ? `${((antecipCusto.valorFace / totalFaturado) * 100).toFixed(1)}%`
                    : "—"
                }
              />
            </div>
          </div>
        </Link>
      )}

      <ObraTabs
        obra={obra}
        id={id}
        tab={tab}
        setTab={setTab}
        canEdit={canEdit}
        canManage={canManage}
        crono={crono ?? []}
        medicoes={medicoes ?? []}
        itensMedicao={itensMedicao ?? []}
        nfs={nfs ?? []}
        receb={receb ?? []}
        bmsPrev={bmsPrev ?? []}
        redistrib={redistrib ?? []}
        revisoes={revisoes ?? []}
        qc={qc}
        resumoProps={{
          valorContratoAtual,
          valorContratoOriginal,
          faturado: totalFaturado,
          recebido: totalRecebido,
          previstoReceber: totalPrevisto,
          saldoAFaturar,
          pctFisicoRealizado: pctFisicoReal,
          pctFisicoPrevisto: pctFisicoPrev,
          pctFaturado: pctFat,
        }}
      />

      <EditObraDialog
        obra={obra}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["obra", id] })}
      />
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`tabular-nums truncate ${strong ? "text-sm font-semibold text-amber-700 dark:text-amber-400" : "text-sm font-medium"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export type { BmsAberturaRequest } from "@/components/obra-detalhe/ObraTabs";

export { recalcularPrevisaoNF } from "@/lib/cronograma/recalculo";

export default ObraDetail;
