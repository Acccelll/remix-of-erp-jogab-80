// Página Histograma — matriz de recursos (funções por delegação,
// equipamentos e veículos por tipo) × colunas do modelo (Em Contratação,
// Ocioso/Afastados/Barracão e cada obra ativa) × semanas -1 / atual / +1.
// Semana -1: valores salvos (somente leitura). Semana atual: editável,
// pré-preenchida com o preview calculado como o contador da Gestão de
// Equipe. Semana +1: réplica visual da atual. Versão inicial — lógica
// simples, evoluções previstas (ver PR).
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { fmtDataLocal } from "@/lib/core/date";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useContratosContext } from "@/contexts/ContratosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useFuncoes } from "@/hooks/rh/useFuncoes";
import { useDelegacoes } from "@/hooks/rh/useDelegacoes";
import { useVeiculoTipos } from "@/hooks/frotas/useVeiculoTipos";
import {
  useHistogramaSemana,
  useSalvarHistograma,
  type CelulaHistograma,
} from "@/hooks/obras/useHistograma";
import {
  OBRA_KEY_CONTRATACAO,
  OBRA_KEY_OCIOSO,
  celulaKey,
  montarGruposLinhas,
  montarPreview,
  segundaDaSemana,
  type GrupoLinhas,
} from "@/lib/obras/histograma";

interface Coluna {
  key: string;
  titulo: string;
  subtitulo?: string;
}

