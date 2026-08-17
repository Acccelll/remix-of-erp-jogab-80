// PRO-031 — Quadro de Permissões editável (Módulo → Página → Ação V/E/X/I/Ex).
// Adaptado para layout de Tabela/Grid responsivo aos temas Light/Dark,
// e com correção visual do estado "Indeterminate" (parcial) dos módulos.
import React, { useMemo, useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth/useAuth";
import { usePlayersContext } from "@/contexts/PlayersContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw, Save, Lock, Users, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import {
  ACAO_LABEL,
  ACOES,
  acessosDerivadosDeMatriz,
  estadoModulo,
  listarModulos,
  matrizDeAcessosLegados,
  matrizVazia,
  migrarRotasFundidas,
  normalizarSetores,
  podeAcao,
  SETORES_SUPABASE,
  setAcao,
  toggleModulo,
  type AcaoPermissao,
  type MatrizPermissoes,
  type PapeisEspeciais,
} from "@/lib/authz/paginas";
import { MultiSelect } from "@/components/ui/multi-select";
import { PRESETS_FABRICA } from "@/lib/players/presetsFabrica";
import { PerfisPermissaoDialog } from "@/components/gm/PerfisPermissaoDialog";
import InfoDica from "@/components/common/InfoDica";

/** Explicações por rota, para regras que o rótulo da página não conta sozinho. */
const DICAS_PAGINA: Record<string, string> = {
  "/financeiro/aprovacao":
    "Apenas é visível as solicitações do setor responsável pela solicitação — com exceção de Financeiro, este responsável pela Aprovação e Recusa das solicitações.",
};

const MODULOS = listarModulos();

// Mapeamento dos cabeçalhos da tabela
const HEADER_LABELS: Record<AcaoPermissao, string> = {
  V: "Ver",
  E: "Editar",
  X: "Excluir",
  I: "Importar",
  Ex: "Exportar",
};

