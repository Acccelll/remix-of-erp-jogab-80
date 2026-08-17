import React, { useState, useMemo, useRef } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useColaboradoresContext } from "@/contexts/ColaboradoresContext";
import { useVeiculosContext } from "@/contexts/VeiculosContext";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VeiculoTiposTab from "@/components/frotas/VeiculoTiposTab";
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
  Car,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import VeiculoProfileDialog from "@/components/frotas/VeiculoProfileDialog";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { TipoVeiculo } from "@/types";
import { TIPOS_VEICULO } from "@/lib/frotas/tipos";
import { motoristasElegiveis } from "@/lib/frotas/alocacao";
import { validateVeiculo } from "@/lib/schemas/veiculo";

type SortField = "codigo" | "nome" | "tipo" | "obra" | "motorista" | "condicao";
type SortDir = "asc" | "desc" | null;

const Veiculos = () => {
  const { veiculos, addVeiculo, updateVeiculo, deleteVeiculo } = useVeiculosContext();
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const { colaboradores } = useColaboradoresContext();
  const canEdit = hasAccess("frotas", "editar");
  const motoristas = motoristasElegiveis(colaboradores);
  const isGM = currentPlayer?.isGM;
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [abaVeiculos, setAbaVeiculos] = useState<"veiculos" | "tipos">("veiculos");
  const [formOpen, setFormOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  const [formCodigo, setFormCodigo] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formTipo, setFormTipo] = useState<TipoVeiculo>("Utilitário");

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const getObraDisplay = (v: { obraAtualId: string | null; motoristaId?: string | null }) => {
    // Prioridade: obra do motorista vinculado (Quadro de Obras)
    if (v.motoristaId) {
      const colab = colaboradores.find((c) => c.id === v.motoristaId);
      if (colab) {
        const obraNome = colab.obraAtualId
          ? obras.find((o) => o.id === colab.obraAtualId)?.nome || ""
          : "";
        return { obra: obraNome, responsavel: colab.nome };
      }
    }
    const obraId = v.obraAtualId;
    if (!obraId) return { obra: "", responsavel: "" };
    if (obraId.startsWith("__resp_v__") || obraId.startsWith("__resp__")) {
      const colabId = obraId.replace("__resp_v__", "").replace("__resp__", "");
      const colab = colaboradores.find((c) => c.id === colabId);
      const obraNome = colab?.obraAtualId
        ? obras.find((o) => o.id === colab.obraAtualId)?.nome
        : "";
      return { obra: obraNome || "", responsavel: colab?.nome || "" };
    }
    const specialNames: Record<string, string> = {
      __manutencao__: "Em Manutenção",
      __sujo__: "Sujo",
    };
    if (specialNames[obraId]) return { obra: specialNames[obraId], responsavel: "" };
    return { obra: obras.find((o) => o.id === obraId)?.nome || "", responsavel: "" };
  };

  const getObraNome = (v: { obraAtualId: string | null; motoristaId?: string | null }) => {
    const d = getObraDisplay(v);
    return d.obra;
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
    let list = veiculos.filter((v) => {
      if (!showInactive && !v.ativo) return false;
      if (showInactive && v.ativo) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          v.nome.toLowerCase().includes(s) ||
          v.codigo.includes(search) ||
          v.tipo.toLowerCase().includes(s)
        );
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
          case "tipo":
            va = a.tipo;
            vb = b.tipo;
            break;
          case "obra":
            va = getObraNome(a);
            vb = getObraNome(b);
            break;
          case "motorista": {
            const ma = a.motoristaId
              ? colaboradores.find((c) => c.id === a.motoristaId)?.nome || ""
              : "";
            const mb = b.motoristaId
              ? colaboradores.find((c) => c.id === b.motoristaId)?.nome || ""
              : "";
            va = ma;
            vb = mb;
            break;
          }
          case "condicao": {
            const ca =
              (a.manutencao ?? a.quebrado)
                ? "manutencao"
                : a.riscado
                  ? "riscado"
                  : a.sujo
                    ? "sujo"
                    : "ok";
            const cb =
              (b.manutencao ?? b.quebrado)
                ? "manutencao"
                : b.riscado
                  ? "riscado"
                  : b.sujo
                    ? "sujo"
                    : "ok";
            va = ca;
            vb = cb;
            break;
          }
        }
        const cmp = va.localeCompare(vb, "pt-BR");
        return sortDir === "desc" ? -cmp : cmp;
      });
    }
    return list;
  }, [veiculos, showInactive, search, sortField, sortDir, obras]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    if (sortDir === "asc") return <ArrowUp className="h-3 w-3 ml-1" />;
    return <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const validation = validateVeiculo({ codigo: formCodigo, nome: formNome, tipo: formTipo });
    if (!validation.ok) {
      toast.error(Object.values(validation.errors)[0] ?? "Verifique os campos do veículo.");
      return;
    }
    addVeiculo({
      codigo: formCodigo,
      nome: formNome,
      tipo: formTipo,
      ativo: true,
      obraAtualId: null,
      riscado: false,
      quebrado: false,
      manutencao: false,
      sujo: false,
      alugado: false,
      motoristaId: null,
    });
    setFormOpen(false);
    setFormCodigo("");
    setFormNome("");
    setFormTipo("Utilitário");
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
          const codigo = String(row["Placa"] || row["Código"] || row["Codigo"] || "")
            .toUpperCase()
            .slice(0, 7);
          const nome = String(row["Nome"] || "").trim();
          const tipo = String(row["Tipo"] || "Utilitário").trim() as TipoVeiculo;
          const normalizedTipo = TIPOS_VEICULO.includes(tipo) ? tipo : "Utilitário";
          if (!validateVeiculo({ codigo, nome, tipo: normalizedTipo }).ok) return;

          const exists = veiculos.some((v) => v.codigo === codigo);
          if (exists) {
            skipped++;
            return;
          }

          addVeiculo({
            codigo,
            nome,
            tipo: normalizedTipo,
            ativo: true,
            obraAtualId: null,
            riscado: false,
            quebrado: false,
            manutencao: false,
            sujo: false,
            alugado: false,
            motoristaId: null,
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
    const data = veiculos.map((v) => {
      const motorista = v.motoristaId
        ? colaboradores.find((c) => c.id === v.motoristaId)?.nome || ""
        : "";
      const emManut = v.manutencao ?? v.quebrado;
      return {
        Placa: v.codigo,
        Nome: v.nome,
        Tipo: v.tipo,
        "Obra Atual": getObraNome(v) || "—",
        Motorista: motorista || "—",
        Ativo: v.ativo ? "Sim" : "Não",
        Riscado: v.riscado ? "Sim" : "Não",
        "Em Manutenção": emManut ? "Sim" : "Não",
        Sujo: v.sujo ? "Sim" : "Não",
        Alugado: v.alugado ? "Sim" : "Não",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Veículos");
    XLSX.writeFile(wb, "veiculos.xlsx");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Car className="h-6 w-6" /> {abaVeiculos === "tipos" ? "Tipos de Veículo" : "Veículos"}
        </h2>
        <Tabs
          value={abaVeiculos}
          onValueChange={(v) => setAbaVeiculos(v as "veiculos" | "tipos")}
        >
          <TabsList>
            <TabsTrigger value="veiculos">Veículos</TabsTrigger>
            <TabsTrigger value="tipos">Tipos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {abaVeiculos === "tipos" ? (
        <VeiculoTiposTab canEdit={canEdit} />
      ) : (
        <>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="inativos-veic" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos-veic" className="text-sm">
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
                setFormTipo("Utilitário");
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
          placeholder="Buscar por nome, placa ou tipo..."
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
                className="w-[90px] cursor-pointer select-none"
                onClick={() => handleSort("codigo")}
              >
                <span className="flex items-center">
                  Placa <SortIcon field="codigo" />
                </span>
              </TableHead>
              <TableHead
                className="w-[200px] cursor-pointer select-none"
                onClick={() => handleSort("nome")}
              >
                <span className="flex items-center">
                  Nome <SortIcon field="nome" />
                </span>
              </TableHead>
              <TableHead
                className="w-[130px] cursor-pointer select-none"
                onClick={() => handleSort("tipo")}
              >
                <span className="flex items-center">
                  Tipo <SortIcon field="tipo" />
                </span>
              </TableHead>
              <TableHead
                className="w-[160px] cursor-pointer select-none"
                onClick={() => handleSort("obra")}
              >
                <span className="flex items-center">
                  Obra <SortIcon field="obra" />
                </span>
              </TableHead>
              <TableHead
                className="w-[260px] cursor-pointer select-none"
                onClick={() => handleSort("motorista")}
              >
                <span className="flex items-center">
                  Motorista <SortIcon field="motorista" />
                </span>
              </TableHead>
              <TableHead
                className="w-[140px] cursor-pointer select-none"
                onClick={() => handleSort("condicao")}
              >
                <span className="flex items-center">
                  Condição <SortIcon field="condicao" />
                </span>
              </TableHead>
              {canEdit && <TableHead className="w-[80px]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum veículo encontrado.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v) => {
              const obraNome = getObraNome(v);
              return (
                <ContextMenu key={v.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className={canEdit ? "cursor-pointer" : ""}
                      onClick={() => {
                        if (!canEdit) return;
                        setSelectedId(v.id);
                        setProfileOpen(true);
                      }}
                    >
                      <TableCell>
                        <span className="matricula-badge">{v.codigo}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <span className="flex items-center gap-1.5">
                            {v.nome}
                            {v.alugado && (
                              <Badge className="text-[10px] bg-warning/15 text-warning border-warning/40 hover:bg-warning/15">
                                Alugado
                              </Badge>
                            )}
                            {!v.ativo && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                Inativo
                              </Badge>
                            )}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{v.tipo}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {v.tipo}
                        </Badge>
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={v.motoristaId || "__none__"}
                          onValueChange={(val) =>
                            canEdit &&
                            updateVeiculo(v.id, { motoristaId: val === "__none__" ? null : val })
                          }
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhum</SelectItem>
                            {motoristas.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {v.riscado && (
                            <Badge variant="outline" className="text-[10px]">
                              Riscado
                            </Badge>
                          )}
                          {(v.manutencao ?? v.quebrado) && (
                            <Badge variant="destructive" className="text-[10px]">
                              Em Manutenção
                            </Badge>
                          )}
                          {v.sujo && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-warning/15 text-warning border-warning/40"
                            >
                              Sujo
                            </Badge>
                          )}
                          {!v.riscado && !(v.manutencao ?? v.quebrado) && !v.sujo && (
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
                              updateVeiculo(v.id, { ativo: !v.ativo });
                            }}
                          >
                            {v.ativo ? "Inativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  </ContextMenuTrigger>
                  {isGM && (
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget({ id: v.id, nome: v.nome })}
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

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar Veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Placa (até 7 caracteres)</Label>
              <Input
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value.toUpperCase().slice(0, 7))}
                className="mt-1"
                maxLength={7}
                placeholder="ABC1D23"
              />
            </div>
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="mt-1"
                placeholder="Nome do veículo"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={formTipo} onValueChange={(v) => setFormTipo(v as TipoVeiculo)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_VEICULO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <VeiculoProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        veiculoId={selectedId}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteVeiculo(deleteTarget.id)}
        title="Excluir Veículo"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />
        </>
      )}
    </div>
  );
};

export default Veiculos;
