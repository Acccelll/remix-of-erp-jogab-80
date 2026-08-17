// Visão Geral do hub de Ponto — diagnóstico do período.
//
// Só apresentação: as regras (absenteísmo, falta crítica, HE estourada) vivem em
// `src/lib/ponto/analise.ts`, onde são testadas. As listas de exceção seguem aqui
// como leitura; a tratativa com estado é a aba Tratativas.
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "@/components/ui/chart";
import { AlertTriangle, Clock, Download, FileWarning, MoonStar, TrendingUp } from "lucide-react";
import { Kpi } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";
import { usePontoImportacoes, usePontoRegistros, type PontoRegistro } from "@/hooks/dp/usePonto";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { LIMITE_HE_FOLHA_PCT } from "@/lib/dp/codigos";
import { fmtDataHora } from "@/lib/core/date";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import {
  atrasos,
  calcularKpis,
  compararPeriodos,
  distribuicaoAbsenteismo,
  faltasCriticas,
  heDiario,
  heEstouradas,
  ocorrenciasPorObra,
  periodoAnterior,
} from "@/lib/ponto/analise";

const CORES = ["hsl(0 70% 55%)", "hsl(45 90% 55%)", "hsl(210 70% 55%)"];

function exportarCSV(
  registros: PontoRegistro[],
  nomePorId: Map<string, string>,
  obraById: Map<string, { nome: string }>,
) {
  const header = [
    "Data",
    "Colaborador",
    "CPF",
    "Matricula",
    "Departamento",
    "Obra",
    "Indireto",
    "Hr Previstas (min)",
    "Hr Trabalhadas (min)",
    "Hr Falta (min)",
    "Dias Falta",
    "HE 50% (min)",
    "HE 60% (min)",
    "HE 100% (min)",
    "Compensadas (min)",
    "Interjornada (min)",
    "Banco Saldo (min)",
    "Marcacao Invalida",
    "Falta",
    "Atestado",
    "Observacao",
  ];
  const rows = registros.map((r) => [
    r.data,
    r.colaborador_id ? (nomePorId.get(r.colaborador_id) ?? r.nome_csv) : r.nome_csv,
    r.cpf_csv ?? "",
    r.matricula_csv ?? "",
    r.departamento_csv ?? "",
    r.obra_id ? (obraById.get(r.obra_id)?.nome ?? "") : "",
    r.centro_indireto ? "SIM" : "",
    r.horas_previstas_min,
    r.horas_trabalhadas_min,
    r.horas_falta_min,
    r.dias_falta_qtd ?? 0,
    r.horas_extra_50_min,
    r.horas_extra_60_min,
    r.horas_extra_100_min,
    r.horas_compensadas_min ?? 0,
    r.interjornada_min ?? 0,
    r.banco_saldo_min ?? 0,
    r.marcacao_invalida ? "SIM" : "",
    r.falta ? "SIM" : "",
    r.atestado ? "SIM" : "",
    (r.observacao ?? "").replace(/[\r\n]+/g, " "),
  ]);
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((row) => row.map(esc).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ponto_analise_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Rótulo de tendência: `null` (sem base de comparação) vira "—". */
function tendencia(valor: number | null, sufixo: string, inverso = true): string {
  if (valor === null) return "sem período anterior";
  const sinal = valor > 0 ? "+" : "";
  const seta = valor === 0 ? "" : valor > 0 === inverso ? " ▲" : " ▼";
  return `${sinal}${valor.toFixed(1)}${sufixo} vs. período anterior${seta}`;
}

export default function PontoAnalise() {
  const { obras, colaboradores } = useCatalogos();
  const filtros = usePontoFiltros();
  const { inicio, fim, obraId, colaboradorId, incluirIndiretos } = filtros;

  const query = usePontoRegistros({
    inicio,
    fim,
    obraIds: obraId ? [obraId] : undefined,
  });
  const anterior = periodoAnterior(inicio, fim);
  const queryAnterior = usePontoRegistros({
    inicio: anterior?.inicio ?? inicio,
    fim: anterior?.fim ?? fim,
    obraIds: obraId ? [obraId] : undefined,
  });
  const importacoes = usePontoImportacoes(inicio, fim);

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );
  const obraById = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const nomeObra = useMemo(() => (id: string) => obraById.get(id)?.nome ?? id, [obraById]);

  /** Recorte que os filtros locais (colaborador, indiretos) aplicam sobre a query. */
  const recortar = useMemo(
    () => (rs: PontoRegistro[]) => {
      let xs = rs;
      if (colaboradorId) xs = xs.filter((r) => r.colaborador_id === colaboradorId);
      if (!incluirIndiretos) xs = xs.filter((r) => !r.centro_indireto);
      return xs;
    },
    [colaboradorId, incluirIndiretos],
  );

  const registros = useMemo(() => recortar(query.data ?? []), [query.data, recortar]);
  const kpis = useMemo(() => calcularKpis(registros, nomePorId), [registros, nomePorId]);
  const kpisAnteriores = useMemo(() => {
    if (!anterior || !queryAnterior.data) return null;
    return calcularKpis(recortar(queryAnterior.data), nomePorId);
  }, [anterior, queryAnterior.data, recortar, nomePorId]);
  const tend = useMemo(() => compararPeriodos(kpis, kpisAnteriores), [kpis, kpisAnteriores]);

  const graficos = useMemo(
    () => ({
      porObra: ocorrenciasPorObra(registros, nomeObra),
      he: heDiario(registros),
      donut: distribuicaoAbsenteismo(registros),
    }),
    [registros, nomeObra],
  );

  const listas = useMemo(
    () => ({
      faltas: faltasCriticas(registros, nomePorId),
      he: heEstouradas(registros, nomePorId),
      atrasos: atrasos(registros, nomePorId),
    }),
    [registros, nomePorId],
  );

  const ultimaImportacao = useMemo(() => {
    const xs = importacoes.data ?? [];
    if (xs.length === 0) return null;
    return [...xs].sort((a, b) => b.importado_em.localeCompare(a.importado_em))[0];
  }, [importacoes.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Proveniência: de qual carga vieram os números desta tela. */}
        <p className="text-xs text-muted-foreground">
          {isRecursoIndisponivel(importacoes.error) ? (
            // Não afirmar "sem carga" quando o que falta é a rota no host.
            "Proveniência indisponível: o api.php publicado ainda não lista as importações."
          ) : ultimaImportacao ? (
            <>
              Última carga do período:{" "}
              <span className="font-medium">
                {ultimaImportacao.arquivo_nome.startsWith("rhid_apuracao_") ? "RHiD" : "CSV"}
              </span>{" "}
              em {fmtDataHora(ultimaImportacao.importado_em)}
              {ultimaImportacao.importado_por
                ? ` por ${ultimaImportacao.importado_por}`
                : ""} · {ultimaImportacao.total_registros} registros
            </>
          ) : (
            "Sem carga registrada para este período."
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportarCSV(registros, nomePorId, obraById)}
          disabled={registros.length === 0}
        >
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={registros}
        onRetry={() => query.refetch()}
        isEmpty={(rs) => rs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhum registro de ponto no período. Sincronize com a RHiD ou importe o CSV.
          </Card>
        }
      >
        {(rs) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Kpi
                label="Taxa de Absenteísmo"
                value={`${kpis.absenteismoPct.toFixed(1)}%`}
                tone="danger"
                size="lg"
                icon={<AlertTriangle className="w-4 h-4" />}
                hint={tendencia(tend.absenteismoPp, " p.p.")}
              />
              <Kpi
                label="Horas Extras (Total)"
                value={formatMinutes(kpis.heTotalMin)}
                tone="warning"
                size="lg"
                tabularNums
                icon={<Clock className="w-4 h-4" />}
                hint={tendencia(tend.heTotalPct, "%")}
              />
              <Kpi
                label="Marcações Inválidas"
                value={`${kpis.marcacaoInvalidaPct.toFixed(1)}%`}
                tone="warning"
                size="lg"
                icon={<FileWarning className="w-4 h-4" />}
                hint={tendencia(tend.marcacaoInvalidaPp, " p.p.")}
              />
              <Kpi
                label="Interjornada Violada"
                value={`${kpis.interjornadaPct.toFixed(1)}%`}
                tone="warning"
                size="lg"
                icon={<MoonStar className="w-4 h-4" />}
                hint={tendencia(tend.interjornadaPp, " p.p.")}
              />
              <Kpi
                label="Maior volume de HE"
                value={kpis.topHe?.nome ?? "—"}
                size="sm"
                icon={<TrendingUp className="w-4 h-4" />}
                hint={
                  kpis.topHe
                    ? `${formatMinutes(kpis.topHe.min)} somando 50%, 60% e 100%`
                    : "sem horas extras no período"
                }
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Ocorrências por Obra</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={graficos.porObra} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="obra" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="ocorrencias" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Evolução de Horas Extras</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={graficos.he}>
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="horas" stroke="hsl(var(--primary))" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Distribuição do Absenteísmo</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={graficos.donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {graficos.donut.map((_, i) => (
                        <Cell key={i} fill={CORES[i % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMinutes(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Accordion type="multiple" defaultValue={["criticos"]} className="space-y-2">
              <AccordionItem value="criticos" className="border rounded-lg px-4">
                <AccordionTrigger className="text-destructive font-semibold">
                  🔴 Faltas e dias sem registro ({listas.faltas.length})
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-xs text-muted-foreground mb-2">
                    Dias de falta ou com jornada prevista e nenhuma hora trabalhada. Atestados não
                    entram — são falta justificada.
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                        <TableHead className="text-right">Total Horas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listas.faltas.slice(0, 50).map((f) => (
                        <TableRow key={f.chave}>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell className="text-xs">{f.departamento}</TableCell>
                          <TableCell className="text-right">{f.dias}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(f.minutos)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="he" className="border rounded-lg px-4">
                <AccordionTrigger className="text-warning font-semibold">
                  🟠 HE 60% acima de {LIMITE_HE_FOLHA_PCT}% da jornada prevista ({listas.he.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-right">Hr Previstas</TableHead>
                        <TableHead className="text-right">HE 60% Realizada</TableHead>
                        <TableHead className="text-right">% do previsto</TableHead>
                        <TableHead>Risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listas.he.slice(0, 50).map((h) => (
                        <TableRow key={h.chave}>
                          <TableCell className="font-medium">{h.nome}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(h.previstasMin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(h.he60Min)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {h.pct.toFixed(1)}%
                          </TableCell>
                          <TableCell
                            className={
                              h.risco === "alto" ? "text-destructive font-semibold" : "text-warning"
                            }
                          >
                            {h.risco === "alto" ? "🔴 Alto" : "🟠 Médio"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="atrasos" className="border rounded-lg px-4">
                <AccordionTrigger className="text-warning font-semibold">
                  🟡 Atrasos e jornadas incompletas ({listas.atrasos.length})
                </AccordionTrigger>
                <AccordionContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="text-right">Hr Previstas</TableHead>
                        <TableHead className="text-right">Atrasos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listas.atrasos.slice(0, 50).map((a) => (
                        <TableRow key={a.chave}>
                          <TableCell className="font-medium">{a.nome}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(a.previstasMin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMinutes(a.faltaMin)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <p className="text-xs text-muted-foreground">{rs.length} registros no recorte atual.</p>
          </div>
        )}
      </QueryState>
    </div>
  );
}
