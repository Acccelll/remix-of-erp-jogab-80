// Conciliação Ponto × Folha — a HE apurada bate com a paga?
//
// Os dois lados sempre estiveram no banco e nunca foram cruzados. A ponte entre
// minutos e reais é o salário base do holerite; o DSR sai da comparação porque
// já está somado em `horas_extras_valor` (rubricas 250 e 854 pertencem a
// HE_CODIGOS *e* a DSR_HE_CODIGOS).
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kpi } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";
import { useHomemHora } from "@/hooks/dp/usePonto";
import { useDpHolerites } from "@/hooks/dp/useDpHolerites";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import {
  ROTULO_SITUACAO,
  conciliar,
  resumirConciliacao,
  type HoleriteDaCompetencia,
  type LinhaConciliacao,
  type PontoDaCompetencia,
  type SituacaoConciliacao,
} from "@/lib/ponto/conciliacaoFolha";
import { DSR_HE_CODIGOS } from "@/lib/dp/codigos";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { formatBRL } from "@/lib/core/currency";
import { cleanCPF } from "@/lib/utils";

const fmtDinheiro = (n: number) => formatBRL(n, { maxDigits: 2 });

const TOM_SITUACAO: Record<
  SituacaoConciliacao,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ok: "default",
  pago_a_maior: "destructive",
  pago_a_menor: "destructive",
  sem_holerite: "secondary",
  sem_ponto: "secondary",
  sem_salario_base: "outline",
};

