// @ts-nocheck
// Linha de Balanço (LoB) — visualização + cadastro de localizações e atribuição
// de serviço/localização às atividades do cronograma.
//
// Visualização SVG custom: eixo X = tempo, eixo Y = localizações (ordenadas).
// Cada serviço vira uma polilinha cruzando as localizações (ponto = atividade,
// segmento = duração [inicio,fim]). Cores estáveis por serviço.

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, GripVertical, AlertTriangle } from "lucide-react";
import {
  format,
  parseISO,
  isValid,
  min as dMin,
  max as dMax,
  differenceInCalendarDays,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { obraLocalizacoesRepo } from "@/lib/repositories/obraDetalhe";
import { cronogramaKeys, useUpdateCronogramaItem } from "@/hooks/obras/useCronograma";
import { montarLinhasBalanco, detectarSobreposicoes } from "@/lib/cronograma/linha-balanco";
import { confirmDialog } from "@/lib/ui/confirm";

type CronoItem = {
  id: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean | null;
  localizacao_id: string | null;
  servico_lob: string | null;
};
type Localizacao = { id: string; nome: string; ordem: number };

const CORES = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function LinhaBalancoTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();

  const locsQ = useQuery({
    queryKey: ["obra_localizacoes", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obra_localizacoes")
        .select("id,nome,ordem")
        .eq("obra_id", obraId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Localizacao[];
    },
  });

  const cronoQ = useQuery({
    queryKey: cronogramaKeys.lobByObra(obraId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cronograma_itens")
        .select("id,descricao,data_inicio,data_fim,ativo,localizacao_id,servico_lob")
        .eq("obra_id", obraId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CronoItem[];
    },
  });

  const locs = locsQ.data ?? [];
  const crono = (cronoQ.data ?? []).filter((c) => c.ativo !== false);

  // Mutations — localizações
  const mAddLoc = useMutation({
    mutationFn: async (nome: string) => {
      const ordem = (locs[locs.length - 1]?.ordem ?? 0) + 10;
      const { error } = await supabase
        .from("obra_localizacoes")
        .insert({ obra_id: obraId, nome, ordem });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_localizacoes", obraId] });
      toast.success("Localização adicionada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
  const mDelLoc = useMutation({
    mutationFn: async (id: string) => {
      await obraLocalizacoesRepo.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra_localizacoes", obraId] });
      qc.invalidateQueries({ queryKey: cronogramaKeys.lobByObra(obraId) });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
  const mRenameLoc = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      await obraLocalizacoesRepo.rename(id, nome);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_localizacoes", obraId] }),
  });
  const mReordLoc = useMutation({
    mutationFn: async ({ id, ordem }: { id: string; ordem: number }) => {
      await obraLocalizacoesRepo.reorder(id, ordem);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra_localizacoes", obraId] }),
  });

  const mEditCrono = useUpdateCronogramaItem({
    invalidateKeys: [cronogramaKeys.lobByObra(obraId)],
  });

  const ordemPorId = useMemo(() => new Map(locs.map((l) => [l.id, l.ordem])), [locs]);
  const nomePorId = useMemo(() => new Map(locs.map((l) => [l.id, l.nome])), [locs]);
  const servicosExistentes = useMemo(() => {
    const s = new Set<string>();
    for (const c of crono) if (c.servico_lob?.trim()) s.add(c.servico_lob.trim());
    return Array.from(s).sort();
  }, [crono]);

  const linhas = useMemo(() => {
    const itens = crono.map((c) => ({
      id: c.id,
      servico_lob: c.servico_lob,
      loc_ordem: c.localizacao_id ? (ordemPorId.get(c.localizacao_id) ?? null) : null,
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
    }));
    return montarLinhasBalanco(itens);
  }, [crono, ordemPorId]);

  const conflitos = useMemo(() => detectarSobreposicoes(linhas), [linhas]);
  const conflitosSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflitos) {
      s.add(c.aId);
      s.add(c.bId);
    }
    return s;
  }, [conflitos]);

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi label="Localizações" v={String(locs.length)} />
        <Kpi label="Serviços (LoB)" v={String(linhas.length)} />
        <Kpi
          label="Conflitos de ritmo"
          v={String(conflitos.length)}
          tone={conflitos.length > 0 ? "warn" : undefined}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Linha de Balanço</CardTitle>
          <div className="text-xs text-muted-foreground">
            {linhas.length === 0
              ? "Cadastre localizações e atribua serviços às atividades para ver a LoB."
              : "Cada cor = um serviço; ponto = atividade; segmento = duração."}
          </div>
        </CardHeader>
        <CardContent>
          <LobChart linhas={linhas} locs={locs} conflitosSet={conflitosSet} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Localizações da obra</CardTitle>
          <NovaLocDialog onAdd={(nome) => mAddLoc.mutate(nome)} />
        </CardHeader>
        <CardContent>
          {locs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma localização cadastrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locs.map((l, idx) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <button
                          className="text-xs px-1 hover:bg-muted rounded disabled:opacity-30"
                          disabled={idx === 0}
                          onClick={() => {
                            const prev = locs[idx - 1];
                            mReordLoc.mutate({ id: l.id, ordem: prev.ordem - 1 });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="text-xs px-1 hover:bg-muted rounded disabled:opacity-30"
                          disabled={idx === locs.length - 1}
                          onClick={() => {
                            const next = locs[idx + 1];
                            mReordLoc.mutate({ id: l.id, ordem: next.ordem + 1 });
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <InlineEdit
                        value={l.nome}
                        onSave={(nome) => mRenameLoc.mutate({ id: l.id, nome })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (
                            await confirmDialog({
                              title: `Excluir "${l.nome}"?`,
                              description: "Atividades vinculadas ficarão sem localização.",
                            })
                          ) {
                            mDelLoc.mutate(l.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atribuir serviço e localização às atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead className="w-40">Início</TableHead>
                  <TableHead className="w-40">Fim</TableHead>
                  <TableHead className="w-48">Serviço (LoB)</TableHead>
                  <TableHead className="w-48">Localização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crono.map((c) => (
                  <TableRow
                    key={c.id}
                    className={conflitosSet.has(c.id) ? "bg-warning/10" : ""}
                  >
                    <TableCell className="text-xs">
                      {c.descricao ?? "—"}
                      {conflitosSet.has(c.id) && (
                        <Badge
                          variant="outline"
                          className="ml-2 gap-1 text-[10px] border-warning/40 text-warning"
                        >
                          <AlertTriangle className="h-3 w-3" /> sobreposição
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{c.data_inicio}</TableCell>
                    <TableCell className="text-xs tabular-nums">{c.data_fim}</TableCell>
                    <TableCell>
                      <ServicoCombo
                        value={c.servico_lob}
                        options={servicosExistentes}
                        onChange={(v) =>
                          mEditCrono.mutate({ id: c.id, patch: { servico_lob: v || null } })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={c.localizacao_id ?? "__none__"}
                        onValueChange={(v) =>
                          mEditCrono.mutate({
                            id: c.id,
                            patch: { localizacao_id: v === "__none__" ? null : v },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— (sem)</SelectItem>
                          {locs.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Kpi as KpiBase } from "@/components/common/Kpi";
function Kpi({ label, v, tone }: { label: string; v: string; tone?: "warn" }) {
  return (
    <KpiBase label={label} value={v} tone={tone === "warn" ? "warning" : "default"} labelUppercase />
  );
}

function InlineEdit({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (!editing) {
    return (
      <button
        className="text-sm hover:underline flex items-center gap-1"
        onClick={() => {
          setV(value);
          setEditing(true);
        }}
      >
        {value} <Pencil className="h-3 w-3 opacity-40" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-7 text-sm"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(v);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onSave(v);
          setEditing(false);
        }}
      >
        OK
      </Button>
    </div>
  );
}

function NovaLocDialog({ onAdd }: { onAdd: (nome: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova localização
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova localização</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-xs text-muted-foreground">
            Nome (ex.: Pavimento 1, Trecho km 0–1, Módulo A)
          </label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (nome.trim()) {
                onAdd(nome.trim());
                setNome("");
                setOpen(false);
              }
            }}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServicoCombo({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <Input
      list="servicos-lob"
      className="h-8 text-xs"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if ((v || null) !== (value ?? null)) onChange(v.trim());
      }}
      placeholder="—"
      // datalist é compartilhada na página
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      data-options={options.join("|")}
    />
  );
}

function LobChart({
  linhas,
  locs,
  conflitosSet,
}: {
  linhas: ReturnType<typeof montarLinhasBalanco>;
  locs: Localizacao[];
  conflitosSet: Set<string>;
}) {
  if (!linhas.length || !locs.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        Sem dados suficientes para renderizar a Linha de Balanço.
      </div>
    );
  }
  const W = 980;
  const H = 60 + locs.length * 44;
  const padL = 140,
    padR = 24,
    padT = 28,
    padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const todasDatas: Date[] = [];
  for (const l of linhas)
    for (const p of l.pontos) {
      todasDatas.push(p.inicio);
      todasDatas.push(p.fim);
    }
  const t0 = dMin(todasDatas);
  const t1 = dMax(todasDatas);
  const totalDias = Math.max(1, differenceInCalendarDays(t1, t0));

  // Y: localizações ordenadas (ordem crescente, mostradas de cima p/ baixo)
  const locsOrd = [...locs].sort((a, b) => a.ordem - b.ordem);
  const yByOrdem = new Map<number, number>();
  locsOrd.forEach((l, idx) =>
    yByOrdem.set(l.ordem, padT + (idx + 0.5) * (innerH / locsOrd.length)),
  );

  const xByDate = (d: Date) => padL + (differenceInCalendarDays(d, t0) / totalDias) * innerW;

  // Ticks de tempo: ~6 marcas
  const tickCount = 6;
  const ticks: Date[] = [];
  for (let i = 0; i <= tickCount; i++)
    ticks.push(addDays(t0, Math.round((i / tickCount) * totalDias)));

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {/* Linhas de localização (horizontais) */}
        {locsOrd.map((l) => {
          const y = yByOrdem.get(l.ordem)!;
          return (
            <g key={l.id}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="2 4"
              />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-foreground text-[11px]">
                {l.nome}
              </text>
            </g>
          );
        })}
        {/* Eixo X — ticks de tempo */}
        {ticks.map((d, i) => {
          const x = xByDate(d);
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={padT}
                y2={H - padB}
                stroke="currentColor"
                className="text-border"
                strokeOpacity={0.3}
              />
              <text
                x={x}
                y={H - padB + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {format(d, "MMM/yy", { locale: ptBR })}
              </text>
            </g>
          );
        })}
        {/* Linha "hoje" */}
        {(() => {
          const hoje = new Date();
          if (hoje >= t0 && hoje <= t1) {
            const x = xByDate(hoje);
            return (
              <line x1={x} x2={x} y1={padT} y2={H - padB} stroke="#64748b" strokeDasharray="3 3" />
            );
          }
          return null;
        })()}
        {/* Serviços */}
        {linhas.map((linha, sIdx) => {
          const cor = CORES[sIdx % CORES.length];
          // polyline conectando os pontos (loc, meio do intervalo)
          const pts = linha.pontos
            .map((p) => {
              const y = yByOrdem.get(p.loc);
              if (y === undefined) return null;
              const xMid = (xByDate(p.inicio) + xByDate(p.fim)) / 2;
              return { x: xMid, y, p };
            })
            .filter(
              (x): x is { x: number; y: number; p: (typeof linha.pontos)[number] } => x !== null,
            );
          const path = pts
            .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={linha.servico}>
              {path && <path d={path} stroke={cor} strokeWidth={1.5} fill="none" opacity={0.5} />}
              {linha.pontos.map((p) => {
                const y = yByOrdem.get(p.loc);
                if (y === undefined) return null;
                const x1 = xByDate(p.inicio);
                const x2 = xByDate(p.fim);
                const isConflito = conflitosSet.has(p.id);
                return (
                  <g key={p.id}>
                    <rect
                      x={x1}
                      y={y - 5}
                      width={Math.max(2, x2 - x1)}
                      height={10}
                      fill={cor}
                      fillOpacity={0.7}
                      stroke={isConflito ? "#dc2626" : cor}
                      strokeWidth={isConflito ? 1.5 : 0.5}
                      rx={2}
                    />
                    <title>{`${linha.servico} · ${format(p.inicio, "dd/MM/yy")}–${format(p.fim, "dd/MM/yy")}`}</title>
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* Legenda */}
        <g transform={`translate(${padL}, 10)`}>
          {linhas.slice(0, 8).map((l, i) => (
            <g key={l.servico} transform={`translate(${i * 130}, 0)`}>
              <rect width={10} height={10} fill={CORES[i % CORES.length]} rx={2} />
              <text x={14} y={9} className="fill-foreground text-[10px]">
                {l.servico}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
