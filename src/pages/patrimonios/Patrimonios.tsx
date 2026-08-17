import React, { useState, useMemo, useRef } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Upload,
  Download,
  Archive,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import PatrimonioProfileDialog from "@/components/patrimonios/PatrimonioProfileDialog";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { validatePatrimonio } from "@/lib/schemas/patrimonio";

type SortField = "codigo" | "nome" | "obra";
type SortDir = "asc" | "desc" | null;

const Patrimonios = () => {
  const {
    patrimonios,
    addPatrimonio,
    updatePatrimonio,
    deletePatrimonio,
    responsabilidadesPatrimonios,
  } = usePatrimoniosContext();
  const { colaboradores } = useColaboradoresContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const canEdit = hasAccess("patrimonios", "editar");
  const isGM = currentPlayer?.isGM;
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  // Form state
  const [formCodigo, setFormCodigo] = useState("");
  const [formNome, setFormNome] = useState("");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const getObraNome = (obraId: string | null) => {
    if (!obraId) return "";
    return obras.find((o) => o.id === obraId)?.nome || "";
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortField(null);
        setSortDir(null);
      } else setSortDir("asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = patrimonios.filter((p) => {
      if (!showInactive && !p.ativo) return false;
      if (showInactive && p.ativo) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.nome.toLowerCase().includes(s) || p.codigo.includes(search);
      }
      return true;
    });
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va = "",
          vb = "";
        switch (sortField) {
          case "codigo":
            va = a.codigo;
            vb = b.codigo;
            break;
          case "nome":
            va = a.nome;
            vb = b.nome;
            break;
          case "obra":
            va = getObraNome(a.obraAtualId);
            vb = getObraNome(b.obraAtualId);
            break;
        }
        const cmp = va.localeCompare(vb, "pt-BR");
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return list;
  }, [patrimonios, showInactive, search, sortField, sortDir, obras]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const validation = validatePatrimonio({ codigo: formCodigo, nome: formNome });
    if (!validation.ok) {
      toast.error(Object.values(validation.errors)[0] ?? "Verifique os campos do patrimônio.");
      return;
    }
    addPatrimonio({
      codigo: formCodigo,
      nome: formNome,
      ativo: true,
      obraAtualId: null,
      riscado: false,
      quebrado: false,
      alugado: false,
    });
    setFormOpen(false);
    setFormCodigo("");
    setFormNome("");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        let added = 0,
          skipped = 0;
        rows.forEach((row) => {
          const codigo = String(row["Código"] || row["Codigo"] || "")
            .replace(/\D/g, "")
            .slice(0, 6);
          const nome = String(row["Nome"] || "").trim();
          if (!validatePatrimonio({ codigo, nome }).ok) return;

          const exists = patrimonios.some((p) => p.codigo === codigo);
          if (exists) {
            skipped++;
            return;
          }

          addPatrimonio({
            codigo,
            nome,
            ativo: true,
            obraAtualId: null,
            riscado: false,
            quebrado: false,
            alugado: false,
          });
          added++;
        });

        toast.success(
          `Importação concluída: ${added} adicionados, ${skipped} duplicados ignorados.`,
        );
      } catch {
        toast.error("Erro ao processar o arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const data = patrimonios.map((p) => ({
      Código: p.codigo,
      Nome: p.nome,
      "Obra Atual": getObraNome(p.obraAtualId) || "—",
      Ativo: p.ativo ? "Sim" : "Não",
      Riscado: p.riscado ? "Sim" : "Não",
      Quebrado: p.quebrado ? "Sim" : "Não",
      Alugado: p.alugado ? "Sim" : "Não",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Patrimônios");
    XLSX.writeFile(wb, "patrimonios.xlsx");
  };

  const handleExportResponsaveis = () => {
    const hoje = new Date().toISOString().split("T")[0];
    const ativos = responsabilidadesPatrimonios.filter(
      (r) => r.dataInicio <= hoje && (r.dataFim === null || r.dataFim >= hoje),
    );
    const rows = ativos
      .map((r) => {
        const p = patrimonios.find((x) => x.id === r.patrimonioId);
        const c = colaboradores.find((x) => x.id === r.colaboradorId);
        return {
          Responsável: c?.nome || r.colaboradorId,
          Código: p?.codigo || "",
          Nome: p?.nome || "",
          "Data Início": r.dataInicio,
          "Data Fim": r.dataFim || "em aberto",
          "Obra do Responsável": obras.find((o) => o.id === c?.obraAtualId)?.nome || "—",
        };
      })
      .sort((a, b) => String(a["Responsável"]).localeCompare(String(b["Responsável"]), "pt-BR"));
    if (rows.length === 0) {
      toast.error("Não há responsabilidades ativas.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responsabilidades");
    XLSX.writeFile(wb, `responsabilidades_patrimonios_${hoje}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Archive className="h-6 w-6" /> Patrimônios
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="inativos-pat" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos-pat" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportResponsaveis}>
            <Download className="h-4 w-4 mr-1" /> Responsáveis
          </Button>
          {isGM && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Importar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
            </>
          )}
          {canEdit && (
            <Button
              onClick={() => {
                setFormCodigo("");
                setFormNome("");
                setFormOpen(true);
              }}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="pl-9"
        />
      </div>

      <div
        className="border border-border rounded-lg overflow-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead
                className="w-[100px] cursor-pointer select-none"
                onClick={() => handleSort("codigo")}
              >
                <span className="flex items-center">
                  Código <SortIcon field="codigo" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("nome")}>
                <span className="flex items-center">
                  Nome <SortIcon field="nome" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("obra")}>
                <span className="flex items-center">
                  Obra <SortIcon field="obra" />
                </span>
              </TableHead>
              <TableHead className="w-[150px]">Condição</TableHead>
              {canEdit && <TableHead className="w-[80px]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 5 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum patrimônio encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const obraNome = getObraNome(p.obraAtualId);
              return (
                <ContextMenu key={p.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={canEdit ? "cursor-pointer" : ""}
                      onClick={() => {
                        if (!canEdit) return;
                        setSelectedId(p.id);
                        setProfileOpen(true);
                      }}
                    >
                      <TableCell>
                        <span className="matricula-badge">{p.codigo}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {p.nome}
                          {p.alugado && (
                            <Badge className="text-[10px] bg-warning/15 text-warning border-warning/40 hover:bg-warning/15">
                              Alugado
                            </Badge>
                          )}
                          {!p.ativo && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Inativo
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {obraNome ? (
                          <Badge variant="secondary" className="text-xs">
                            {obraNome}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {p.riscado && (
                            <Badge variant="outline" className="text-[10px]">
                              Riscado
                            </Badge>
                          )}
                          {p.quebrado && (
                            <Badge variant="destructive" className="text-[10px]">
                              Quebrado
                            </Badge>
                          )}
                          {!p.riscado && !p.quebrado && (
                            <span className="text-xs text-muted-foreground">OK</span>
                          )}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePatrimonio(p.id, { ativo: !p.ativo });
                            }}
                          >
                            {p.ativo ? "Inativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  </ContextMenuTrigger>
                  {isGM && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget({ id: p.id, nome: p.nome })}
                      >
                        Excluir
                      </ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Patrimônio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Código (até 6 dígitos)</Label>
              <Input
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1"
                maxLength={6}
                placeholder="000001"
              />
            </div>
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="mt-1"
                placeholder="Nome do patrimônio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!formCodigo || !formNome}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PatrimonioProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        patrimonioId={selectedId}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deletePatrimonio(deleteTarget.id)}
        title="Excluir Patrimônio"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />
    </div>
  );
};

export default Patrimonios;
