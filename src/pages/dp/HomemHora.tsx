import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHomemHora, useCustoPrevisto } from "@/hooks/dp/usePonto";
import { formatMinutes, minutesToHours } from "@/lib/ponto/formatMinutes";
import { JORNADA_MENSAL_HORAS } from "@/lib/dp/codigos";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { formatBRL } from "@/lib/core/currency";

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const fmtBRL = (n: number) => formatBRL(n, { maxDigits: 2 });

export default function HomemHora() {
  const { colaboradores, obras } = useCatalogos();
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const { data: hh = [] } = useHomemHora(competencia);
  const { data: custoPrev = [] } = useCustoPrevisto(competencia);

  const colabById = useMemo(() => new Map(colaboradores.map((c) => [c.id, c])), [colaboradores]);
  const obraById = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);

  // Custo previsto por colaborador. Inclui todos os encargos patronais e encargos sobre provisões,
  // alinhado com o custo_total do holerite (fonte única de "custo da empresa").
  const custoMap = useMemo(() => {
    const m = new Map<string, { salarioBase: number; custoPrevisto: number }>();
    for (const c of custoPrev as any[]) {
      const salarioBase = Number(c.salario_base || 0);
      const custoPrevisto =
        Number(c.proventos || 0) +
        Number(c.inss_empresa || 0) +
        Number(c.rat || 0) +
        Number(c.inss_terceiros || 0) +
        Number(c.fgts || 0) +
        Number(c.provisao_13 || 0) +
        Number(c.provisao_ferias || 0) +
        Number(c.inss_provisao_13 || 0) +
        Number(c.fgts_provisao_13 || 0) +
        Number(c.inss_provisao_ferias || 0) +
        Number(c.fgts_provisao_ferias || 0);
      m.set(c.colaborador_id, { salarioBase, custoPrevisto });
    }
    return m;
  }, [custoPrev]);

  // Horas reais totais por colaborador no mês (para ratear custo previsto entre obras).
  const hRealPorColab = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of hh) {
      if (!row.colaborador_id) continue;
      m.set(row.colaborador_id, (m.get(row.colaborador_id) ?? 0) + row.horas_realizadas_min);
    }
    return m;
  }, [hh]);

  const linhas = useMemo(() => {
    return hh.map((row) => {
      const colab = row.colaborador_id ? colabById.get(row.colaborador_id) : null;
      const obra = row.obra_id ? obraById.get(row.obra_id) : null;
      const custo = row.colaborador_id ? custoMap.get(row.colaborador_id) : undefined;
      const hPrev = minutesToHours(row.horas_previstas_min);
      const hReal = minutesToHours(row.horas_realizadas_min);
      const hHE = minutesToHours(row.horas_extra_total_min);
      const salarioBase = custo?.salarioBase ?? 0;
      const custoPrevistoMensal = custo?.custoPrevisto ?? 0;
      // Rateio do custo previsto entre as obras do mesmo colaborador, proporcional às horas reais.
      const hRealTotal = row.colaborador_id ? (hRealPorColab.get(row.colaborador_id) ?? 0) : 0;
      const fatorRateio =
        hRealTotal > 0
          ? row.horas_realizadas_min / hRealTotal
          : hh.filter((x) => x.colaborador_id === row.colaborador_id).length > 0
            ? 1 / hh.filter((x) => x.colaborador_id === row.colaborador_id).length
            : 1;
      const custoPrevisto = custoPrevistoMensal * fatorRateio;
      // R$/h: salário base sobre jornada contratual (220h/mês) — não distorce com HE.
      const valorHora = salarioBase > 0 ? salarioBase / JORNADA_MENSAL_HORAS : 0;
      const horasNormais = Math.min(hReal, hPrev);
      const custoBase = horasNormais * valorHora;
      const custoHE =
        minutesToHours(row.horas_extra_50_min) * valorHora * 1.5 +
        minutesToHours(row.horas_extra_60_min) * valorHora * 1.6 +
        minutesToHours(row.horas_extra_100_min) * valorHora * 2.0;
      const custoRealizado = custoBase + custoHE;
      const aderencia = hPrev > 0 ? (hReal / hPrev) * 100 : 0;
      const desvio =
        custoPrevisto > 0 ? ((custoRealizado - custoPrevisto) / custoPrevisto) * 100 : 0;
      const semPonto = hReal === 0 && hPrev > 0;
      return {
        ...row,
        nomeColab: colab?.nome ?? "—",
        funcao: colab?.funcao ?? "",
        nomeObra: obra?.nome ?? "—",
        hPrev,
        hReal,
        hHE,
        salarioBase,
        valorHora,
        custoBase,
        custoHE,
        custoPrevisto,
        custoRealizado,
        aderencia,
        desvio,
        semPonto,
      };
    });
  }, [hh, colabById, obraById, custoMap, hRealPorColab]);

  const totais = useMemo(() => {
    return linhas.reduce(
      (a, l) => ({
        hPrev: a.hPrev + l.hPrev,
        hReal: a.hReal + l.hReal,
        hHE: a.hHE + l.hHE,
        custoPrev: a.custoPrev + l.custoPrevisto,
        custoReal: a.custoReal + l.custoRealizado,
      }),
      { hPrev: 0, hReal: 0, hHE: 0, custoPrev: 0, custoReal: 0 },
    );
  }, [linhas]);

  const desvioGlobal =
    totais.custoPrev > 0 ? ((totais.custoReal - totais.custoPrev) / totais.custoPrev) * 100 : 0;

  // Sem ponto: colaboradores com custo previsto mas sem registros (filtra null)
  const semPonto = useMemo(() => {
    const idsComPonto = new Set(hh.map((r) => r.colaborador_id).filter(Boolean));
    return (custoPrev as any[])
      .filter((c) => c.colaborador_id && !idsComPonto.has(c.colaborador_id))
      .map((c) => colabById.get(c.colaborador_id))
      .filter(Boolean) as any[];
  }, [hh, custoPrev, colabById]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Homem/Hora</h1>
          <p className="text-sm text-muted-foreground">
            Confronto Previsto × Realizado cruzando previsão de custo com o ponto importado.
          </p>
        </div>
        <div>
          <label className="text-xs block mb-1">Competência</label>
          <Input
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            className="w-44"
          />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Σ Hr Previstas</div>
          <div className="text-xl font-bold tabular-nums">{totais.hPrev.toFixed(0)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Σ Hr Realizadas</div>
          <div className="text-xl font-bold tabular-nums">{totais.hReal.toFixed(0)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Σ Horas Extras</div>
          <div className="text-xl font-bold tabular-nums">{totais.hHE.toFixed(0)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Custo Previsto</div>
          <div className="text-lg font-bold">{fmtBRL(totais.custoPrev)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Custo Realizado</div>
          <div className="text-lg font-bold">{fmtBRL(totais.custoReal)}</div>
        </Card>
        <Card
          className={`p-4 border-l-4 ${desvioGlobal > 5 ? "border-destructive/40" : desvioGlobal < -5 ? "border-success/40" : "border-warning/40"}`}
        >
          <div className="text-xs text-muted-foreground">Desvio %</div>
          <div className="text-xl font-bold">{desvioGlobal.toFixed(1)}%</div>
        </Card>
      </div>

      <Card className="p-4 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead className="text-right">Hr Prev.</TableHead>
              <TableHead className="text-right">Hr Real.</TableHead>
              <TableHead className="text-right">HE</TableHead>
              <TableHead className="text-right">Aderência</TableHead>
              <TableHead className="text-right">Salário Base</TableHead>
              <TableHead className="text-right">
                R$/h{" "}
                <span className="text-[10px] text-muted-foreground font-normal">(SB/220h)</span>
              </TableHead>
              <TableHead className="text-right">Custo Prev.</TableHead>
              <TableHead className="text-right">Custo Base</TableHead>
              <TableHead className="text-right">Custo HE</TableHead>
              <TableHead className="text-right">Custo Real.</TableHead>
              <TableHead className="text-right">Desvio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{l.nomeColab}</TableCell>
                <TableCell className="text-xs">{l.funcao}</TableCell>
                <TableCell className="text-xs">{l.nomeObra}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinutes(l.horas_previstas_min)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinutes(l.horas_realizadas_min)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMinutes(l.horas_extra_total_min)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.aderencia.toFixed(0)}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(l.salarioBase)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.valorHora > 0 ? (
                    fmtBRL(l.valorHora)
                  ) : (
                    <span className="text-warning text-xs">Sem salário</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(l.custoPrevisto)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(l.custoBase)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(l.custoHE)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtBRL(l.custoRealizado)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${l.desvio > 5 ? "text-destructive" : l.desvio < -5 ? "text-success" : "text-warning"}`}
                >
                  {l.desvio.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                  Sem dados de ponto para esta competência. Importe um CSV em DP &rarr; Importar
                  Ponto.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {semPonto.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2 text-warning">
            ⚠️ Colaboradores com previsão de custo mas sem ponto importado ({semPonto.length})
          </h3>
          <div className="text-xs text-muted-foreground mb-3">
            Importe o ponto destes colaboradores para fechar o confronto.
          </div>
          <div className="flex flex-wrap gap-2">
            {semPonto.map((c) => (
              <span
                key={c.id}
                className="text-xs px-2 py-1 rounded bg-warning/10 border border-warning/40"
              >
                {c.nome}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
