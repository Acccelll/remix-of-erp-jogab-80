// Relógios (REP) & AFD — conformidade do ponto eletrônico.
//
// Duas metades da mesma preocupação: se o relógio está comunicando (sem isso a
// marcação inválida da obra não tem explicação) e se existe AFD arquivado para
// a fiscalização. A API só serve janelas de 90 dias, então o que não for gerado
// e guardado a tempo não pode mais ser reproduzido.
//
// Aba restrita a GM: o AFD carrega PIS e CPF de toda a base num arquivo só.
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
import { Download, Loader, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { usePontoRegistros } from "@/hooks/dp/usePonto";
import {
  useBaixarAfd,
  useGerarAfd,
  usePontoAfdArquivos,
  usePontoDispositivos,
  useSincronizarDispositivos,
} from "@/hooks/dp/usePontoRelogios";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import {
  ROTULO_SAUDE,
  diasSemComunicar,
  saudeDoRep,
  type SaudeRep,
} from "@/lib/ponto/dispositivos";
import { fmtData, fmtDataHora } from "@/lib/core/date";

const TOM_SAUDE: Record<SaudeRep, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "default",
  atencao: "secondary",
  critico: "destructive",
  desconhecido: "outline",
};

export default function PontoRelogiosAfd() {
  const { currentPlayer } = useAuth();
  const { isGM } = usePermissions();
  const { inicio, fim } = usePontoFiltros();

  const dispositivos = usePontoDispositivos();
  const arquivos = usePontoAfdArquivos();
  const registros = usePontoRegistros({ inicio, fim });
  const sincronizar = useSincronizarDispositivos();
  const gerar = useGerarAfd();
  const baixar = useBaixarAfd();

  const [alvo, setAlvo] = useState({ idEquipamento: "", layout: "1510" as "1510" | "671" });

  const agora = useMemo(() => new Date().toISOString().slice(0, 19).replace("T", " "), []);

  const linhas = useMemo(() => {
    return (dispositivos.data ?? [])
      .map((d) => ({
        ...d,
        dias: diasSemComunicar(d.ultima_conexao, agora),
        saude: saudeDoRep(d.ultima_conexao, agora),
      }))
      .sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));
  }, [dispositivos.data, agora]);

  /** Marcações inválidas do período — o sintoma que o REP mudo costuma explicar. */
  const marcacoesInvalidas = useMemo(
    () =>
      (registros.data ?? []).filter((r) => r.marcacao_invalida || r.interjornada_min > 0).length,
    [registros.data],
  );

  const resumo = useMemo(() => {
    const criticos = linhas.filter((l) => l.saude === "critico").length;
    const atencao = linhas.filter((l) => l.saude === "atencao").length;
    return { total: linhas.length, criticos, atencao };
  }, [linhas]);

  if (!isGM) {
    return (
      <Card className="p-10 flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="w-6 h-6 text-muted-foreground" />
        <div className="space-y-1">
          <div className="font-medium">Acesso restrito</div>
          <p className="text-sm text-muted-foreground max-w-md">
            O AFD contém CPF e PIS de toda a base, então esta aba fica limitada a GMs. Fale com um
            GM se precisar do arquivo para uma fiscalização.
          </p>
        </div>
      </Card>
    );
  }

  const erroDeRecurso = isRecursoIndisponivel(dispositivos.error)
    ? dispositivos.error
    : isRecursoIndisponivel(arquivos.error)
      ? arquivos.error
      : null;

  if (erroDeRecurso) {
    return (
      <RecursoPendente
        erro={erroDeRecurso}
        migracao="2026_08_04_ponto_afd.sql"
        descricao="Depois de aplicada, esta aba mostra a saúde dos relógios e arquiva o AFD da fiscalização no bucket privado."
      />
    );
  }

  const handleGerar = () => {
    const id = Number(alvo.idEquipamento);
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("Escolha o equipamento.");
      return;
    }
    const equipamento = linhas.find((l) => l.id_device === id);
    gerar.mutate(
      {
        idEquipamento: id,
        equipamentoNome: equipamento?.nome ?? null,
        layout: alvo.layout,
        dataIni: inicio,
        dataFinal: fim,
        geradoPor: currentPlayer?.login ?? null,
      },
      {
        onSuccess: (r) => {
          toast.success(
            `AFD gerado: ${r.linhas} registros (NSR ${r.nsrInicial ?? "?"}–${r.nsrFinal ?? "?"}).` +
              (r.truncado ? " Atenção: resultado truncado, refine o período." : ""),
          );
        },
        onError: (e: unknown) =>
          toast.error("Falha ao gerar o AFD: " + (e instanceof Error ? e.message : String(e))),
      },
    );
  };

  const handleBaixar = (storagePath: string | null) => {
    if (!storagePath) {
      toast.error("Este registro não tem arquivo arquivado.");
      return;
    }
    baixar.mutate(storagePath, {
      onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
      onError: (e: unknown) =>
        toast.error("Falha ao abrir o arquivo: " + (e instanceof Error ? e.message : String(e))),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <Kpi label="Relógios cadastrados" value={resumo.total} size="lg" />
          <Kpi label="Mudos (3+ dias)" value={resumo.criticos} tone="danger" size="lg" />
          <Kpi label="Atrasados" value={resumo.atencao} tone="warning" size="lg" />
          <Kpi
            label="Marcações inválidas no período"
            value={marcacoesInvalidas}
            tone={resumo.criticos > 0 ? "danger" : "default"}
            size="lg"
            hint={resumo.criticos > 0 ? "há relógio mudo — provável causa" : undefined}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => sincronizar.mutate()}
          disabled={sincronizar.isPending}
        >
          {sincronizar.isPending ? (
            <Loader className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Atualizar relógios
        </Button>
      </div>

      <QueryState
        isLoading={dispositivos.isLoading}
        isError={dispositivos.isError}
        error={dispositivos.error}
        data={linhas}
        onRetry={() => dispositivos.refetch()}
        isEmpty={(xs) => xs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground space-y-2">
            <p>Nenhum relógio sincronizado ainda.</p>
            <p className="text-xs">Use “Atualizar relógios” para trazer os REPs da RHiD.</p>
          </Card>
        }
      >
        {(xs) => (
          <Card className="p-4 overflow-x-auto">
            <h3 className="font-semibold mb-3">Saúde dos relógios</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Última conexão</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Digitais</TableHead>
                  <TableHead>Papel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {xs.map((d) => (
                  <TableRow key={d.id_device}>
                    <TableCell className="font-medium text-xs">
                      {d.nome ?? `REP ${d.id_device}`}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{d.serial ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {d.ultima_conexao ? fmtDataHora(d.ultima_conexao) : "nunca"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {d.dias ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TOM_SAUDE[d.saude]}>{ROTULO_SAUDE[d.saude]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {d.num_pessoas ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {d.num_digitais ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{d.status_papel ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </QueryState>

      <Card className="p-4">
        <h3 className="font-semibold">Gerar AFD do período</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Layout 1510 ou 671, do período selecionado no topo ({fmtData(inicio)} a {fmtData(fim)}). O
          arquivo vai para o bucket privado e fica registrado com faixa de NSR e sha256.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium block mb-1">Equipamento</label>
            <select
              value={alvo.idEquipamento}
              onChange={(e) => setAlvo((a) => ({ ...a, idEquipamento: e.target.value }))}
              className="h-10 rounded-md border px-2 bg-background min-w-[220px]"
            >
              <option value="">Selecione…</option>
              {linhas.map((d) => (
                <option key={d.id_device} value={d.id_device}>
                  {d.nome ?? `REP ${d.id_device}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Layout</label>
            <select
              value={alvo.layout}
              onChange={(e) => setAlvo((a) => ({ ...a, layout: e.target.value as "1510" | "671" }))}
              className="h-10 rounded-md border px-2 bg-background"
            >
              <option value="1510">Portaria 1510</option>
              <option value="671">Portaria 671</option>
            </select>
          </div>
          <Button onClick={handleGerar} disabled={gerar.isPending || !alvo.idEquipamento}>
            {gerar.isPending && <Loader className="w-4 h-4 mr-2 animate-spin" />}
            Gerar e arquivar
          </Button>
        </div>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <h3 className="font-semibold mb-3">AFDs arquivados</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gerado em</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>NSR</TableHead>
              <TableHead className="text-right">Linhas</TableHead>
              <TableHead>sha256</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(arquivos.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs tabular-nums">{fmtDataHora(a.gerado_em)}</TableCell>
                <TableCell className="text-xs">
                  {a.equipamento_nome ?? `REP ${a.id_device}`}
                </TableCell>
                <TableCell className="text-xs">
                  {a.layout}
                  {a.truncado && (
                    <Badge variant="destructive" className="ml-1 text-[10px]">
                      truncado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {a.periodo_inicio
                    ? `${fmtData(a.periodo_inicio)} — ${fmtData(a.periodo_fim)}`
                    : "completo"}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {a.nsr_inicial ?? "?"}–{a.nsr_final ?? "?"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">{a.linhas}</TableCell>
                <TableCell
                  className="text-[10px] font-mono text-muted-foreground max-w-[120px] truncate"
                  title={a.sha256}
                >
                  {a.sha256.slice(0, 12)}…
                </TableCell>
                <TableCell className="text-xs">{a.gerado_por ?? "—"}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleBaixar(a.storage_path)}
                    disabled={baixar.isPending}
                    title="Abrir com URL assinada (5 minutos)"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(arquivos.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum AFD arquivado ainda.
          </p>
        )}
      </Card>
    </div>
  );
}
