// Banco de Horas — saldo por colaborador e o passivo que ele representa.
//
// `banco_saldo_min` já era gravado a cada importação e nenhuma tela mostrava.
// Saldo positivo é hora a pagar ou a compensar; negativo é desconto a fazer.
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "@/components/ui/chart";
import { Kpi } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";
import { usePontoRegistros, useCustoPrevisto } from "@/hooks/dp/usePonto";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { chaveColaborador, nomeExibicao } from "@/lib/ponto/analise";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { JORNADA_MENSAL_HORAS } from "@/lib/dp/codigos";
import { formatBRL } from "@/lib/core/currency";
import { fmtData } from "@/lib/core/date";

const fmtDinheiro = (n: number) => formatBRL(n, { maxDigits: 2 });

/** Competência (YYYY-MM) do fim do período — base do custo/hora. */
function competenciaDe(fim: string): string {
  return fim.slice(0, 7);
}

export default function PontoBancoHoras() {
  const { colaboradores } = useCatalogos();
  const { inicio, fim, obraId, incluirIndiretos } = usePontoFiltros();
  const query = usePontoRegistros({ inicio, fim, obraIds: obraId ? [obraId] : undefined });
  const { data: custos = [] } = useCustoPrevisto(competenciaDe(fim));

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );

  /** Custo/hora do colaborador, para valorizar o saldo. */
  const custoHoraPorColab = useMemo(() => {
    const m = new Map<string, number>();
    // Os tipos gerados do Supabase estão defasados para esta view; o mesmo
    // contorno existe em HomemHora.tsx.
    for (const c of custos as unknown as Array<Record<string, unknown>>) {
      const id = c.colaborador_id ? String(c.colaborador_id) : "";
      if (!id) continue;
      const mensal =
        Number(c.proventos || 0) +
        Number(c.inss_empresa || 0) +
        Number(c.rat || 0) +
        Number(c.inss_terceiros || 0) +
        Number(c.fgts || 0);
      if (mensal > 0) m.set(id, mensal / JORNADA_MENSAL_HORAS);
    }
    return m;
  }, [custos]);

  const registros = useMemo(() => {
    const xs = query.data ?? [];
    return incluirIndiretos ? xs : xs.filter((r) => !r.centro_indireto);
  }, [query.data, incluirIndiretos]);

  /** Saldo = último dia apurado de cada pessoa (o campo é acumulado, não diário). */
  const saldos = useMemo(() => {
    const ultimo = new Map<
      string,
      { nome: string; colaboradorId: string | null; data: string; saldo: number }
    >();
    for (const r of registros) {
      const chave = chaveColaborador(r);
      const atual = ultimo.get(chave);
      if (!atual || r.data >= atual.data) {
        ultimo.set(chave, {
          nome: nomeExibicao(r, nomePorId),
          colaboradorId: r.colaborador_id,
          data: r.data,
          saldo: r.banco_saldo_min,
        });
      }
    }
    return Array.from(ultimo.values())
      .filter((x) => x.saldo !== 0)
      .map((x) => {
        const custoHora = x.colaboradorId ? (custoHoraPorColab.get(x.colaboradorId) ?? 0) : 0;
        return { ...x, valor: (x.saldo / 60) * custoHora };
      })
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  }, [registros, nomePorId, custoHoraPorColab]);

  const totais = useMemo(() => {
    let positivo = 0;
    let negativo = 0;
    let passivo = 0;
    for (const s of saldos) {
      if (s.saldo > 0) {
        positivo += s.saldo;
        passivo += s.valor;
      } else {
        negativo += s.saldo;
      }
    }
    return { positivo, negativo, passivo, pessoas: saldos.length };
  }, [saldos]);

  /** Evolução do saldo consolidado, somando o que cada pessoa tinha no dia. */
  const serie = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const r of registros) {
      porDia.set(r.data, (porDia.get(r.data) ?? 0) + r.banco_saldo_min);
    }
    return Array.from(porDia.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, min]) => ({ data, horas: +(min / 60).toFixed(2) }));
  }, [registros]);

  return (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={saldos}
      onRetry={() => query.refetch()}
      isEmpty={(xs) => xs.length === 0}
      empty={
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum saldo de banco de horas no período. Se a apuração da RHiD não preenche
          <code className="mx-1">saldoBancoFinalDia</code>, o campo chega zerado.
        </Card>
      }
    >
      {(xs) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi
              label="Saldo positivo (a compensar)"
              value={formatMinutes(totais.positivo)}
              tone="warning"
              size="lg"
              tabularNums
            />
            <Kpi
              label="Saldo negativo (a descontar)"
              value={formatMinutes(totais.negativo)}
              tone="danger"
              size="lg"
              tabularNums
            />
            <Kpi
              label="Passivo estimado"
              value={fmtDinheiro(totais.passivo)}
              size="lg"
              hint="saldo positivo × custo/hora da competência"
            />
            <Kpi label="Colaboradores com saldo" value={totais.pessoas} size="lg" />
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">Evolução do saldo consolidado (horas)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={serie}>
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="horas" stroke="hsl(var(--primary))" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Último dia apurado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xs.slice(0, 100).map((s) => (
                  <TableRow key={`${s.colaboradorId ?? s.nome}`}>
                    <TableCell className="font-medium text-xs">{s.nome}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtData(s.data)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        s.saldo < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {formatMinutes(s.saldo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {s.valor ? fmtDinheiro(s.valor) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              O valor estimado usa o custo/hora da competência {competenciaDe(fim)} (proventos mais
              encargos patronais ÷ {JORNADA_MENSAL_HORAS}h). Fica vazio para quem não tem holerite
              importado na competência.
            </p>
          </Card>
        </div>
      )}
    </QueryState>
  );
}
