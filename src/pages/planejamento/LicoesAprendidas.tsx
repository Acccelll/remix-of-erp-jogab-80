import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { riscosRepo, licoesAprendidasRepo } from "@/lib/repositories/planejamento";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { BookOpen, Plus, Loader2, Trash2, Search, Lightbulb, X } from "lucide-react";
import { confirmDialog } from "@/lib/ui/confirm";
import { PageLoading } from "@/components/common/PageLoading";
import { EscopoBanner } from "@/components/planejamento/EscopoBanner";

type Licao = {
  id: string;
  obra_id: string;
  categoria: string | null;
  situacao: string;
  recomendacao: string;
  impacto: string | null;
  responsavel: string | null;
  tags: string[] | null;
  data_registro: string;
  risco_id: string | null;
  card_id: string | null;
  created_at: string;
};
type Obra = { id: string; nome: string };
type RiscoLite = { id: string; descricao: string; obra_id: string };

const IMPACTO_OPCOES = ["baixo", "medio", "alto"] as const;
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
  "gestao",
];

export default function LicoesAprendidas() {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [licoes, setLicoes] = useState<Licao[]>([]);
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [riscos, setRiscos] = useState<RiscoLite[]>([]);

  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroCat, setFiltroCat] = useState("todas");
  const [filtroTag, setFiltroTag] = useState("");
  const [busca, setBusca] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Licao | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    obra_id: "",
    categoria: "",
    situacao: "",
    recomendacao: "",
    impacto: "medio",
    responsavel: "",
    tags: [] as string[],
    tagInput: "",
    data_registro: new Date().toISOString().slice(0, 10),
    risco_id: "",
    card_id: "",
  });

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const riscoById = useMemo(
    () => Object.fromEntries(riscos.map((r) => [r.id, r.descricao])),
    [riscos],
  );

  async function load() {
    setLoading(true);
    try {
      const [licoes, riscosData] = await Promise.all([
        licoesAprendidasRepo.listCompleta(),
        riscosRepo.listResumoDescricao(),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLicoes((licoes ?? []) as any[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRiscos((riscosData ?? []) as any[]);
    } catch {
      toast.error("Falha ao carregar lições");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Pré-preenchimento via querystring (vindo da página de Riscos)
  useEffect(() => {
    const risco_id = params.get("risco_id");
    if (!risco_id) return;
    setEditing(null);
    setForm((f) => ({
      ...f,
      obra_id: params.get("obra_id") ?? f.obra_id,
      situacao: params.get("situacao") ?? f.situacao,
      categoria: params.get("categoria") ?? f.categoria,
      risco_id,
    }));
    setOpenForm(true);
    // limpa querystring
    setParams({}, { replace: true });
  }, [params, setParams]);

  const todasTags = useMemo(() => {
    const s = new Set<string>();
    for (const l of licoes) for (const t of l.tags ?? []) s.add(t);
    return [...s].sort();
  }, [licoes]);

  const licoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return licoes.filter((l) => {
      if (filtroObra !== "todas" && l.obra_id !== filtroObra) return false;
      if (filtroCat !== "todas" && l.categoria !== filtroCat) return false;
      if (filtroTag && !(l.tags ?? []).includes(filtroTag)) return false;
      if (q) {
        const blob = `${l.situacao} ${l.recomendacao} ${(l.tags ?? []).join(" ")}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [licoes, filtroObra, filtroCat, filtroTag, busca]);

  // Recomendadas: lições de OUTRAS obras na mesma categoria (quando obra é filtrada)
  const recomendadas = useMemo(() => {
    if (filtroObra === "todas") return [];
    const cats = new Set(
      licoes.filter((l) => l.obra_id === filtroObra && l.categoria).map((l) => l.categoria!),
    );
    if (cats.size === 0) return [];
    return licoes
      .filter((l) => l.obra_id !== filtroObra && l.categoria && cats.has(l.categoria))
      .slice(0, 5);
  }, [licoes, filtroObra]);

  function openNew() {
    setEditing(null);
    setForm({
      obra_id: obras[0]?.id ?? "",
      categoria: "",
      situacao: "",
      recomendacao: "",
      impacto: "medio",
      responsavel: "",
      tags: [],
      tagInput: "",
      data_registro: new Date().toISOString().slice(0, 10),
      risco_id: "",
      card_id: "",
    });
    setOpenForm(true);
  }

  function openEdit(l: Licao) {
    setEditing(l);
    setForm({
      obra_id: l.obra_id,
      categoria: l.categoria ?? "",
      situacao: l.situacao,
      recomendacao: l.recomendacao,
      impacto: l.impacto ?? "medio",
      responsavel: l.responsavel ?? "",
      tags: l.tags ?? [],
      tagInput: "",
      data_registro: l.data_registro,
      risco_id: l.risco_id ?? "",
      card_id: l.card_id ?? "",
    });
    setOpenForm(true);
  }

  function addTag() {
    const t = form.tagInput.trim().toLowerCase();
    if (!t) return;
    if (form.tags.includes(t)) {
      setForm({ ...form, tagInput: "" });
      return;
    }
    setForm({ ...form, tags: [...form.tags, t], tagInput: "" });
  }
  function removeTag(t: string) {
    setForm({ ...form, tags: form.tags.filter((x) => x !== t) });
  }

  async function salvar() {
    if (!form.obra_id) return toast.error("Selecione a obra");
    if (!form.situacao.trim()) return toast.error("Descreva a situação");
    if (!form.recomendacao.trim()) return toast.error("Informe a recomendação");
    setSaving(true);
    const payload = {
      obra_id: form.obra_id,
      categoria: form.categoria || null,
      situacao: form.situacao.trim(),
      recomendacao: form.recomendacao.trim(),
      impacto: form.impacto || null,
      responsavel: form.responsavel || null,
      tags: form.tags,
      data_registro: form.data_registro,
      risco_id: form.risco_id || null,
      card_id: form.card_id || null,
    };
    // TODO(ARC-001/E-01): payload contém campos ausentes no schema de licoes_aprendidas.
    try {
      await licoesAprendidasRepo.upsert(editing?.id ?? null, payload as any);
    } catch {
      setSaving(false);
      return toast.error("Falha ao salvar — exige permissão GM?");
    }
    setSaving(false);
    toast.success(editing ? "Lição atualizada" : "Lição registrada");
    setOpenForm(false);
    await load();
  }

  async function excluir(l: Licao) {
    if (!(await confirmDialog({ title: "Excluir esta lição aprendida?" }))) return;
    try {
      await licoesAprendidasRepo.remove(l.id);
    } catch {
      return toast.error("Falha ao excluir");
    }
    toast.success("Lição excluída");
    await load();
  }

  const riscosFormForm = useMemo(
    () => riscos.filter((r) => !form.obra_id || r.obra_id === form.obra_id),
    [riscos, form.obra_id],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Lições Aprendidas
          </h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca de aprendizados das obras — reutilize em projetos futuros.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Lição
        </Button>
      </div>

      <EscopoBanner
        nivel="portfolio"
        modulo="licoes"
        obraFiltradaId={filtroObra !== "todas" ? filtroObra : null}
        obraFiltradaNome={filtroObra !== "todas" ? (obraById[filtroObra] ?? null) : null}
      />

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar em situação, recomendação ou tags…"
            />
          </div>
        </div>
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

      {/* Chips de tags */}
      {todasTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {todasTags.slice(0, 20).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTag(filtroTag === t ? "" : t)}
              className={`px-2 py-0.5 rounded-full text-xs border transition ${
                filtroTag === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              #{t}
            </button>
          ))}
          {filtroTag && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFiltroTag("")}
              className="h-6 text-xs"
            >
              limpar
            </Button>
          )}
        </div>
      )}

      {/* Recomendadas (quando obra filtrada) */}
      {recomendadas.length > 0 && (
        <div className="border border-warning/30 bg-warning/5 rounded-lg p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-warning">
            <Lightbulb className="h-4 w-4" />
            Lições recomendadas para esta obra
          </div>
          <div className="space-y-2">
            {recomendadas.map((l) => (
              <div
                key={l.id}
                className="text-xs cursor-pointer hover:underline"
                onClick={() => openEdit(l)}
              >
                <span className="font-medium">{l.situacao}</span>
                <span className="text-muted-foreground">
                  {" "}
                  — {obraById[l.obra_id]} • {l.categoria}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : licoesFiltradas.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border rounded-lg">
          Nenhuma lição encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {licoesFiltradas.map((l) => (
            <div
              key={l.id}
              className="border rounded-lg p-4 hover:bg-accent/30 transition cursor-pointer"
              onClick={() => openEdit(l)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {l.categoria && <Badge variant="outline">{l.categoria}</Badge>}
                  {l.impacto && (
                    <Badge variant={l.impacto === "alto" ? "destructive" : "secondary"}>
                      impacto {l.impacto}
                    </Badge>
                  )}
                  {l.risco_id && (
                    <Badge variant="outline" className="text-xs">
                      ligada a risco
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    excluir(l);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="text-sm font-medium">{l.situacao}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-3">
                <strong>Recomendação:</strong> {l.recomendacao}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {(l.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">
                {obraById[l.obra_id] ?? "—"}
                {l.responsavel && ` • ${l.responsavel}`}
                {` • ${l.data_registro}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Lição Aprendida" : "Nova Lição Aprendida"}</DialogTitle>
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
                <Label>Data do registro</Label>
                <DatePickerField
                  value={form.data_registro}
                  onChange={(v) => setForm({ ...form, data_registro: v })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <Label>Impacto</Label>
                <Select
                  value={form.impacto}
                  onValueChange={(v) => setForm({ ...form, impacto: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPACTO_OPCOES.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
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
                />
              </div>
            </div>
            <div>
              <Label>Situação observada</Label>
              <Textarea
                rows={2}
                value={form.situacao}
                onChange={(e) => setForm({ ...form, situacao: e.target.value })}
                placeholder="O que aconteceu na obra?"
              />
            </div>
            <div>
              <Label>Recomendação</Label>
              <Textarea
                rows={3}
                value={form.recomendacao}
                onChange={(e) => setForm({ ...form, recomendacao: e.target.value })}
                placeholder="O que fazer (ou evitar) em projetos futuros?"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={form.tagInput}
                  onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="digite e Enter para adicionar"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Adicionar
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-muted flex items-center gap-1"
                    >
                      #{t}
                      <button onClick={() => removeTag(t)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Risco relacionado (opcional)</Label>
              <Select
                value={form.risco_id || "__none"}
                onValueChange={(v) => setForm({ ...form, risco_id: v === "__none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {riscosFormForm.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.descricao.slice(0, 80)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.risco_id && riscoById[form.risco_id] && (
                <div className="text-xs text-muted-foreground mt-1">
                  Vinculada a: {riscoById[form.risco_id]}
                </div>
              )}
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