const Histograma = () => {
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("obras_div", "editar");
  const { colaboradores } = useColaboradoresContext();
  const { veiculos } = useVeiculosContext();
  const { contratos } = useContratosContext();
  const { obras } = useObrasContext();
  const { data: funcoes = [] } = useFuncoes();
  const { data: delegacoes = [] } = useDelegacoes();
  const { data: tipos = [] } = useVeiculoTipos();

  const hoje = useMemo(() => new Date(), []);
  const semanaAtual = segundaDaSemana(hoje);
  const semanaAnterior = segundaDaSemana(hoje, -1);
  const semanaSeguinte = segundaDaSemana(hoje, 1);

  const salvosAtual = useHistogramaSemana(semanaAtual);
  const salvosAnterior = useHistogramaSemana(semanaAnterior);
  const salvar = useSalvarHistograma();

  const obrasAtivas = useMemo(() => obras.filter((o) => o.ativa), [obras]);
  const grupos = useMemo(
    () => montarGruposLinhas(funcoes, delegacoes, tipos),
    [funcoes, delegacoes, tipos],
  );
  const preview = useMemo(
    () =>
      montarPreview({
        colaboradores,
        veiculos,
        contratos,
        obraIds: obrasAtivas.map((o) => String(o.id)),
      }),
    [colaboradores, veiculos, contratos, obrasAtivas],
  );

  const colunas: Coluna[] = useMemo(
    () => [
      { key: OBRA_KEY_CONTRATACAO, titulo: "Em Contratação" },
      { key: OBRA_KEY_OCIOSO, titulo: "Ocioso / Afastados / Barracão" },
      ...obrasAtivas.map((o) => ({
        key: String(o.id),
        titulo: o.nome,
        subtitulo: o.codigo || undefined,
      })),
    ],
    [obrasAtivas],
  );

  // Edições da semana atual: célula → valor. Base = salvo ?? preview ?? 0.
  const [edicoes, setEdicoes] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    // Semana mudou (virada de segunda) ou dados recarregados: limpa rascunho.
    setEdicoes(new Map());
  }, [semanaAtual]);

  const valorAtual = (cell: string): number => {
    if (edicoes.has(cell)) return edicoes.get(cell)!;
    const salvo = salvosAtual.data?.get(cell);
    if (salvo !== undefined) return salvo;
    return preview.get(cell) ?? 0;
  };

  const setValor = (cell: string, v: string) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    setEdicoes((prev) => {
      const next = new Map(prev);
      next.set(cell, n);
      return next;
    });
  };

  const todasLinhas = useMemo(
    () => [
      ...grupos.maoDeObra.flatMap((g) => g.linhas),
      ...grupos.equipamentos.linhas,
      ...grupos.veiculos.linhas,
    ],
    [grupos],
  );

  const handleSalvar = () => {
    const rows: CelulaHistograma[] = [];
    for (const col of colunas) {
      for (const linha of todasLinhas) {
        const cell = celulaKey(col.key, linha.recursoTipo, linha.chave);
        rows.push({
          obra_key: col.key,
          recurso_tipo: linha.recursoTipo,
          recurso_chave: linha.chave,
          valor: valorAtual(cell),
        });
      }
    }
    salvar.mutate({ semana: semanaAtual, rows });
  };

  const temLinhas = todasLinhas.length > 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Histograma
          </h1>
          <p className="text-sm text-muted-foreground">
            Semana de {fmtDataLocal(semanaAtual)} · a semana atual é editável; a anterior mostra o
            que foi salvo e a seguinte replica a atual.
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSalvar} disabled={salvar.isPending || !temLinhas}>
            <Save className="h-4 w-4 mr-1" /> Salvar semana atual
          </Button>
        )}
      </div>

      {!temLinhas ? (
        <EmptyState
          icon={BarChart3}
          title="Nada para exibir ainda."
          description="Cadastre funções (com delegações) e tipos de veículo para montar as linhas do histograma."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {colunas.map((col) => (
            <ColunaCard
              key={col.key}
              col={col}
              grupos={grupos}
              semanas={{ anterior: semanaAnterior, atual: semanaAtual, seguinte: semanaSeguinte }}
              salvosAnterior={salvosAnterior.data}
              valorAtual={valorAtual}
              setValor={setValor}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function ColunaCard({
  col,
  grupos,
  semanas,
  salvosAnterior,
  valorAtual,
  setValor,
  canEdit,
}: {
  col: Coluna;
  grupos: ReturnType<typeof montarGruposLinhas>;
  semanas: { anterior: string; atual: string; seguinte: string };
  salvosAnterior: Map<string, number> | undefined;
  valorAtual: (cell: string) => number;
  setValor: (cell: string, v: string) => void;
  canEdit: boolean;
}) {
  const linhaCell = (recursoTipo: "funcao" | "veiculo_tipo", chave: string) =>
    celulaKey(col.key, recursoTipo, chave);

  const somaGrupo = (g: GrupoLinhas, fonte: "anterior" | "atual") =>
    g.linhas.reduce((s, l) => {
      const cell = linhaCell(l.recursoTipo, l.chave);
      return s + (fonte === "atual" ? valorAtual(cell) : (salvosAnterior?.get(cell) ?? 0));
    }, 0);

  const renderGrupo = (g: GrupoLinhas, destaqueTotal = false) => (
    <tbody key={g.id}>
      <tr className="bg-muted/40">
        <td colSpan={4} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide">
          {g.titulo}
        </td>
      </tr>
      {g.linhas.map((l) => {
        const cell = linhaCell(l.recursoTipo, l.chave);
        const atual = valorAtual(cell);
        const anterior = salvosAnterior?.get(cell);
        return (
          <tr key={cell} className="border-b border-border/60 last:border-0">
            <td className="px-2 py-1 text-sm truncate max-w-[160px]" title={l.rotulo}>
              {l.rotulo}
            </td>
            <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground">
              {anterior ?? "—"}
            </td>
            <td className="px-1 py-0.5 text-center">
              {canEdit ? (
                <Input
                  type="number"
                  min={0}
                  value={atual}
                  onChange={(e) => setValor(cell, e.target.value)}
                  className="h-7 w-16 mx-auto text-center tabular-nums px-1"
                />
              ) : (
                <span className="text-sm tabular-nums">{atual}</span>
              )}
            </td>
            <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground italic">
              {atual}
            </td>
          </tr>
        );
      })}
      <tr className={destaqueTotal ? "bg-primary/5 font-semibold" : "font-medium"}>
        <td className="px-2 py-1 text-xs uppercase">Total</td>
        <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground">
          {somaGrupo(g, "anterior")}
        </td>
        <td className="px-2 py-1 text-center text-sm tabular-nums">{somaGrupo(g, "atual")}</td>
        <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground italic">
          {somaGrupo(g, "atual")}
        </td>
      </tr>
    </tbody>
  );

  const totalMaoDeObra = (fonte: "anterior" | "atual") =>
    grupos.maoDeObra.reduce((s, g) => s + somaGrupo(g, fonte), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {col.subtitulo ? (
            <Badge variant="outline" className="tabular-nums">
              {col.subtitulo}
            </Badge>
          ) : null}
          <span className="font-semibold truncate" title={col.titulo}>
            {col.titulo}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="px-2 py-1 text-left font-medium">Recurso</th>
              <th className="px-2 py-1 font-medium">
                Semana -1
                <div className="font-normal tabular-nums">{fmtDataLocal(semanas.anterior)}</div>
              </th>
              <th className="px-2 py-1 font-medium text-foreground">
                Semana atual
                <div className="font-normal tabular-nums">{fmtDataLocal(semanas.atual)}</div>
              </th>
              <th className="px-2 py-1 font-medium">
                Semana +1
                <div className="font-normal tabular-nums">{fmtDataLocal(semanas.seguinte)}</div>
              </th>
            </tr>
          </thead>
          {grupos.maoDeObra.map((g) => renderGrupo(g))}
          <tbody>
            <tr className="bg-primary/10 font-semibold border-y border-border">
              <td className="px-2 py-1 text-xs uppercase">Total mão de obra</td>
              <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground">
                {totalMaoDeObra("anterior")}
              </td>
              <td className="px-2 py-1 text-center text-sm tabular-nums">{totalMaoDeObra("atual")}</td>
              <td className="px-2 py-1 text-center text-sm tabular-nums text-muted-foreground italic">
                {totalMaoDeObra("atual")}
              </td>
            </tr>
          </tbody>
          {grupos.equipamentos.linhas.length > 0 && renderGrupo(grupos.equipamentos, true)}
          {grupos.veiculos.linhas.length > 0 && renderGrupo(grupos.veiculos, true)}
        </table>
      </CardContent>
    </Card>
  );
}

export default Histograma;
