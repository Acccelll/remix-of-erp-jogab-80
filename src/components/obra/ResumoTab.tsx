import { ResumoContrato } from "@/components/obra/ResumoContrato";
import { ResumoFinanceiroTotvs } from "@/components/obra/ResumoFinanceiroTotvs";
import { ConfrontoOperacionalCard } from "@/components/obra/ConfrontoOperacionalCard";
import { ReguaEditor } from "@/components/obra/ReguaEditor";
import { SemAcessoModulo } from "@/components/common/SemAcessoModulo";

export type ResumoTabProps = {
  obra: any;
  obraId: string;
  valorContratoAtual: number;
  valorContratoOriginal?: number | null;
  faturado: number;
  recebido: number;
  previstoReceber: number;
  saldoAFaturar: number;
  pctFisicoRealizado: number;
  pctFisicoPrevisto: number;
  pctFaturado: number;
  bmsPrev: any[];
  receb: any[];
  nfs: any[];
  /**
   * Sem a PageKey `financeiro`: os cards de contrato, faturamento e
   * recebimento dão lugar ao aviso. Não basta escondê-los — as consultas
   * financeiras ficam desligadas, então os totais chegariam zerados e um
   * "R$ 0,00" seria lido como fato sobre a obra.
   */
  semAcessoFinanceiro?: boolean;
  onIrCronograma?: () => void;
  onVerAnalise?: () => void;
  onReguaSaved?: () => void;
};

/**
 * Fase 0: aba "Resumo" que compõe os 4 cards executivos da obra.
 * Antes era renderizada always-on no topo do detalhe — agora é apenas a
 * aba default do rail.
 */
export function ResumoTab(p: ResumoTabProps) {
  if (p.semAcessoFinanceiro) {
    return (
      <div className="space-y-6">
        <SemAcessoModulo
          modulo="Financeiro"
          contexto="os valores de contrato, faturamento e recebimento desta obra"
        />
        <ReguaEditor obra={p.obra} aReceber={0} onSaved={p.onReguaSaved} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResumoContrato
        valorContratoAtual={p.valorContratoAtual}
        valorContratoOriginal={p.valorContratoOriginal}
        faturado={p.faturado}
        recebido={p.recebido}
        previstoReceber={p.previstoReceber}
        saldoAFaturar={p.saldoAFaturar}
        pctFisicoRealizado={p.pctFisicoRealizado}
        pctFisicoPrevisto={p.pctFisicoPrevisto}
        pctFaturado={p.pctFaturado}
        onIrCronograma={p.onIrCronograma}
      />

      <ResumoFinanceiroTotvs obraId={p.obraId} centroCustoTotvs={p.obra?.centro_custo_totvs} />

      <ConfrontoOperacionalCard
        obraId={p.obraId}
        bmsPrev={p.bmsPrev}
        receb={p.receb}
        nfs={p.nfs}
        onVerAnalise={p.onVerAnalise}
      />

      <ReguaEditor
        obra={p.obra}
        aReceber={p.previstoReceber - p.recebido}
        onSaved={p.onReguaSaved}
      />
    </div>
  );
}
