import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Upload } from "lucide-react";
import ImportarPlanoDialog from "@/components/financeiro/ImportarPlanoDialog";
import { planoContasRepo } from "@/lib/repositories/financeiro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Natureza = {
  cod_natureza: string;
  descricao: string;
  nivel: number;
  cod_pai: string | null;
  grupo: string;
  subgrupo: string | null;
  ativo: boolean;
};

function norm(s: string) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function FinNaturezas() {
  const qc = useQueryClient();
  const { data: naturezas } = useQuery({
    queryKey: ["plano_contas"],
    queryFn: async (): Promise<Natureza[]> => {
      return ((await planoContasRepo.list()) ?? []) as Natureza[];
    },
  });

  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openCreate, setOpenCreate] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [createPai, setCreatePai] = useState<Natureza | null>(null);
  const [editing, setEditing] = useState<Natureza | null>(null);
  const [deleting, setDeleting] = useState<Natureza | null>(null);

  const filtradas = useMemo(() => {
    const all = naturezas ?? [];
    if (!q.trim()) return all;
    const qn = norm(q);
    const matches = new Set<string>();
    for (const n of all) {
      if (norm(n.cod_natureza).includes(qn) || norm(n.descricao).includes(qn)) {
        matches.add(n.cod_natureza);
        // Mantém ancestrais visíveis
        let pai = n.cod_pai;
        while (pai) {
          matches.add(pai);
          const p = all.find((x) => x.cod_natureza === pai);
          pai = p?.cod_pai ?? null;
        }
      }
    }
    return all.filter((n) => matches.has(n.cod_natureza));
  }, [naturezas, q]);

  const visiveis = useMemo(() => {
    return filtradas.filter((n) => {
      let pai = n.cod_pai;
      while (pai) {
        if (collapsed.has(pai)) return false;
        const p = (naturezas ?? []).find((x) => x.cod_natureza === pai);
        pai = p?.cod_pai ?? null;
      }
      return true;
    });
  }, [filtradas, collapsed, naturezas]);

  const filhosPorPai = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of naturezas ?? []) {
      if (n.cod_pai) m.set(n.cod_pai, (m.get(n.cod_pai) ?? 0) + 1);
    }
    return m;
  }, [naturezas]);

  function toggle(cod: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(cod)) n.delete(cod);
      else n.add(cod);
      return n;
    });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Naturezas orçamentárias</h1>
          <p className="text-sm text-muted-foreground">
            Plano de contas usado para classificar lançamentos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenImport(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <Button
            onClick={() => {
              setCreatePai(null);
              setOpenCreate(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Nova natureza
          </Button>
        </div>
      </header>

      <ImportarPlanoDialog
        open={openImport}
        onOpenChange={setOpenImport}
        kind="natureza"
        existingCodigos={new Set((naturezas ?? []).map((n) => n.cod_natureza))}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-3 flex-wrap">
            <span>{(naturezas ?? []).length} naturezas</span>
            <Input
              placeholder="Buscar por código ou descrição…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 max-w-sm"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">Código / Descrição</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((n) => {
                const temFilhos = (filhosPorPai.get(n.cod_natureza) ?? 0) > 0;
                const indent = (n.nivel - 1) * 20;
                const isCollapsed = collapsed.has(n.cod_natureza);
                return (
                  <TableRow key={n.cod_natureza} className={!n.ativo ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="flex items-center" style={{ paddingLeft: indent }}>
                        {temFilhos ? (
                          <button
                            onClick={() => toggle(n.cod_natureza)}
                            className="mr-1 p-0.5 hover:bg-muted rounded"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <span
                          className={`font-mono text-xs mr-2 ${n.nivel === 1 ? "font-semibold" : ""}`}
                        >
                          {n.cod_natureza}
                        </span>
                        <span className={n.nivel <= 2 ? "font-medium" : ""}>{n.descricao}</span>
                        {!n.ativo && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            inativa
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">N{n.nivel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={n.ativo}
                        onCheckedChange={async (v) => {
                          try {
                            await planoContasRepo.setAtivo(n.cod_natureza, v);
                            qc.invalidateQueries({ queryKey: ["plano_contas"] });
                          } catch (err: any) {
                            toast.error(err?.message ?? "Falha");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {n.nivel < 3 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCreatePai(n);
                            setOpenCreate(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(n)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleting(n)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma natureza encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NaturezaFormDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        pai={createPai}
        todas={naturezas ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["plano_contas"] });
        }}
      />
      <NaturezaFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        editing={editing}
        todas={naturezas ?? []}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["plano_contas"] });
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir natureza?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deleting?.cod_natureza}</strong> — {deleting?.descricao}? Se houver
              rateios usando esta natureza, prefira inativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await planoContasRepo.remove(deleting.cod_natureza);
                } catch (err: any) {
                  return toast.error(err?.message ?? "Falha");
                }
                toast.success("Natureza excluída");
                setDeleting(null);
                qc.invalidateQueries({ queryKey: ["plano_contas"] });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NaturezaFormDialog({
  open,
  onClose,
  pai,
  editing,
  todas,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  pai?: Natureza | null;
  editing?: Natureza | null;
  todas: Natureza[];
  onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [cod, setCod] = useState("");
  const [desc, setDesc] = useState("");
  const [paiCod, setPaiCod] = useState<string>("");

  // reset on open
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setCod(editing.cod_natureza);
      setDesc(editing.descricao);
      setPaiCod(editing.cod_pai ?? "");
    } else {
      setCod("");
      setDesc("");
      setPaiCod(pai?.cod_natureza ?? "");
    }
  }, [open]);

  const paisDisponiveis = todas.filter((n) => n.nivel < 3);

  async function salvar() {
    if (!cod.trim() || !desc.trim()) return toast.error("Preencha código e descrição.");
    const codTrim = cod.trim();
    const partes = codTrim.split(".");
    const nivel = partes.length;
    if (nivel < 1 || nivel > 3)
      return toast.error("Código deve seguir o padrão N, N.NN ou N.NN.NNN.");
    const grupo = partes[0];
    const subgrupo = nivel >= 2 ? `${partes[0]}.${partes[1]}` : null;
    const codPai = nivel === 1 ? null : nivel === 2 ? grupo : subgrupo;

    try {
      if (isEdit && editing) {
        await planoContasRepo.updateDescricao(editing.cod_natureza, desc.trim());
        toast.success("Natureza atualizada");
      } else {
        await planoContasRepo.create({
          cod_natureza: codTrim,
          descricao: desc.trim(),
          nivel,
          cod_pai: codPai,
          grupo,
          subgrupo,
          ativo: true,
        });
        toast.success("Natureza criada");
      }
    } catch (err: any) {
      return toast.error(err?.message ?? "Falha");
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar natureza" : "Nova natureza"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Pai (opcional)</Label>
              <Select
                value={paiCod || "__none__"}
                onValueChange={(v) => setPaiCod(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pai (grupo raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem pai (grupo raiz)</SelectItem>
                  {paisDisponiveis.map((p) => (
                    <SelectItem key={p.cod_natureza} value={p.cod_natureza}>
                      {p.cod_natureza} — {p.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Código</Label>
            <Input
              value={cod}
              onChange={(e) => setCod(e.target.value)}
              placeholder="ex.: 2.01.040"
              disabled={isEdit}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{isEdit ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