export default function PontoConciliacaoFolha() {
  const { colaboradores } = useCatalogos();
  const { fim } = usePontoFiltros();
  // A conciliação é por competência fechada, não pelo intervalo livre do hub:
  // a folha é mensal. O padrão é a competência do fim do período filtrado.
  const [competencia, setCompetencia] = useState(fim.slice(0, 7));
  const [soDivergentes, setSoDivergentes] = useState(true);

  const homemHora = useHomemHora(competencia);
  const { rows: holerites, loading: carregandoHolerites } = useDpHolerites();

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );
  const colabIdPorCpf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of colaboradores) {
      const cpf = cleanCPF(c.cpf);
      if (cpf) m.set(cpf, c.id);
    }
    return m;
  }, [colaboradores]);

  /** `dpHomemHora` vem por colaborador × obra — some as obras da pessoa. */
  const pontos = useMemo<PontoDaCompetencia[]>(() => {
    const m = new Map<string, PontoDaCompetencia>();
    for (const h of homemHora.data ?? []) {
      if (!h.colaborador_id) continue;
      const atual = m.get(h.colaborador_id) ?? {
        chave: h.colaborador_id,
        colaboradorId: h.colaborador_id,
        nome: nomePorId.get(h.colaborador_id) ?? h.colaborador_id,
        he50Min: 0,
        he60Min: 0,
        he100Min: 0,
        horasFaltaMin: 0,
        diasFalta: 0,
      };
      atual.he50Min += h.horas_extra_50_min;
      atual.he60Min += h.horas_extra_60_min;
      atual.he100Min += h.horas_extra_100_min;
      atual.horasFaltaMin += h.horas_falta_min;
      atual.diasFalta += h.dias_falta;
      m.set(h.colaborador_id, atual);
    }
    return Array.from(m.values());
  }, [homemHora.data, nomePorId]);

  const folha = useMemo<HoleriteDaCompetencia[]>(() => {
    return holerites
      .filter((h) => h.competencia === competencia)
      .map((h) => {
        const colaboradorId = h.colaborador_id ?? colabIdPorCpf.get(cleanCPF(h.cpf)) ?? null;
        const dsr = h.verbas
          .filter((v) => DSR_HE_CODIGOS.has(v.codigo))
          .reduce((a, v) => a + v.valor, 0);
        return {
          // Sem vínculo, o CPF é a chave — some do cruzamento se agrupado por id nulo.
          chave: colaboradorId ?? `cpf:${cleanCPF(h.cpf)}`,
          colaboradorId,
          nome: colaboradorId
            ? (nomePorId.get(colaboradorId) ?? h.nome_lido ?? "")
            : (h.nome_lido ?? ""),
          salarioBase: h.salario_base,
          heValorTotal: h.horas_extras_valor,
          dsrValor: dsr,
        };
      });
  }, [holerites, competencia, colabIdPorCpf, nomePorId]);

  const linhas = useMemo(() => conciliar(pontos, folha), [pontos, folha]);
  const resumo = useMemo(() => resumirConciliacao(linhas), [linhas]);

  const visiveis = useMemo(
    () => (soDivergentes ? linhas.filter((l) => l.situacao !== "ok") : linhas),
    [linhas, soDivergentes],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <Kpi
            label="Pago a maior"
            value={fmtDinheiro(resumo.totalPagoAMaior)}
            tone="danger"
            size="lg"
            hint="folha acima do que o ponto apurou"
          />
          <Kpi
            label="Pago a menor"
            value={fmtDinheiro(resumo.totalPagoAMenor)}
            tone="warning"
            size="lg"
            hint="passivo trabalhista em aberto"
          />
          <Kpi
            label="Colaboradores divergentes"
            value={resumo.divergentes}
            size="lg"
            hint={`de ${resumo.colaboradores} conciliados`}
          />
          <Kpi
            label="Pendências de dado"
            value={resumo.semHolerite + resumo.semPonto + resumo.semSalarioBase}
            tone="muted"
            size="lg"
            hint={`${resumo.semHolerite} sem holerite · ${resumo.semPonto} sem ponto`}
          />
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Competência</label>
            <Input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-40"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer h-10">
            <input
              type="checkbox"
              checked={soDivergentes}
              onChange={(e) => setSoDivergentes(e.target.checked)}
            />
            Só divergências
          </label>
        </div>
      </div>

      <QueryState
        isLoading={homemHora.isLoading || carregandoHolerites}
        isError={homemHora.isError}
        error={homemHora.error}
        data={visiveis}
        onRetry={() => homemHora.refetch()}
        isEmpty={(xs) => xs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground space-y-2">
            {linhas.length === 0 ? (
              <>
                <p>Nada a conciliar em {competencia}.</p>
                <p className="text-xs">
                  É preciso ter ponto importado e holerites da mesma competência.
                </p>
              </>
            ) : (
              <p>Nenhuma divergência em {competencia} — todos dentro da tolerância.</p>
            )}
          </Card>
        }
      >
        {(xs) => (
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">HE 50%</TableHead>
                  <TableHead className="text-right">HE 60%</TableHead>
                  <TableHead className="text-right">HE 100%</TableHead>
                  <TableHead className="text-right">Salário base</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Pago (s/ DSR)</TableHead>
                  <TableHead className="text-right">DSR</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xs.slice(0, 300).map((l: LinhaConciliacao) => (
                  <TableRow key={l.chave}>
                    <TableCell className="font-medium text-xs">{l.nome}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatMinutes(l.he50Min)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatMinutes(l.he60Min)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatMinutes(l.he100Min)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {l.salarioBase > 0 ? fmtDinheiro(l.salarioBase) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {l.valorEsperado === null ? "—" : fmtDinheiro(l.valorEsperado)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {fmtDinheiro(l.valorPago)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {l.dsrPago > 0 ? fmtDinheiro(l.dsrPago) : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-xs ${
                        l.diferenca === null
                          ? ""
                          : l.diferenca > 0
                            ? "text-destructive font-semibold"
                            : l.diferenca < 0
                              ? "text-warning font-semibold"
                              : ""
                      }`}
                    >
                      {l.diferenca === null ? "—" : fmtDinheiro(l.diferenca)}
                      {l.diferencaPct !== null && Math.abs(l.diferencaPct) >= 1 && (
                        <span className="text-muted-foreground ml-1">
                          ({l.diferencaPct > 0 ? "+" : ""}
                          {l.diferencaPct.toFixed(0)}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TOM_SITUACAO[l.situacao]}>
                        {ROTULO_SITUACAO[l.situacao]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-xs text-muted-foreground mt-3 space-y-1">
              <p>
                O esperado sai do salário base do holerite ÷ 220h, com adicional de 50%, 60% e 100%
                por faixa. O DSR sobre HE fica fora da comparação — ele já está somado no total de
                horas extras do holerite.
              </p>
              <p>
                Faltas apuradas no ponto aparecem no Espelho e nas Tratativas; o desconto
                correspondente não entra aqui porque a rubrica de falta não está mapeada em{" "}
                <code>codigos.ts</code>.
              </p>
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