export default function Permissoes() {
  const { isGM } = useAuth();
  const { players, updatePlayer } = usePlayersContext();
  const [params, setParams] = useSearchParams();

  const [userId, setUserId] = useState<string | null>(params.get("user"));
  const [selectedPresetId, setSelectedPresetId] = useState<string>("nenhum");

  const [matriz, setMatriz] = useState<MatrizPermissoes>(matrizVazia());
  const [papeis, setPapeis] = useState<PapeisEspeciais>({});
  const [dirty, setDirty] = useState(false);
  const [perfisOpen, setPerfisOpen] = useState(false);
  const [expandidos, setExpandidos] = useState<string[]>(() => {
    if (typeof window === "undefined") return MODULOS.map((m) => m.id);
    try {
      const raw = localStorage.getItem("permissoes:expanded");
      if (raw) return JSON.parse(raw) as string[];
    } catch {}
    return MODULOS.map((m) => m.id);
  });
  // Marca quando o "checkbox de módulo" foi ligado em bloco pelo usuário.
  // Chave: `${moduloId}:${acao}`.
  const [bulkAplicado, setBulkAplicado] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("permissoes:expanded", JSON.stringify(expandidos));
    } catch {}
  }, [expandidos]);


  const usuarios = useMemo(() => {
    return [...players].sort((a, b) => (a.login || "").localeCompare(b.login || ""));
  }, [players]);

  const selecionado = useMemo(() => players.find((p) => p.id === userId) ?? null, [players, userId]);

  useEffect(() => {
    if (!selecionado) return;
    // A migração roda no carregamento para o quadro mostrar exatamente o que o
    // gate aplica; o próximo save persiste a matriz já sem as rotas fundidas.
    if (selecionado.matrizPermissoes) {
      setMatriz(migrarRotasFundidas(selecionado.matrizPermissoes as MatrizPermissoes));
    } else {
      setMatriz(migrarRotasFundidas(matrizDeAcessosLegados(selecionado.acessos ?? {})));
    }
    setPapeis(selecionado.papeisPermissao ?? {});
    setDirty(false);
    setSelectedPresetId("nenhum");
    setBulkAplicado({});
  }, [selecionado]);


  const selecionarUsuario = (id: string) => {
    setUserId(id);
    // Preserva os demais params (em especial `?tab=permissoes`, lido pelo
    // HubTabs) — substituir o querystring inteiro jogava o hub de volta
    // para a primeira aba (Usuários).
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("user", id);
        return next;
      },
      { replace: true },
    );
  };

  const mutar = (fn: (m: MatrizPermissoes) => MatrizPermissoes) => {
    setMatriz((prev) => fn(prev));
    setDirty(true);
  };

  const togglePagina = (rota: string, acao: AcaoPermissao, valor: boolean) => {
    mutar((m) => {
      let out = setAcao(m, rota, acao, valor);
      if (acao === "X" && valor) out = setAcao(out, rota, "E", true);
      if (acao === "E" && !valor) out = setAcao(out, rota, "X", false);
      return out;
    });
    // Mudança pontual descaracteriza o "bloco".
    const modulo = MODULOS.find((mod) => mod.paginas.some((p) => p.rota === rota));
    if (modulo) {
      setBulkAplicado((prev) => {
        if (!prev[`${modulo.id}:${acao}`]) return prev;
        const next = { ...prev };
        delete next[`${modulo.id}:${acao}`];
        return next;
      });
    }
  };

  const toggleBulk = (moduloId: string, acao: AcaoPermissao, valor: boolean) => {
    const m = MODULOS.find((mod) => mod.id === moduloId);
    if (!m) return;
    mutar((mat) => {
      let out = toggleModulo(mat, m, acao, valor);
      // Mesmo acoplamento do togglePagina: X exige E; retirar E retira X.
      if (acao === "X" && valor) out = toggleModulo(out, m, "E", true);
      if (acao === "E" && !valor) out = toggleModulo(out, m, "X", false);
      return out;
    });
    setBulkAplicado((prev) => {
      const next = { ...prev };
      const key = `${moduloId}:${acao}`;
      if (valor) next[key] = true;
      else delete next[key];
      // X exige E → marca E também; E desliga X.
      if (acao === "X" && valor) next[`${moduloId}:E`] = true;
      if (acao === "E" && !valor) delete next[`${moduloId}:X`];
      return next;
    });
  };


  const handleAplicarPreset = () => {
    if (selectedPresetId === "nenhum") return;
    const preset = PRESETS_FABRICA.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    const built = preset.build();
    setMatriz(built.matriz);
    setPapeis(built.papeis);
    setDirty(true);
    toast.success(`Preset "${preset.nome}" aplicado.`);
  };

  const salvar = () => {
    if (!selecionado) return;
    const acessos = acessosDerivadosDeMatriz(matriz, papeis);
    updatePlayer(selecionado.id, {
      matrizPermissoes: matriz,
      papeisPermissao: papeis,
      acessos,
    });
    setDirty(false);
    toast.success("Permissões salvas.");
  };

  const reverter = () => {
    if (!selecionado) return;
    setMatriz(
      migrarRotasFundidas(
        selecionado.matrizPermissoes
          ? (selecionado.matrizPermissoes as MatrizPermissoes)
          : matrizDeAcessosLegados(selecionado.acessos ?? {}),
      ),
    );
    setPapeis(selecionado.papeisPermissao ?? {});
    setDirty(false);
    setSelectedPresetId("nenhum");
  };

  if (!isGM) return <Navigate to="/" replace />;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Lock className="h-6 w-6" /> Permissões
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Edite a matriz de acesso por página e ação. Cadastro de usuário fica em{" "}
              <Link to="/gm" className="underline text-primary">
                Usuários
              </Link>
              .
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPerfisOpen(true)}>
              <Users className="h-4 w-4 mr-1" /> Perfis
            </Button>
          </div>
        </div>

        {/* Card Principal */}
        <Card className="shadow-lg overflow-hidden border-border bg-card">
          {/* Controles de Usuário e Preset */}
          <div className="p-6 border-b border-border space-y-6 bg-card">
            <h2 className="text-lg font-semibold">Usuário e preset</h2>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 flex-1 min-w-[200px] max-w-[300px]">
                <label className="text-sm text-muted-foreground">Usuário</label>
                <Select value={userId || ""} onValueChange={selecionarUsuario}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.login} {u.isGM ? "(GM)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex-1 min-w-[200px] max-w-[300px]">
                <label className="text-sm text-muted-foreground">Preset</label>
                <Select value={selectedPresetId} onValueChange={setSelectedPresetId} disabled={!selecionado}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {PRESETS_FABRICA.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <Button
                  variant="secondary"
                  onClick={handleAplicarPreset}
                  disabled={!selecionado || selectedPresetId === "nenhum"}
                >
                  Aplicar
                </Button>

                <Button variant="outline" onClick={reverter} disabled={!dirty}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Descartar
                </Button>

                <Button
                  onClick={salvar}
                  disabled={!dirty || selecionado?.isGM}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>

            {selecionado && (
              <div className="pt-4 flex items-center justify-between gap-6 flex-wrap text-sm border-t border-border/50">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={!!papeis.aprovarCompras}
                      onCheckedChange={(v) => {
                        setPapeis((prev) => ({ ...prev, aprovarCompras: v }));
                        setDirty(true);
                      }}
                    />
                    Aprovar Compras
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={!!papeis.aprovarFinanceiro}
                      onCheckedChange={(v) => {
                        setPapeis((prev) => ({ ...prev, aprovarFinanceiro: v }));
                        setDirty(true);
                      }}
                    />
                    Aprovar Financeiro
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap">Setores</span>
                    <MultiSelect
                      className="min-w-[220px]"
                      options={SETORES_SUPABASE}
                      selected={normalizarSetores(papeis.setores)}
                      onChange={(values) => {
                        setPapeis((prev) => ({ ...prev, setores: normalizarSetores(values) }));
                        setDirty(true);
                      }}
                      placeholder="Sem setor"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {dirty && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                      Alterações não salvas
                    </Badge>
                  )}
                  {selecionado.isGM && (
                    <span className="text-xs font-medium text-destructive">
                      Este usuário é GM — tem acesso total e não precisa de matriz.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tabela de Permissões */}
          {selecionado ? (
            <div className="w-full">
              <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  {expandidos.length} de {MODULOS.length} módulos expandidos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandidos(MODULOS.map((m) => m.id))}
                    disabled={expandidos.length === MODULOS.length}
                  >
                    <ChevronsUpDown className="h-4 w-4 mr-1" /> Expandir todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandidos([])}
                    disabled={expandidos.length === 0}
                  >
                    <ChevronsDownUp className="h-4 w-4 mr-1" /> Contrair todos
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(250px,1fr)_repeat(5,100px)] gap-4 px-6 py-4 border-b border-border text-sm font-medium text-muted-foreground bg-muted/40">
                <div>Módulo / Página</div>
                {ACOES.map((acao) => (
                  <div key={acao} className="text-center">
                    {HEADER_LABELS[acao]}
                  </div>
                ))}
              </div>

              <Accordion
                type="multiple"
                value={expandidos}
                onValueChange={setExpandidos}
                className="w-full"
              >
                {MODULOS.map((m) => {
                  return (
                  <AccordionItem key={m.id} value={m.id} className="border-b border-border last:border-none">
                    <div className="grid grid-cols-[minmax(250px,1fr)_repeat(5,100px)] gap-4 px-6 items-center hover:bg-muted/50 transition-colors group">

                      <AccordionTrigger className="hover:no-underline py-4 flex-row-reverse justify-end gap-3 font-semibold border-none">
                        <span>{m.rotulo}</span>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-normal rounded-full text-muted-foreground bg-transparent px-2.5"
                        >
                          {m.paginas.length} páginas
                        </Badge>
                      </AccordionTrigger>

                      {/* CHECKBOXES GLOBAIS DO MÓDULO
                          - âmbar = habilitado em bloco (bulk)
                          - primary = todas páginas marcadas individualmente
                          - amber pattern com hachura visual = parcial (indeterminate) */}
                      {ACOES.map((a) => {
                        const st = estadoModulo(matriz, m, a);
                        const foiBulk = !!bulkAplicado[`${m.id}:${a}`] && st === "all";
                        return (
                          <div key={a} className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Checkbox
                                  className={
                                    "w-4 h-4 transition-all " +
                                    (foiBulk
                                      ? "data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=checked]:text-white ring-2 ring-amber-400/40"
                                      : "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground") +
                                    " data-[state=indeterminate]:bg-amber-300 data-[state=indeterminate]:border-amber-400 data-[state=indeterminate]:text-white"
                                  }
                                  checked={st === "all" ? true : st === "some" ? "indeterminate" : false}
                                  disabled={selecionado?.isGM}
                                  onCheckedChange={(v) => toggleBulk(m.id, a, v === true)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {foiBulk
                                  ? `Módulo habilitado em bloco (${HEADER_LABELS[a]})`
                                  : st === "all"
                                  ? `Todas as páginas marcadas (${HEADER_LABELS[a]})`
                                  : st === "some"
                                  ? `Parcial — clique para marcar todas (${HEADER_LABELS[a]})`
                                  : `Marcar todas (${HEADER_LABELS[a]})`}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>




                    <AccordionContent className="pb-0 pt-0">
                      <div className="divide-y divide-border/50 bg-muted/20">
                        {m.paginas.map((pg) => (
                          <div
                            key={pg.rota}
                            className="grid grid-cols-[minmax(250px,1fr)_repeat(5,100px)] gap-4 px-6 py-3 items-center hover:bg-muted/60 transition-colors"
                          >
                            <div className="pl-8 text-sm text-foreground/80 flex items-center gap-1.5">
                              <span>{pg.rotulo}</span>
                              {DICAS_PAGINA[pg.rota] && (
                                <InfoDica texto={DICAS_PAGINA[pg.rota]} rotulo={pg.rotulo} />
                              )}
                            </div>

                            {/* CHECKBOXES INDIVIDUAIS DA PÁGINA */}
                            {ACOES.map((a) => (
                              <div key={a} className="flex justify-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Checkbox
                                      className="w-4 h-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                      checked={podeAcao(matriz, pg.rota, a)}
                                      disabled={selecionado?.isGM}
                                      onCheckedChange={(v) => togglePagina(pg.rota, a, v === true)}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>{ACAO_LABEL[a]}</TooltipContent>
                                </Tooltip>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ) : (
            <CardContent className="py-16 text-center text-muted-foreground bg-card">
              Selecione um usuário para visualizar e editar suas permissões.
            </CardContent>
          )}
        </Card>
      </div>

      <PerfisPermissaoDialog open={perfisOpen} onOpenChange={setPerfisOpen} />
    </TooltipProvider>
  );
}
