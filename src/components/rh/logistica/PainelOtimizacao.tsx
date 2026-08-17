import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  ArrowUpDown,
  Download,
  FileText,
  MapPinOff,
  MousePointerClick,
  Pin,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatarDistancia,
  type CandidatoMobilizacao,
  type DeficitFuncao,
} from "@/lib/logistica/equipes";
import type { PontoColaborador, PontoObra } from "@/hooks/rh/useLogisticaPontos";

/** Uma obra próxima na visão inversa (colaborador → obras). */
export interface ObraProxima {
  ponto: PontoObra;
  distanciaKm: number | null;
  /** Déficit total da obra (soma por função); 0 quando não há previsão. */
  deficitTotal: number;
  /** Déficit específico da função do colaborador focado, ou 0. */
  deficitFuncao: number;
}

export interface PainelOtimizacaoProps {
  obras: PontoObra[];
  obraSelecionada: PontoObra | null;
  onSelecionarObra: (obraId: string | null) => void;

  deficits: DeficitFuncao[];
  candidatos: CandidatoMobilizacao[];

  funcoes: string[];
  funcaoFiltro: string;
  onFuncaoFiltro: (f: string) => void;
  busca: string;
  onBusca: (b: string) => void;
  apenasDisponiveis: boolean;
  onApenasDisponiveis: (v: boolean) => void;

  raioKm: number;
  onRaioKm: (v: number) => void;

  semLocal: PontoColaborador[];
  podeEditar: boolean;
  onMobilizar: (colaboradorId: string) => void;

  /* --- Onda 2 --- */

  /** Seleção múltipla para mobilização em lote. */
  selecionados: Set<string>;
  onToggleSelecionado: (id: string) => void;
  onLimparSelecao: () => void;
  onMobilizarLote: () => void;

  /** Visão inversa: colaborador focado → obras mais próximas. */
  colaboradoresParaFoco: PontoColaborador[];
  colaboradorFocadoId: string;
  onColaboradorFocado: (id: string) => void;
  colaboradorFocado: PontoColaborador | null;
  obrasProximas: ObraProxima[];
  onMobilizarParaObra: (obraId: string) => void;

  /** Ajuste manual de pin. */
  modoEdicaoPin: boolean;
  onToggleEdicaoPin: () => void;
  totalOverrides: number;
  onLimparOverrides: () => void;

  /* --- Onda 4 --- */
  /** Ordenação da visão inversa. */
  ordemInverso: "distancia" | "deficit" | "data";
  onOrdemInverso: (v: "distancia" | "deficit" | "data") => void;
  /** Exportação do resultado (CSV/PDF). */
  onExportarCsv: () => void;
  onExportarPdf: () => void;
  podeExportar: boolean;
}

const TODAS = "__todas__";
const NENHUM = "__nenhum__";
const RAIO_MAX = 500;

/**
 * Painel lateral: onde falta gente, quem está mais perto, e — na visão inversa
 * — para quais obras o colaborador focado deveria ir. A mobilização continua
 * sendo um ato explícito, aqui pelo botão (individual, em lote ou por obra).
 */
