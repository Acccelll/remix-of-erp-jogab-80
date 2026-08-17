import { Link, useNavigate, useSearchParams, useParams, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Building2, Edit, Plus, Tags, Trash2, Upload } from "lucide-react";
import ImportarPlanoDialog from "@/components/financeiro/ImportarPlanoDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CATEGORIAS_INDIRETO_SEED,
  centrosKeys,
  deleteCentroCusto,
  fetchCentrosCusto,
  fetchCodigosNoSnapshot,
  upsertCentroCustoIndireto,
  upsertCentroCustoObra,
  type CentroCustoTotvs,
} from "@/lib/financeiro-totvs/centros";
import { fetchObrasComVinculo } from "@/lib/financeiro-totvs/queries";
import { confirmDialog } from "@/lib/ui/confirm";

type ModalState =
  | { open: false }
  | {
      open: true;
      codigo: string;
      descricao: string | null;
      existing?: CentroCustoTotvs;
      novo?: boolean;
    };

function CentrosCustoPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [aba, setAba] = useState<"todos" | "obra" | "indireto" | "nao">("todos");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [openImport, setOpenImport] = useState(false);

  const centrosQ = useQuery({ queryKey: centrosKeys.all, queryFn: fetchCentrosCusto });
  const obrasQ = useQuery({ queryKey: ["obras_vinculo"], queryFn: fetchObrasComVinculo });
  const codigosSnapshotQ = useQuery({
    queryKey: ["centros_codigos_snapshot"],
    queryFn: fetchCodigosNoSnapshot,
  });

  const linhas = useMemo(() => {
    const centros = centrosQ.data ?? [];
    const snapshot = codigosSnapshotQ.data ?? [];
    const map = new Map<
      string,
      {
        codigo: string;
        descricao: string | null;
        cadastro?: CentroCustoTotvs;
        no_snapshot: boolean;
      }
    >();
    for (const c of centros) {
      map.set(c.codigo, {
        codigo: c.codigo,
        descricao: c.descricao,
        cadastro: c,
        no_snapshot: false,
      });
    }
    for (const s of snapshot) {
      const ex = map.get(s.centro_custo);
      if (ex) ex.no_snapshot = true;
      else
        map.set(s.centro_custo, {
          codigo: s.centro_custo,
          descricao: s.desc_centro_custo,
          no_snapshot: true,
        });
    }
    let arr = Array.from(map.values());
    if (aba === "obra") arr = arr.filter((x) => x.cadastro?.tipo === "obra");
    else if (aba === "indireto") arr = arr.filter((x) => x.cadastro?.tipo === "indireto");
    else if (aba === "nao") arr = arr.filter((x) => !x.cadastro);
    if (filtro.trim()) {
      const f = filtro.toLowerCase();
      arr = arr.filter(
        (x) =>
          x.codigo.toLowerCase().includes(f) ||
          (x.descricao ?? "").toLowerCase().includes(f) ||
          (x.cadastro?.categoria ?? "").toLowerCase().includes(f),
      );
    }
    return arr.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [centrosQ.data, codigosSnapshotQ.data, aba, filtro]);

  const counts = useMemo(() => {
    const centros = centrosQ.data ?? [];
    const snapshot = codigosSnapshotQ.data ?? [];
    const cadastrados = new Set(centros.map((c) => c.codigo));
    const naoClass = snapshot.filter((s) => !cadastrados.has(s.centro_custo)).length;
    return {
      total: centros.length + naoClass,
      obra: centros.filter((c) => c.tipo === "obra").length,
      indireto: centros.filter((c) => c.tipo === "indireto").length,
      nao: naoClass,
    };
  }, [centrosQ.data, codigosSnapshotQ.data]);

  const delMut = useMutation({
    mutationFn: deleteCentroCusto,
    onSuccess: () => {
      toast.success("Cadastro removido.");
      qc.invalidateQueries({ queryKey: centrosKeys.all });
    },
    onError: (e: any) => toast.error(`Falha: ${e.message ?? e}`),
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <Link
          to="/financeiro/lancamentos"
          className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para Financeiro
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Centros de custo TOTVS</h1>
        <p className="text-sm text-muted-foreground">
          Classifique cada código do TOTVS como vinculado a uma obra ou como área indireta (ADM, RH,
          Frota, etc.). Centros não classificados aparecem como{" "}
          <Badge variant="outline">Pendente</Badge> e não entram no confronto por obra.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total de centros" valor={counts.total} />
        <Kpi label="Vinculados a obra" valor={counts.obra} />
        <Kpi label="Indiretos" valor={counts.indireto} />
        <Kpi label="Pendentes" valor={counts.nao} tone={counts.nao > 0 ? "warn" : undefined} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Cadastro</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar código, descrição, categoria…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-64"
            />
            <Button size="sm" variant="outline" onClick={() => setOpenImport(true)}>
              <Upload className="h-3 w-3 mr-1" /> Importar planilha
            </Button>
            <Button
              size="sm"
              onClick={() => setModal({ open: true, codigo: "", descricao: null, novo: true })}
            >
              <Plus className="h-3 w-3 mr-1" /> Novo centro
            </Button>
          </div>
        </CardHeader>
        <ImportarPlanoDialog
          open={openImport}
          onOpenChange={setOpenImport}
          kind="centro"
          existingCodigos={new Set((centrosQ.data ?? []).map((c) => c.codigo))}
        />
        <CardContent>
          <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
            <TabsList>
              <TabsTrigger value="todos">Todos ({counts.total})</TabsTrigger>
              <TabsTrigger value="obra">Obras ({counts.obra})</TabsTrigger>
              <TabsTrigger value="indireto">Indiretos ({counts.indireto})</TabsTrigger>
              <TabsTrigger value="nao">Pendentes ({counts.nao})</TabsTrigger>
            </TabsList>
            <TabsContent value={aba} className="mt-4">
              <div className="border rounded-md overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead>No snapshot atual</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => {
                      const obra =
                        l.cadastro?.tipo === "obra"
                          ? (obrasQ.data ?? []).find((o) => o.id === l.cadastro!.obra_id)
                          : null;
                      return (
                        <TableRow key={l.codigo}>
                          <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                          <TableCell className="max-w-[40ch] truncate">
                            {l.descricao ?? "—"}
                          </TableCell>
                          <TableCell>
                            {!l.cadastro ? (
                              <Badge
                                variant="outline"
                                className="text-warning border-warning/50"
                              >
                                Pendente
                              </Badge>
                            ) : l.cadastro.tipo === "obra" ? (
                              <span className="inline-flex items-center gap-1 text-sm">
                                <Building2 className="h-3 w-3" />
                                {obra ? `${obra.codigo} — ${obra.nome}` : "Obra"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm">
                                <Tags className="h-3 w-3" />
                                Indireto: <strong>{l.cadastro.categoria}</strong>
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {l.no_snapshot ? (
                              <Badge variant="secondary">Sim</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setModal({
                                    open: true,
                                    codigo: l.codigo,
                                    descricao: l.descricao,
                                    existing: l.cadastro,
                                  })
                                }
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                {l.cadastro ? "Editar" : "Classificar"}
                              </Button>
                              {l.cadastro && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (await confirmDialog({ title: `Remover cadastro de ${l.codigo}?` }))
                                      delMut.mutate(l.cadastro!.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {linhas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhum centro de custo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {modal.open && (
        <ClassificarModal
          codigo={modal.codigo}
          descricao={modal.descricao}
          existing={modal.existing}
          codigoEditavel={!!modal.novo}
          obras={obrasQ.data ?? []}
          centrosCadastrados={centrosQ.data ?? []}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: centrosKeys.all });
            setModal({ open: false });
          }}
        />
      )}
    </div>
  );
}

import { Kpi as KpiBase } from "@/components/common/Kpi";
function Kpi({ label, valor, tone }: { label: string; valor: number; tone?: "warn" }) {
  return (
    <KpiBase
      label={label}
      value={valor.toLocaleString("pt-BR")}
      tone={tone === "warn" ? "warning" : "default"}
      tabularNums={false}
    />
  );
}

function ClassificarModal({
  codigo,
  descricao,
  existing,
  codigoEditavel,
  obras,
  centrosCadastrados,
  onClose,
  onSaved,
}: {
  codigo: string;
  descricao: string | null;
  existing?: CentroCustoTotvs;
  codigoEditavel?: boolean;
  obras: { id: string; codigo: string | null; nome: string }[];
  centrosCadastrados: CentroCustoTotvs[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"obra" | "indireto">(existing?.tipo ?? "indireto");
  const [obraId, setObraId] = useState<string>(existing?.obra_id ?? "");
  const [categoria, setCategoria] = useState<string>(existing?.categoria ?? "");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [codigoInput, setCodigoInput] = useState(codigo);
  const [descricaoInput, setDescricaoInput] = useState(descricao ?? "");
  const [salvando, setSalvando] = useState(false);

  // categorias existentes (seed + as já cadastradas)
  const categorias = useMemo(() => {
    const s = new Set<string>(CATEGORIAS_INDIRETO_SEED);
    for (const c of centrosCadastrados) if (c.categoria) s.add(c.categoria);
    return Array.from(s).sort();
  }, [centrosCadastrados]);

  async function salvar() {
    setSalvando(true);
    try {
      const cod = codigoInput.trim();
      if (!cod) {
        toast.error("Informe o código.");
        return;
      }
      const desc = descricaoInput.trim() || null;
      if (tipo === "obra") {
        if (!obraId) {
          toast.error("Selecione a obra.");
          return;
        }
        await upsertCentroCustoObra({
          id: existing?.id,
          codigo: cod,
          descricao: desc,
          obra_id: obraId,
        });
      } else {
        const cat = (categoria === "__nova__" ? novaCategoria : categoria).trim();
        if (!cat) {
          toast.error("Informe a categoria.");
          return;
        }
        await upsertCentroCustoIndireto({
          id: existing?.id,
          codigo: cod,
          descricao: desc,
          categoria: cat,
        });
      }
      toast.success("Centro de custo salvo.");
      onSaved();
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing
              ? "Editar centro de custo"
              : codigoEditavel
                ? "Novo centro de custo"
                : "Classificar centro de custo"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {codigoEditavel ? (
            <>
              <div className="space-y-1.5">
                <Label>Código TOTVS</Label>
                <Input
                  placeholder="ex.: 01.001.0010"
                  value={codigoInput}
                  onChange={(e) => setCodigoInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  placeholder="Descrição"
                  value={descricaoInput}
                  onChange={(e) => setDescricaoInput(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <Label className="text-xs">Código</Label>
              <div className="font-mono text-sm">{codigo}</div>
              <div className="text-xs text-muted-foreground">{descricao ?? "—"}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="obra">Obra</SelectItem>
                <SelectItem value="indireto">Indireto (ADM, RH, Frota…)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "obra" ? (
            <div className="space-y-1.5">
              <Label>Obra</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo} — {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value="__nova__">+ Nova categoria…</SelectItem>
                </SelectContent>
              </Select>
              {categoria === "__nova__" && (
                <Input
                  autoFocus
                  placeholder="Nome da categoria"
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CentrosCustoPage;
