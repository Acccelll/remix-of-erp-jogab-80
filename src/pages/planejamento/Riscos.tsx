import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { riscosRepo } from "@/lib/repositories/planejamento";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
import { AlertTriangle, Plus, Loader2, Trash2, BookOpen, CalendarClock } from "lucide-react";
import {
  ESCALA_IMPACTO,
  ESCALA_PROBABILIDADE,
  MATRIZ_5x5,
  SEVERIDADE_BG,
  SEVERIDADE_DOT,
  SEVERIDADE_LABEL,
  classificarRisco,
  contarRiscosNaMatriz,
  scoreRisco,
  severidadeDe,
  type Severidade,
} from "@/lib/riscos/matriz";
import { useNavigate } from "react-router-dom";
import { confirmDialog } from "@/lib/ui/confirm";
import { formatBRL } from "@/lib/core/currency";

type Risco = {
  id: string;
  obra_id: string;
  codigo: string | null;
  descricao: string;
  categoria: string | null;
  tipo: string | null;
  probabilidade: number | null;
  impacto: number | null;
  impacto_financeiro: number | null;
  status: string;
  responsavel: string | null;
  resposta: string | null;
  plano_resposta: string | null;
  observacoes: string | null;
  data_revisao: string | null;
  data_identificacao: string | null;
  card_id: string | null;
  created_at: string;
};
type Obra = { id: string; nome: string };

import {
  STATUS_RISCO_PROGRAMA_OPCOES as STATUS_OPCOES,
  STATUS_RISCO_PROGRAMA_LABEL as STATUS_LABEL,
} from "@/lib/status";
import { PageLoading } from "@/components/common/PageLoading";
import { EscopoBanner } from "@/components/planejamento/EscopoBanner";
const RESPOSTA_OPCOES = ["evitar", "transferir", "mitigar", "aceitar", "explorar"] as const;
const TIPO_OPCOES = ["ameaca", "oportunidade"] as const;
const CATEGORIAS = [
  "tecnico",
  "cronograma",
  "custo",
  "qualidade",
  "seguranca",
  "ambiental",
  "contratual",
  "fornecedor",
  "externo",
];

