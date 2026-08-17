// Justificativas & Abonos — o outro lado da fila de tratativas.
//
// Três perguntas que a RHiD responde e o ERP não fazia: o que está parado
// esperando aprovação, quais tipos mexem na folha (abonam falta ou descontam
// DSR) e quem já estourou a cota do tipo — limites que a API entrega em
// `qtdMensal`/`qtdAnual` e ninguém conferia.
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import RecursoPendente from "@/components/dp/RecursoPendente";
import { toast } from "sonner";
import { Loader, RefreshCw } from "lucide-react";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import {
  usePontoJustificativaTipos,
  usePontoJustificativas,
  useSincronizarJustificativas,
} from "@/hooks/dp/usePontoJustificativas";
import { useRhidVinculos } from "@/hooks/dp/usePontoCadastro";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import {
  ROTULO_APROVACAO,
  idadeEmDias,
  usoVsLimite,
  type StatusAprovacao,
} from "@/lib/ponto/justificativas";
import { fmtData, hojeBrasilia } from "@/lib/core/date";

const TOM_STATUS: Record<StatusAprovacao, "destructive" | "secondary" | "outline" | "default"> = {
  pendente: "secondary",
  aprovada: "default",
  reprovada: "destructive",
  desconhecido: "outline",
};

export default function PontoJustificativas() {
  const { colaboradores } = useCatalogos();
  const { inicio, fim } = usePontoFiltros();
  const [statusFiltro, setStatusFiltro] = useState<string>("");

  const query = usePontoJustificativas(inicio, fim);
  const tiposQuery = usePontoJustificativaTipos();
  const vinculos = useRhidVinculos();
  const sincronizar = useSincronizarJustificativas();

  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);
  const tipoPorId = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);

  const justificativas = useMemo(() => {
    const xs = query.data ?? [];
    if (!statusFiltro) return xs;
    return xs.filter((j) => j.status === statusFiltro);
  }, [query.data, statusFiltro]);

  const hoje = hojeBrasilia();

  const resumo = useMemo(() => {
    const xs = query.data ?? [];
    const pendentes = xs.filter((j) => j.status === "pendente");
    const maisAntiga = pendentes.reduce(
      (max, j) => Math.max(max, idadeEmDias(j.dataInicio, hoje)),
      0,
    );
    const abonamFalta = xs.filter(
      (j) => j.idTipo && tipoPorId.get(j.idTipo)?.abonarDiaFalta,
    ).length;
    const descontamDsr = xs.filter((j) => j.idTipo && tipoPorId.get(j.idTipo)?.descontaDsr).length;
    return { total: xs.length, pendentes: pendentes.length, maisAntiga, abonamFalta, descontamDsr };
  }, [query.data, tipoPorId, hoje]);

  const cotas = useMemo(
    () =>
      usoVsLimite(query.data ?? [], tipos).filter((c) => c.excedido || c.usadas / c.limite >= 0.8),
    [query.data, tipos],
  );

  const handleSincronizar = () => {
    const colaboradorPorIdPerson = new Map<number, string>();
    for (const v of vinculos.data ?? []) {
      if (v.colaborador_id) colaboradorPorIdPerson.set(v.id_person, v.colaborador_id);
    }
    const colaboradorPorCpf = new Map<string, string>();
    for (const c of colaboradores) {
      const cpf = c.cpf ? String(c.cpf).replace(/\D/g, "") : "";
      if (cpf) colaboradorPorCpf.set(cpf, c.id);
    }

    sincronizar.mutate(
      { inicio, fim, colaboradorPorIdPerson, colaboradorPorCpf },
      {
        onSuccess: (r) =>
          toast.success(`${r.justificativas} justificativa(s) e ${r.tipos} tipo(s) sincronizados.`),
        onError: (e: unknown) =>
          toast.error("Falha ao sincronizar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  if (isRecursoIndisponivel(query.error)) {
    return (
      <RecursoPendente
        erro={query.error}
        migracao="2026_08_04_ponto_justificativas.sql"
        descricao="Depois de aplicada, a aba mostra o que está parado esperando aprovação, o que mexe na folha e quem estourou a cota do tipo."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <Kpi label="Justificativas no período" value={resumo.total} size="lg" />
          <Kpi
            label="Pendentes de aprovação"
            value={resumo.pendentes}
            tone="warning"
            size="lg"
            hint={resumo.maisAntiga > 0 ? `mais antiga com ${resumo.maisAntiga} dias` : undefined}
          />
          <Kpi
            label="Abonam dia de falta"
            value={resumo.abonamFalta}
            size="lg"
            hint="saem do absenteísmo e da folha"
          />
          <Kpi
            label="Descontam DSR"
            value={resumo.descontamDsr}
            tone="danger"
            size="lg"
            hint="impacto direto no pagamento"
          />
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs font-medium block mb-1">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="h-10 rounded-md border px-2 bg-background"
            >
              <option value="">Todos</option>
              {Object.entries(ROTULO_APROVACAO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={handleSincronizar} disabled={sincronizar.isPending}>
            {sincronizar.isPending ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar da RHiD
          </Button>
        </div>
      </div>

      {cotas.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-1">Cotas do tipo no limite ou estouradas</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Comparação contra o menor teto declarado no tipo de justificativa.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Usadas</TableHead>
                <TableHead className="text-right">Limite</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cotas.slice(0, 50).map((c) => (
                <TableRow key={c.chave}>
                  <TableCell className="font-medium text-xs">{c.nome}</TableCell>
                  <TableCell className="text-xs">{c.tipoNome}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.usadas}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.limite}</TableCell>
                  <TableCell className="text-xs">{c.periodo}</TableCell>
                  <TableCell
                    className={
                      c.excedido ? "text-destructive font-semibold text-xs" : "text-warning text-xs"
                    }
                  >
                    {c.excedido ? "🔴 Estourada" : "🟠 No limite"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={justificativas}
        onRetry={() => query.refetch()}
        isEmpty={(xs) => xs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <p>Nenhuma justificativa registrada para este período.</p>
            <p className="text-xs">Use “Sincronizar da RHiD” para trazer as do período filtrado.</p>
          </Card>
        }
      >
        {(xs) => (
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Idade</TableHead>
                  <TableHead>Efeito na folha</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xs.slice(0, 300).map((j) => {
                  const tipo = j.idTipo ? tipoPorId.get(j.idTipo) : undefined;
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs tabular-nums">
                        {fmtData(j.dataInicio)}
                        {j.dataFim !== j.dataInicio ? ` — ${fmtData(j.dataFim)}` : ""}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{j.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{j.tipoNome ?? tipo?.nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={TOM_STATUS[j.status]}>{ROTULO_APROVACAO[j.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {j.status === "pendente" ? `${idadeEmDias(j.dataInicio, hoje)} d` : "—"}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {tipo?.abonarDiaFalta && (
                          <Badge variant="secondary" className="text-[10px]">
                            Abona falta
                          </Badge>
                        )}
                        {tipo?.descontaDsr && (
                          <Badge variant="destructive" className="text-[10px]">
                            Desconta DSR
                          </Badge>
                        )}
                        {tipo?.exigeCid && (
                          <Badge variant="outline" className="text-[10px]">
                            Exige CID
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {j.motivo ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {tipos.length === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Os tipos ainda não foram sincronizados — sem eles não dá para saber o que abona
                falta, o que desconta DSR nem qual é a cota.
              </p>
            )}
          </Card>
        )}
      </QueryState>
    </div>
  );
}
