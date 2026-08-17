// Fila de tratativas — o que fazer com as exceções do período.
//
// A Visão Geral mostra o tamanho do problema; aqui ele ganha dono, prazo e
// desfecho. A regeneração é explícita: derivar os fatos do período carregado e
// gravá-los sem tocar no que já foi tratado (a UNIQUE pessoa+dia+tipo garante).
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kpi } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";
import RecursoPendente from "@/components/dp/RecursoPendente";
import { toast } from "sonner";
import { Loader, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth/useAuth";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { usePontoRegistros } from "@/hooks/dp/usePonto";
import {
  useAtualizarOcorrencia,
  usePontoOcorrencias,
  useRegenerarOcorrencias,
  type PontoOcorrencia,
} from "@/hooks/dp/usePontoTratativas";
import { usePontoJustificativas } from "@/hooks/dp/usePontoJustificativas";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { casarComOcorrencias } from "@/lib/ponto/justificativas";
import {
  ROTULO_TIPO,
  STATUS_OCORRENCIA,
  resumirPorStatus,
  type StatusOcorrencia,
  type TipoOcorrencia,
} from "@/lib/ponto/ocorrencias";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { fmtData } from "@/lib/core/date";

const TOM_SEVERIDADE: Record<string, "destructive" | "secondary" | "outline"> = {
  alta: "destructive",
  media: "secondary",
  baixa: "outline",
};

export default function PontoTratativas() {
  const { currentPlayer } = useAuth();
  const { obras, colaboradores } = useCatalogos();
  const { inicio, fim } = usePontoFiltros();
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [emEdicao, setEmEdicao] = useState<PontoOcorrencia | null>(null);
  const [rascunho, setRascunho] = useState({
    status: "",
    responsavel: "",
    prazo: "",
    observacao: "",
  });

  const query = usePontoOcorrencias(inicio, fim, statusFiltro || undefined);
  const registros = usePontoRegistros({ inicio, fim });
  const justificativas = usePontoJustificativas(inicio, fim);
  const regenerar = useRegenerarOcorrencias();
  const atualizar = useAtualizarOcorrencia();

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );
  const obraById = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const fila = useMemo(() => query.data ?? [], [query.data]);
  const resumo = useMemo(
    () => resumirPorStatus(fila.map((o) => ({ status: o.status as StatusOcorrencia }))),
    [fila],
  );

  /**
   * Ocorrências abertas que já têm justificativa aprovada cobrindo o dia.
   * Sem isso, o que o DP resolveu na RHiD continua pendente aqui para sempre.
   * O vínculo já vem resolvido em `colaborador_id` na sincronização.
   */
  const casadas = useMemo(
    () => casarComOcorrencias(fila, justificativas.data ?? []),
    [fila, justificativas.data],
  );
  const justificadaPorOcorrencia = useMemo(
    () => new Map(casadas.map((c) => [c.ocorrencia.id, c.justificativa])),
    [casadas],
  );

  const abrirEdicao = (o: PontoOcorrencia) => {
    setEmEdicao(o);
    setRascunho({
      status: o.status,
      responsavel: o.responsavel ?? "",
      prazo: o.prazo ?? "",
      observacao: o.observacao ?? "",
    });
  };

  const salvar = () => {
    if (!emEdicao) return;
    atualizar.mutate(
      {
        id: emEdicao.id,
        status: rascunho.status,
        responsavel: rascunho.responsavel || null,
        prazo: rascunho.prazo || null,
        observacao: rascunho.observacao || null,
        atualizado_por: currentPlayer?.login ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Tratativa atualizada.");
          setEmEdicao(null);
        },
        onError: (e: unknown) =>
          toast.error("Falha ao atualizar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  /** Fecha de uma vez tudo que a RHiD já aprovou — o ganho real do cruzamento. */
  const fecharJustificadas = async () => {
    let fechadas = 0;
    for (const { ocorrencia: o, justificativa: j } of casadas) {
      try {
        await atualizar.mutateAsync({
          id: o.id,
          status: "justificada",
          observacao: `Justificativa ${j.id}${j.tipoNome ? ` (${j.tipoNome})` : ""} aprovada na RHiD, cobrindo ${j.dataInicio} a ${j.dataFim}.`,
          atualizado_por: currentPlayer?.login ?? null,
        });
        fechadas += 1;
      } catch (e) {
        toast.error(
          `Falha ao fechar ${o.nome} em ${o.data}: ` + (e instanceof Error ? e.message : String(e)),
        );
        break;
      }
    }
    if (fechadas > 0) toast.success(`${fechadas} ocorrência(s) fechada(s) por justificativa.`);
  };

  const handleRegenerar = () => {
    const dados = registros.data ?? [];
    if (dados.length === 0) {
      toast.warning("Não há registros de ponto carregados para este período.");
      return;
    }
    regenerar.mutate(
      { registros: dados, nomePorId },
      {
        onSuccess: (n) => toast.success(`${n} ocorrência(s) sincronizada(s) com o período.`),
        onError: (e: unknown) =>
          toast.error("Falha ao regenerar: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  if (isRecursoIndisponivel(query.error)) {
    return (
      <RecursoPendente
        erro={query.error}
        migracao="2026_08_03_ponto_ondas.sql"
        descricao="A fila guarda status, responsável, prazo e histórico de cada exceção — e sobrevive à re-sincronização do período."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <Kpi label="Pendentes" value={resumo.pendente} tone="danger" size="lg" />
          <Kpi label="Em tratativa" value={resumo.em_tratativa} tone="warning" size="lg" />
          <Kpi label="Justificadas" value={resumo.justificada} tone="success" size="lg" />
          <Kpi label="Descartadas" value={resumo.descartada} tone="muted" size="lg" />
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
              {Object.entries(STATUS_OCORRENCIA).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </div>
          {casadas.length > 0 && (
            <Button onClick={fecharJustificadas} disabled={atualizar.isPending}>
              {atualizar.isPending && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              Fechar {casadas.length} já justificada(s)
            </Button>
          )}
          <Button variant="outline" onClick={handleRegenerar} disabled={regenerar.isPending}>
            {regenerar.isPending ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerar do período
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={fila}
        onRetry={() => query.refetch()}
        isEmpty={(xs) => xs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <p>Nenhuma ocorrência registrada para este período.</p>
            <p className="text-xs">
              Use “Regenerar do período” para derivar as exceções dos registros já importados.
            </p>
          </Card>
        }
      >
        {(xs) => (
          <Card className="p-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="text-right">Magnitude</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {xs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs tabular-nums">{fmtData(o.data)}</TableCell>
                    <TableCell className="font-medium text-xs">{o.nome}</TableCell>
                    <TableCell className="text-xs">
                      {o.obra_id ? (obraById.get(o.obra_id) ?? o.obra_id) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TOM_SEVERIDADE[o.severidade] ?? "outline"}>
                        {ROTULO_TIPO[o.tipo as TipoOcorrencia] ?? o.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                      {o.detalhe ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {o.minutos > 0 ? formatMinutes(o.minutos) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {STATUS_OCORRENCIA[o.status as StatusOcorrencia] ?? o.status}
                      {justificadaPorOcorrencia.has(o.id) && (
                        <Badge
                          variant="secondary"
                          className="ml-1 text-[10px]"
                          title={`Justificativa aprovada na RHiD: ${justificadaPorOcorrencia.get(o.id)?.tipoNome ?? ""}`}
                        >
                          justificada na RHiD
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{o.responsavel ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => abrirEdicao(o)}>
                        Tratar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </QueryState>

      <Dialog open={!!emEdicao} onOpenChange={(aberto) => !aberto && setEmEdicao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {emEdicao
                ? `${ROTULO_TIPO[emEdicao.tipo as TipoOcorrencia] ?? emEdicao.tipo} — ${emEdicao.nome}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {emEdicao && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {fmtData(emEdicao.data)} · {emEdicao.detalhe}
              </p>
              <div>
                <label className="text-xs font-medium block mb-1">Status</label>
                <select
                  value={rascunho.status}
                  onChange={(e) => setRascunho((r) => ({ ...r, status: e.target.value }))}
                  className="h-10 w-full rounded-md border px-2 bg-background"
                >
                  {Object.entries(STATUS_OCORRENCIA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Responsável</label>
                  <Input
                    value={rascunho.responsavel}
                    onChange={(e) => setRascunho((r) => ({ ...r, responsavel: e.target.value }))}
                    placeholder="login ou nome"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Prazo</label>
                  <Input
                    type="date"
                    value={rascunho.prazo}
                    onChange={(e) => setRascunho((r) => ({ ...r, prazo: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Observação</label>
                <Textarea
                  value={rascunho.observacao}
                  onChange={(e) => setRascunho((r) => ({ ...r, observacao: e.target.value }))}
                  placeholder="O que foi apurado e o que foi decidido"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmEdicao(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={atualizar.isPending}>
              {atualizar.isPending && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