export default function Riscos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [riscos, setRiscos] = useState<Risco[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );

  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [filtroSev, setFiltroSev] = useState<"todas" | Severidade>("todas");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [destaqueCelula, setDestaqueCelula] = useState<string | null>(null);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Risco | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    obra_id: "",
    codigo: "",
    descricao: "",
    categoria: "",
    tipo: "ameaca",
    probabilidade: 3,
    impacto: 3,
    impacto_financeiro: "",
    status: "aberto",
    responsavel: "",
    resposta: "",
    plano_resposta: "",
    observacoes: "",
    data_revisao: "",
    card_id: "",
  });

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  async function load() {
    setLoading(true);
    try {
      const data = await riscosRepo.listFull();
      setRiscos(data as unknown as Risco[]); // TODO(ARC-001/E-01): riscos.card_id ausente.
    } catch {
      toast.error("Falha ao carregar riscos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const riscosFiltrados = useMemo(() => {
    return riscos.filter((r) => {
      if (filtroObra !== "todas" && r.obra_id !== filtroObra) return false;
      if (filtroStatus === "ativos" && !["aberto", "em_andamento"].includes(r.status)) return false;
      if (filtroStatus !== "ativos" && filtroStatus !== "todos" && r.status !== filtroStatus)
        return false;
      if (filtroCat !== "todas" && r.categoria !== filtroCat) return false;
      if (filtroSev !== "todas") {
        const sev = severidadeDe(r.probabilidade ?? 0, r.impacto ?? 0);
        if (sev !== filtroSev) return false;
      }
      if (destaqueCelula) {
        const [p, i] = destaqueCelula.split(":").map(Number);
        if ((r.probabilidade ?? 0) !== p || (r.impacto ?? 0) !== i) return false;
      }
      return true;
    });
  }, [riscos, filtroObra, filtroStatus, filtroSev, filtroCat, destaqueCelula]);

  const contagem = useMemo(() => contarRiscosNaMatriz(riscosFiltrados), [riscosFiltrados]);

  const kpis = useMemo(() => {
    const ativos = riscos.filter((r) => ["aberto", "em_andamento"].includes(r.status));
    const por: Record<Severidade, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    for (const r of ativos) por[severidadeDe(r.probabilidade ?? 0, r.impacto ?? 0)]++;
    const hoje = new Date().toISOString().slice(0, 10);
    const revAtrasada = ativos.filter((r) => r.data_revisao && r.data_revisao < hoje).length;
    const totalExp = ativos.reduce(
      (s, r) =>
        s +
        (scoreRisco(r.probabilidade ?? 0, r.impacto ?? 0) * (Number(r.impacto_financeiro) || 0)) /
          25,
      0,
    );
    return { total: ativos.length, por, revAtrasada, totalExp };
  }, [riscos]);

  function openNew() {
    setEditing(null);
    setForm({
      obra_id: obras[0]?.id ?? "",
      codigo: "",
      descricao: "",
      categoria: "",
      tipo: "ameaca",
      probabilidade: 3,
      impacto: 3,
      impacto_financeiro: "",
      status: "aberto",
      responsavel: "",
      resposta: "",
      plano_resposta: "",
      observacoes: "",
      data_revisao: "",
      card_id: "",
    });
    setOpenForm(true);
  }

  function openEdit(r: Risco) {
    setEditing(r);
    setForm({
      obra_id: r.obra_id,
      codigo: r.codigo ?? "",
      descricao: r.descricao,
      categoria: r.categoria ?? "",
      tipo: r.tipo ?? "ameaca",
      probabilidade: r.probabilidade ?? 3,
      impacto: r.impacto ?? 3,
      impacto_financeiro: r.impacto_financeiro != null ? String(r.impacto_financeiro) : "",
      status: r.status,
      responsavel: r.responsavel ?? "",
      resposta: r.resposta ?? "",
      plano_resposta: r.plano_resposta ?? "",
      observacoes: r.observacoes ?? "",
      data_revisao: r.data_revisao ?? "",
      card_id: r.card_id ?? "",
    });
    setOpenForm(true);
  }

  async function salvar() {
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (!form.descricao.trim()) return toast.error("Informe a descrição");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      obra_id: form.obra_id,
      codigo: form.codigo || null,
      descricao: form.descricao.trim(),
      categoria: form.categoria || null,
      tipo: form.tipo || null,
      probabilidade: form.probabilidade,
      impacto: form.impacto,
      impacto_financeiro: form.impacto_financeiro ? Number(form.impacto_financeiro) : null,
      status: form.status,
      responsavel: form.responsavel || null,
      resposta: form.resposta || null,
      plano_resposta: form.plano_resposta || null,
      observacoes: form.observacoes || null,
      data_revisao: form.data_revisao || null,
      card_id: form.card_id || null,
      ...(editing ? {} : { owner_id: u.user?.id ?? null }),
    };
    // TODO(ARC-001/E-01): payload contém `card_id`, `owner_id`, `resposta`, `plano_resposta` etc. ausentes no schema.
    try {
      await riscosRepo.upsert(editing?.id ?? null, payload as any);
    } catch {
      setSaving(false);
      return toast.error("Falha ao salvar — exige permissão GM?");
    }
    setSaving(false);
    toast.success(editing ? "Risco atualizado" : "Risco criado");
    setOpenForm(false);
    await load();
  }

  async function excluir(r: Risco) {
    if (!(await confirmDialog({ title: `Excluir o risco "${r.descricao.slice(0, 60)}"?` }))) return;
    try {
      await riscosRepo.remove(r.id);
    } catch {
      return toast.error("Falha ao excluir");
    }
    toast.success("Risco excluído");
    await load();
  }

  function gerarLicao(r: Risco) {
    const params = new URLSearchParams({
      risco_id: r.id,
      obra_id: r.obra_id,
      situacao: r.descricao,
      categoria: r.categoria ?? "",
    });
    navigate(`/planejamento/licoes-aprendidas?${params}`);
  }

  const sevFormForm = severidadeDe(form.probabilidade, form.impacto);
  const scoreFormForm = scoreRisco(form.probabilidade, form.impacto);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Matriz de Riscos
          </h1>
          <p className="text-sm text-muted-foreground">
            Probabilidade × Impacto (1–5). Severidade calculada automaticamente.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Risco
        </Button>
      </div>

      <EscopoBanner
        nivel="portfolio"
        modulo="riscos"
        obraFiltradaId={filtroObra !== "todas" ? filtroObra : null}
        obraFiltradaNome={filtroObra !== "todas" ? (obraById[filtroObra] ?? null) : null}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Riscos ativos</div>
          <div className="text-2xl font-bold">{kpis.total}</div>
        </div>
        {(["critico", "alto", "medio", "baixo"] as Severidade[]).map((s) => (
          <div key={s} className="border rounded-lg p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${SEVERIDADE_DOT[s]}`} />
              {SEVERIDADE_LABEL[s]}
            </div>
            <div className="text-2xl font-bold">{kpis.por[s]}</div>
          </div>
        ))}
      </div>

      {kpis.revAtrasada > 0 && (
        <div className="border border-warning/40 bg-warning/5 rounded-md p-3 text-sm text-warning flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {kpis.revAtrasada} risco(s) ativo(s) com data de revisão vencida.
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger>
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
          <Label className="text-xs">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Ativos (aberto + em andamento)</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Severidade</Label>
          <Select value={filtroSev} onValueChange={(v) => setFiltroSev(v as never)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {(["critico", "alto", "medio", "baixo"] as Severidade[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERIDADE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          {/* Heatmap */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Heatmap 5×5</div>
              {destaqueCelula && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDestaqueCelula(null)}
                  className="h-7 text-xs"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              {/* Eixo Y (impacto) */}
              <div
                className="flex flex-col justify-around text-[10px] text-muted-foreground pr-1 text-right"
                style={{ width: 36 }}
              >
                {[5, 4, 3, 2, 1].map((v) => (
                  <div key={v}>{v}</div>
                ))}
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-5 gap-1">
                  {MATRIZ_5x5.flat().map((cel) => {
                    const k = `${cel.p}:${cel.i}`;
                    const count = contagem.get(k) ?? 0;
                    const active = destaqueCelula === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setDestaqueCelula(active ? null : k)}
                        className={`aspect-square rounded border-2 text-xs font-medium transition ${
                          SEVERIDADE_BG[cel.severidade]
                        } ${active ? "ring-2 ring-foreground" : ""} ${
                          count > 0 ? "" : "opacity-50"
                        }`}
                        title={`P=${cel.p} × I=${cel.i} = ${cel.score} (${SEVERIDADE_LABEL[cel.severidade]})`}
                      >
                        {count > 0 ? count : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-5 gap-1 mt-1 text-[10px] text-muted-foreground text-center">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <div key={v}>{v}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
              <span>↑ Impacto</span>
              <span>Probabilidade →</span>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {riscosFiltrados.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 border rounded-lg">
                Nenhum risco encontrado.
              </div>
            ) : (
              riscosFiltrados.map((r) => {
                const sev = severidadeDe(r.probabilidade ?? 0, r.impacto ?? 0);
                const score = scoreRisco(r.probabilidade ?? 0, r.impacto ?? 0);
                const hoje = new Date().toISOString().slice(0, 10);
                const vencida = r.data_revisao && r.data_revisao < hoje;
                return (
                  <div
                    key={r.id}
                    className="border rounded-lg p-4 hover:bg-accent/30 transition cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.codigo && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.codigo}
                            </span>
                          )}
                          <span className="font-medium">{r.descricao}</span>
                          <Badge variant="outline" className={`gap-1 ${SEVERIDADE_BG[sev]}`}>
                            <span className={`h-2 w-2 rounded-full ${SEVERIDADE_DOT[sev]}`} />
                            {SEVERIDADE_LABEL[sev]} ({score})
                          </Badge>
                          <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                          {r.tipo === "oportunidade" && (
                            <Badge variant="outline">Oportunidade</Badge>
                          )}
                          {r.categoria && (
                            <Badge variant="outline" className="text-xs">
                              {r.categoria}
                            </Badge>
                          )}
                          {vencida && (
                            <Badge variant="destructive" className="gap-1">
                              <CalendarClock className="h-3 w-3" />
                              revisão vencida
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {obraById[r.obra_id] ?? "—"}
                          {r.responsavel && ` • ${r.responsavel}`}
                          {r.impacto_financeiro != null &&
                            ` • ${formatBRL(Number(r.impacto_financeiro), { minDigits: 0 })}`}
                          {r.data_revisao && ` • revisão: ${r.data_revisao}`}
                        </div>
                        {r.plano_resposta && (
                          <div className="text-xs mt-2 text-muted-foreground line-clamp-2">
                            <strong>Plano:</strong> {r.plano_resposta}
                          </div>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => gerarLicao(r)}
                          title="Registrar lição aprendida"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => excluir(r)}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Risco" : "Novo Risco"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Obra</Label>
                <Select
                  value={form.obra_id}
                  onValueChange={(v) => setForm({ ...form, obra_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código (opcional)</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="R-001"
                />
              </div>
            </div>

            <div>
              <Label>Descrição do risco</Label>
              <Textarea
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Atraso na entrega de aço por escassez do mercado"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPCOES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "ameaca" ? "Ameaça" : "Oportunidade"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.categoria || "__none"}
                  onValueChange={(v) => setForm({ ...form, categoria: v === "__none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sliders P × I */}
            <div className="border rounded-md p-3 bg-muted/30 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Probabilidade — {ESCALA_PROBABILIDADE[form.probabilidade]}</Label>
                  <Badge variant="outline">{form.probabilidade}</Badge>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[form.probabilidade]}
                  onValueChange={(v) => setForm({ ...form, probabilidade: v[0] })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Impacto — {ESCALA_IMPACTO[form.impacto]}</Label>
                  <Badge variant="outline">{form.impacto}</Badge>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[form.impacto]}
                  onValueChange={(v) => setForm({ ...form, impacto: v[0] })}
                />
              </div>
              <div
                className={`rounded-md border-2 p-3 text-center font-semibold ${
                  SEVERIDADE_BG[classificarRisco(scoreFormForm)]
                }`}
              >
                Severidade: {SEVERIDADE_LABEL[sevFormForm]} (score {scoreFormForm}/25)
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Resposta</Label>
                <Select
                  value={form.resposta || "__none"}
                  onValueChange={(v) => setForm({ ...form, resposta: v === "__none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {RESPOSTA_OPCOES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsável</Label>
                <Input
                  value={form.responsavel}
                  onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  placeholder="Nome ou setor"
                />
              </div>
            </div>

            <div>
              <Label>Plano de resposta</Label>
              <Textarea
                rows={3}
                value={form.plano_resposta}
                onChange={(e) => setForm({ ...form, plano_resposta: e.target.value })}
                placeholder="Ações para tratar o risco"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Impacto financeiro (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.impacto_financeiro}
                  onChange={(e) => setForm({ ...form, impacto_financeiro: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de revisão</Label>
                <DatePickerField
                  value={form.data_revisao}
                  onChange={(v) => setForm({ ...form, data_revisao: v })}
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