const PainelOtimizacao: React.FC<PainelOtimizacaoProps> = ({
  obras,
  obraSelecionada,
  onSelecionarObra,
  deficits,
  candidatos,
  funcoes,
  funcaoFiltro,
  onFuncaoFiltro,
  busca,
  onBusca,
  apenasDisponiveis,
  onApenasDisponiveis,
  ordemInverso,
  onOrdemInverso,
  onExportarCsv,
  onExportarPdf,
  podeExportar,
  raioKm,
  onRaioKm,
  semLocal,
  podeEditar,
  onMobilizar,
  selecionados,
  onToggleSelecionado,
  onLimparSelecao,
  onMobilizarLote,
  colaboradoresParaFoco,
  colaboradorFocadoId,
  onColaboradorFocado,
  colaboradorFocado,
  obrasProximas,
  onMobilizarParaObra,
  modoEdicaoPin,
  onToggleEdicaoPin,
  totalOverrides,
  onLimparOverrides,
}) => {
  const totalFaltando = deficits.reduce((soma, d) => soma + d.deficit, 0);
  const modoInverso = !!colaboradorFocado;
  const naoReconhecidos = semLocal.filter((p) => p.motivoSemLocal === "nao-reconhecida");
  const semCadastro = semLocal.filter((p) => p.motivoSemLocal !== "nao-reconhecida");

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Barra de modos: edição de pin + visão inversa */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={modoEdicaoPin ? "default" : "outline"}
          className={cn("h-7 gap-1 px-2 text-[11px]", modoEdicaoPin && "bg-amber-500 hover:bg-amber-500/90")}
          onClick={onToggleEdicaoPin}
          title="Arraste pins no mapa para corrigir a localização"
        >
          <Pin className="h-3 w-3" />
          {modoEdicaoPin ? "Ajustando pin" : "Ajustar pin"}
        </Button>
        {totalOverrides > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onLimparOverrides}
            title="Remover todos os ajustes manuais de pin"
          >
            <RotateCcw className="h-3 w-3" />
            Resetar ({totalOverrides})
          </Button>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onExportarCsv}
            disabled={!podeExportar}
            title="Exportar resultado em CSV"
          >
            <Download className="h-3 w-3" /> CSV
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onExportarPdf}
            disabled={!podeExportar}
            title="Exportar resultado em PDF"
          >
            <FileText className="h-3 w-3" /> PDF
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Select
          value={obraSelecionada?.obra.id ?? TODAS}
          onValueChange={(v) => onSelecionarObra(v === TODAS ? null : v)}
          disabled={modoInverso}
        >
          <SelectTrigger aria-label="Obra em foco">
            <SelectValue placeholder="Selecione uma obra" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as obras</SelectItem>
            {obras.map((p) => (
              <SelectItem key={p.obra.id} value={p.obra.id}>
                {p.obra.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={colaboradorFocadoId || NENHUM}
          onValueChange={(v) => onColaboradorFocado(v === NENHUM ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Focar em um colaborador">
            <SelectValue placeholder="Focar em um colaborador (visão inversa)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUM}>— Nenhum (visão por obra)</SelectItem>
            {colaboradoresParaFoco.map((p) => (
              <SelectItem key={p.colaborador.id} value={p.colaborador.id}>
                {p.colaborador.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!modoInverso && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => onBusca(e.target.value)}
                  placeholder="Buscar colaborador"
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <Select
                value={funcaoFiltro || TODAS}
                onValueChange={(v) => onFuncaoFiltro(v === TODAS ? "" : v)}
              >
                <SelectTrigger className="h-8 w-32 text-xs" aria-label="Filtrar por função">
                  <SelectValue placeholder="Função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as funções</SelectItem>
                  {funcoes.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={apenasDisponiveis}
                onChange={(e) => onApenasDisponiveis(e.target.checked)}
                className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
              />
              Mostrar apenas disponíveis
            </label>

            {obraSelecionada && (
              <div className="space-y-1 rounded-md border border-dashed p-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground">
                  <span>Raio de deslocamento</span>
                  <span className="tabular-nums text-foreground">
                    {raioKm === 0 ? "sem limite" : `≤ ${raioKm} km`}
                  </span>
                </div>
                <Slider
                  value={[raioKm]}
                  min={0}
                  max={RAIO_MAX}
                  step={25}
                  onValueChange={([v]) => onRaioKm(v ?? 0)}
                  aria-label="Raio de deslocamento em km"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* --------- MODO INVERSO --------- */}
      {modoInverso && colaboradorFocado && (
        <>
          <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">
                  {colaboradorFocado.colaborador.nome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {colaboradorFocado.colaborador.funcao || "Sem função"} ·{" "}
                  {colaboradorFocado.rotuloLocal ?? "sem local"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onColaboradorFocado("")}
                aria-label="Sair da visão inversa"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Obras mais próximas
              </p>
              <Select value={ordemInverso} onValueChange={(v) => onOrdemInverso(v as any)}>
                <SelectTrigger className="h-6 w-[150px] text-[10px]" aria-label="Ordenar obras">
                  <ArrowUpDown className="mr-1 h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distancia">Menor distância</SelectItem>
                  <SelectItem value="deficit">Maior déficit</SelectItem>
                  <SelectItem value="data">Data mais próxima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              {obrasProximas.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Nenhuma obra ativa encontrada.
                </p>
              ) : (
                <ul className="divide-y">
                  {obrasProximas.map(({ ponto, distanciaKm, deficitTotal, deficitFuncao }) => (
                    <li
                      key={ponto.obra.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent/10"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{ponto.obra.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {deficitFuncao > 0
                            ? `Faltam ${deficitFuncao} desta função`
                            : deficitTotal > 0
                              ? `${deficitTotal} vagas em outras funções`
                              : "Sem déficit"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {distanciaKm === null ? "—" : formatarDistancia(distanciaKm)}
                      </span>
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 shrink-0 px-2 text-[10px]"
                          onClick={() => onMobilizarParaObra(ponto.obra.id)}
                        >
                          Mobilizar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </>
      )}

      {/* --------- MODO POR OBRA --------- */}
      {!modoInverso && obraSelecionada && (
        <>
          <div className="rounded-md border p-2">
            <p className="truncate font-display text-sm font-semibold">
              {obraSelecionada.obra.nome}
            </p>
            {obraSelecionada.rotuloLocal && (
              <p className="truncate text-xs text-muted-foreground">
                {obraSelecionada.rotuloLocal}
              </p>
            )}
            {deficits.length > 0 ? (
              <>
                <p className="mt-2 text-[10px] font-bold uppercase text-warning">
                  Faltam {totalFaltando}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {deficits.map((d) => (
                    <li key={d.funcao} className="flex justify-between gap-2">
                      <span className="truncate">{d.funcao}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {d.atual}/{d.previsto}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Sem déficit previsto no histograma desta semana.
              </p>
            )}
          </div>

          {selecionados.size > 0 && podeEditar && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary/50 bg-primary/10 px-2 py-1.5 text-xs">
              <span className="font-medium">
                {selecionados.size} selecionado{selecionados.size > 1 ? "s" : ""}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={onLimparSelecao}
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={onMobilizarLote}
                >
                  Mobilizar em lote
                </Button>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
              Candidatos mais próximos
            </p>
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              {candidatos.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Nenhum colaborador disponível com os filtros atuais.
                </p>
              ) : (
                <ul className="divide-y">
                  {candidatos.map((c) => (
                    <li
                      key={c.colaborador.id}
                      className={cn(
                        "flex items-center gap-2 p-2 hover:bg-accent/10",
                        selecionados.has(c.colaborador.id) && "bg-primary/5",
                      )}
                    >
                      {podeEditar && (
                        <Checkbox
                          checked={selecionados.has(c.colaborador.id)}
                          onCheckedChange={() => onToggleSelecionado(c.colaborador.id)}
                          className="h-3.5 w-3.5"
                          aria-label={`Selecionar ${c.colaborador.nome}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{c.colaborador.nome}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{c.motivo}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] tabular-nums",
                          c.distanciaKm === null && "text-muted-foreground",
                        )}
                      >
                        {c.distanciaKm === null ? "—" : formatarDistancia(c.distanciaKm)}
                      </span>
                      {podeEditar && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 shrink-0 px-2 text-[10px]"
                          onClick={() => onMobilizar(c.colaborador.id)}
                        >
                          Mobilizar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </>
      )}

      {!modoInverso && !obraSelecionada && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center">
          <MousePointerClick className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Selecione uma obra — no mapa, na lista acima ou <em>foque um colaborador</em> para
            ver as obras mais próximas.
          </p>
        </div>
      )}

      {semLocal.length > 0 && (
        <div className="space-y-2 rounded-md border border-dashed p-2">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
            <MapPinOff className="h-3 w-3" />
            Sem localização ({semLocal.length})
          </p>

          {/* Dois grupos porque a ação é diferente: um precisa de cadastro, o
              outro quase sempre é erro de digitação num município existente. */}
          {naoReconhecidos.length > 0 && (
            <div>
              <p className="text-[11px] font-medium leading-tight text-warning">
                Cidade não reconhecida ({naoReconhecidos.length})
              </p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                O valor cadastrado não corresponde a nenhum município — confira a grafia.
              </p>
              <ul className="mt-1 space-y-0.5">
                {naoReconhecidos.slice(0, 6).map((p) => (
                  <li key={p.colaborador.id} className="truncate text-[11px]">
                    <span className="text-muted-foreground">{p.colaborador.nome}: </span>
                    <span className="font-mono text-warning">
                      {p.rotuloLocal || p.colaborador.cidade}
                    </span>
                  </li>
                ))}
                {naoReconhecidos.length > 6 && (
                  <li className="text-[11px] text-muted-foreground">
                    +{naoReconhecidos.length - 6}
                  </li>
                )}
              </ul>
            </div>
          )}

          {semCadastro.length > 0 && (
            <div>
              <p className="text-[11px] font-medium leading-tight">
                Sem cidade cadastrada ({semCadastro.length})
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {semCadastro.slice(0, 8).map((p) => (
                  <Badge
                    key={p.colaborador.id}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {p.colaborador.nome}
                  </Badge>
                ))}
                {semCadastro.length > 8 && (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    +{semCadastro.length - 8}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PainelOtimizacao;
