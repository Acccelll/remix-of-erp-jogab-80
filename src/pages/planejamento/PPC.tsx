import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pacotesTrabalhoRepo } from "@/lib/repositories/planejamento";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Loader2, CheckCircle2, XCircle, TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "@/components/ui/chart";
import { calcularPPC, ppcPorSemana, paretoCausas, type Compromisso } from "@/lib/lastplanner/ppc";
import { formatSemana, isoDate, proximasNSemanas, semanaDe } from "@/lib/lastplanner/semana";
import { useUrlState } from "@/hooks/useUrlState";
import { PageLoading } from "@/components/common/PageLoading";

type CompromissoRow = {
  id: string;
  pacote_id: string;
  obra_id: string;
  semana_inicio: string;
  concluido: boolean;
  concluido_em: string | null;
  causa_chave: string | null;
  causa_detalhe: string | null;
};
type Obra = { id: string; nome: string };
type Causa = {
  chave: string;
  label: string;
  categoria: string | null;
  ordem: number;
  ativo: boolean;
};
type Pacote = { id: string; descricao: string };

const META_PPC = 0.85; // meta padrão Last Planner

export default function PPC() {
  const [loading, setLoading] = useState(true);
  const [compromissos, setCompromissos] = useState<CompromissoRow[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [causas, setCausas] = useState<Causa[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);

  const [filtroObra, setFiltroObra] = useUrlState("obra", "todas");
  const [janelaStr, setJanelaStr] = useUrlState("janela", "8");
  const janela = (["4", "8", "12"].includes(janelaStr) ? janelaStr : "8") as "4" | "8" | "12";
  const setJanela = (v: "4" | "8" | "12") => setJanelaStr(v);

  // diálogo "marcar como NÃO concluído"
  const [openMarcar, setOpenMarcar] = useState(false);
  const [target, setTarget] = useState<CompromissoRow | null>(null);
  const [causaForm, setCausaForm] = useState<{ chave: string; detalhe: string }>({
    chave: "",
    detalhe: "",
  });
  const [saving, setSaving] = useState(false);

  // 12 semanas para trás até a semana atual (rolagem da janela termina hoje)
  const periodo = useMemo(() => {
    const futuras = proximasNSemanas(1, new Date()); // semana atual
    const fim = futuras[0];
    const n = Number(janela);
    const semanas: Date[] = [];
    for (let i = n - 1; i >= 0; i--) {
      semanas.push(new Date(fim.getTime() - i * 7 * 86_400_000));
    }
    return semanas;
  }, [janela]);
  const periodoIso = useMemo(() => periodo.map(isoDate), [periodo]);

  const causaByChave = useMemo(
    () => Object.fromEntries(causas.map((c) => [c.chave, c.label])),
    [causas],
  );
  const obraByid = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const pacoteById = useMemo(
    () => Object.fromEntries(pacotes.map((p) => [p.id, p.descricao])),
    [pacotes],
  );

  async function load() {
    setLoading(true);
    const inicio = periodoIso[0];
    const fim = periodoIso[periodoIso.length - 1];
    const [r1, r3, r4] = await Promise.all([
      supabase
        .from("compromissos_semanais")
        .select(
          "id, pacote_id, obra_id, semana_inicio, concluido, concluido_em, causa_chave, causa_detalhe",
        )
        .gte("semana_inicio", inicio)
        .lte("semana_inicio", fim)
        .order("semana_inicio", { ascending: true }),
      supabase
        .from("causas_nao_conclusao")
        .select("chave, label, categoria, ordem, ativo")
        .eq("ativo", true)
        .order("ordem"),
      pacotesTrabalhoRepo.listDescricao().then((data) => ({ data, error: null as any })),
    ]);
    if (r1.error || r3.error || r4.error) {
      toast.error("Falha ao carregar PPC");
      setLoading(false);
      return;
    }
    setCompromissos((r1.data ?? []) as CompromissoRow[]);
    setCausas((r3.data ?? []) as Causa[]);
    setPacotes((r4.data ?? []) as Pacote[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janela]);

  const compromissosFiltrados = useMemo(
    () => compromissos.filter((c) => filtroObra === "todas" || c.obra_id === filtroObra),
    [compromissos, filtroObra],
  );

  const ppcGlobal = useMemo(
    () =>
      calcularPPC(
        compromissosFiltrados.map<Compromisso>((c) => ({
          semana_inicio: c.semana_inicio,
          concluido: c.concluido,
          causa_chave: c.causa_chave,
        })),
      ),
    [compromissosFiltrados],
  );

  // série semanal preenchida (inclusive semanas com 0 compromissos)
  const serie = useMemo(() => {
    const map = new Map(
      ppcPorSemana(
        compromissosFiltrados.map<Compromisso>((c) => ({
          semana_inicio: c.semana_inicio,
          concluido: c.concluido,
          causa_chave: c.causa_chave,
        })),
      ).map((p) => [p.semana, p]),
    );
    return periodoIso.map((sem) => {
      const p = map.get(sem);
      return {
        semana: sem,
        label: formatSemana(sem),
        ppc: p ? Math.round(p.ppc * 100) : null,
        comprometidos: p?.comprometidos ?? 0,
        concluidos: p?.concluidos ?? 0,
      };
    });
  }, [compromissosFiltrados, periodoIso]);

  const pareto = useMemo(
    () =>
      paretoCausas(
        compromissosFiltrados.map<Compromisso>((c) => ({
          semana_inicio: c.semana_inicio,
          concluido: c.concluido,
          causa_chave: c.causa_chave,
        })),
      ).map((p) => ({
        ...p,
        label: p.causa === "sem_causa" ? "Sem causa" : (causaByChave[p.causa] ?? p.causa),
      })),
    [compromissosFiltrados, causaByChave],
  );

  // tendência: comparar primeira metade vs. segunda metade
  const tendencia = useMemo(() => {
    const validos = serie.filter((s) => s.ppc != null) as Array<{ ppc: number }>;
    if (validos.length < 2) return 0;
    const meio = Math.floor(validos.length / 2);
    const a = validos.slice(0, meio);
    const b = validos.slice(meio);
    const avg = (arr: typeof validos) => arr.reduce((s, x) => s + x.ppc, 0) / arr.length;
    return Math.round(avg(b) - avg(a));
  }, [serie]);

  function abrirMarcar(c: CompromissoRow) {
    setTarget(c);
    setCausaForm({ chave: c.causa_chave ?? "", detalhe: c.causa_detalhe ?? "" });
    setOpenMarcar(true);
  }

  async function marcarConcluido(c: CompromissoRow) {
    const { error } = await supabase
      .from("compromissos_semanais")
      .update({
        concluido: true,
        concluido_em: new Date().toISOString(),
        causa_chave: null,
        causa_detalhe: null,
      })
      .eq("id", c.id);
    if (error) return toast.error("Falha ao marcar concluído");
    toast.success("Compromisso concluído");
    await load();
  }

  async function salvarNaoConcluido() {
    if (!target) return;
    if (!causaForm.chave) return toast.error("Selecione a causa");
    setSaving(true);
    const { error } = await supabase
      .from("compromissos_semanais")
      .update({
        concluido: false,
        concluido_em: null,
        causa_chave: causaForm.chave,
        causa_detalhe: causaForm.detalhe || null,
      })
      .eq("id", target.id);
    setSaving(false);
    if (error) return toast.error("Falha ao registrar");
    toast.success("Causa registrada");
    setOpenMarcar(false);
    await load();
  }

  const ppcPct = Math.round(ppcGlobal.ppc * 100);
  const metaPct = Math.round(META_PPC * 100);
  const corPpc =
    ppcPct >= metaPct
      ? "text-success"
      : ppcPct >= metaPct - 15
        ? "text-warning"
        : "text-destructive";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          PPC & Causas
        </h1>
        <p className="text-sm text-muted-foreground">
          Percent Plan Complete — % de pacotes comprometidos que foram concluídos. Meta: {metaPct}%.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger aria-label="Filtrar por obra">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Janela</Label>
          <Select value={janela} onValueChange={(v) => setJanela(v as "4" | "8" | "12")}>
            <SelectTrigger aria-label="Selecionar janela de semanas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Últimas 4 semanas</SelectItem>
              <SelectItem value="8">Últimas 8 semanas</SelectItem>
              <SelectItem value="12">Últimas 12 semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">PPC do período</div>
              <div className={`text-3xl font-bold ${corPpc}`}>{ppcPct}%</div>
              <div className="text-[11px] text-muted-foreground mt-1">Meta: {metaPct}%</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">Comprometidos</div>
              <div className="text-3xl font-bold">{ppcGlobal.comprometidos}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {ppcGlobal.concluidos} concluído(s)
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">Não concluídos</div>
              <div className="text-3xl font-bold">
                {ppcGlobal.comprometidos - ppcGlobal.concluidos}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {pareto.length} causa(s) distintas
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-xs text-muted-foreground">Tendência</div>
              <div
                className={`text-3xl font-bold flex items-center gap-1 ${
                  tendencia > 0 ? "text-success" : tendencia < 0 ? "text-destructive" : ""
                }`}
              >
                {tendencia > 0 ? (
                  <TrendingUp className="h-6 w-6" />
                ) : tendencia < 0 ? (
                  <TrendingDown className="h-6 w-6" />
                ) : null}
                {tendencia > 0 ? "+" : ""}
                {tendencia}pp
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">2ª metade vs. 1ª metade</div>
            </div>
          </div>

          {/* Gráfico PPC semanal */}
          <figure
            className="border rounded-lg p-4"
            role="figure"
            aria-label={`PPC por semana. PPC do período ${ppcPct}%, meta ${metaPct}%. Tendência ${tendencia > 0 ? "+" : ""}${tendencia} pontos percentuais entre a primeira e a segunda metade da janela.`}
          >
            <div className="text-sm font-semibold mb-3">PPC por semana</div>
            <p className="sr-only">
              PPC do período: {ppcPct}%. Meta: {metaPct}%. Tendência: {tendencia > 0 ? "+" : ""}
              {tendencia} pp.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <RTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "ppc" ? [`${value}%`, "PPC"] : [String(value), name]
                    }
                  />
                  <ReferenceLine
                    y={metaPct}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    label={{ value: `meta ${metaPct}%`, fontSize: 10, fill: "hsl(var(--primary))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ppc"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </figure>

          {/* Pareto de causas */}
          <figure
            className="border rounded-lg p-4"
            role="figure"
            aria-label={
              pareto.length === 0
                ? "Pareto de causas: nenhum compromisso não concluído no período."
                : `Pareto de causas: ${pareto.length} causa(s). Principal: ${pareto[0]?.label ?? "—"} com ${pareto[0]?.count ?? 0} ocorrências.`
            }
          >
            <div className="text-sm font-semibold mb-3">Pareto de causas (não conclusão)</div>
            {pareto.length > 0 && (
              <p className="sr-only">
                Principal causa: {pareto[0].label} ({pareto[0].count} ocorrências).
                {pareto[1] ? ` Segunda: ${pareto[1].label} (${pareto[1].count}).` : ""}
              </p>
            )}
            {pareto.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                Nenhum compromisso não concluído no período. 🎉
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pareto.map((p) => ({ ...p, pctNum: Math.round(p.pct * 100) }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string, item) => {
                        if (name === "count") {
                          const pct = (item?.payload as { pctNum?: number })?.pctNum ?? 0;
                          return [`${value} (${pct}%)`, "Ocorrências"];
                        }
                        return [String(value), name];
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {pareto.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0
                              ? "hsl(var(--destructive))"
                              : i < 3
                                ? "hsl(var(--primary))"
                                : "hsl(var(--muted-foreground))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </figure>

          {/* Lista de compromissos comprometidos (para fechar a semana) */}
          <div className="border rounded-lg">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-sm font-semibold">Compromissos do período</div>
              <Badge variant="outline">{compromissosFiltrados.length} registro(s)</Badge>
            </div>
            {compromissosFiltrados.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Nenhum compromisso registrado nesta janela. Comprometa pacotes em{" "}
                <span className="font-medium">Pacotes de Trabalho</span>.
              </div>
            ) : (
              <div className="divide-y">
                {compromissosFiltrados
                  .slice()
                  .sort((a, b) => b.semana_inicio.localeCompare(a.semana_inicio))
                  .map((c) => (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {pacoteById[c.pacote_id] ?? "pacote removido"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatSemana(c.semana_inicio)} • {obraByid[c.obra_id] ?? "—"}
                          {c.causa_chave && (
                            <>
                              {" • causa: "}
                              <span className="font-medium">
                                {causaByChave[c.causa_chave] ?? c.causa_chave}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={c.concluido ? "default" : "destructive"} className="gap-1">
                        {c.concluido ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Concluído
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Não concluído
                          </>
                        )}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {!c.concluido && (
                          <Button size="sm" variant="default" onClick={() => marcarConcluido(c)}>
                            Concluir
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => abrirMarcar(c)}>
                          {c.concluido ? "Reverter" : "Editar causa"}
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={openMarcar} onOpenChange={setOpenMarcar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar não conclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Pacote: </span>
              <span className="font-medium">
                {target ? (pacoteById[target.pacote_id] ?? "—") : ""}
              </span>
            </div>
            <div>
              <Label>Causa</Label>
              <Select
                value={causaForm.chave}
                onValueChange={(v) => setCausaForm({ ...causaForm, chave: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {causas.map((c) => (
                    <SelectItem key={c.chave} value={c.chave}>
                      {c.label}
                      {c.categoria && (
                        <span className="text-muted-foreground"> · {c.categoria}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detalhe (opcional)</Label>
              <Textarea
                rows={3}
                value={causaForm.detalhe}
                onChange={(e) => setCausaForm({ ...causaForm, detalhe: e.target.value })}
                placeholder="Contexto, lição aprendida, ação corretiva…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMarcar(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNaoConcluido} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
