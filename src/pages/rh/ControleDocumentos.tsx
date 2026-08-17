import React, { useState, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useDocumentosContext } from "@/contexts/DocumentosContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, AlertTriangle, Settings, FileText } from "lucide-react";
import DeleteConfirmDialog from "@/components/common/DeleteConfirmDialog";
import EmployeeProfileDialog from "@/components/rh/EmployeeProfileDialog";
import { fmtDataLocal } from "@/lib/core/date";
import {
  useDeleteDocumentoTipo,
  useDocumentoTipos,
  useSaveDocumentoTipo,
} from "@/hooks/rh/useDocumentoTipos";
import type { DocumentoTipo } from "@/types";

type Tab = "vencer" | "config";
type StatusFilter = "todos" | "vencido" | "avencer" | "ok";

const ControleDocumentos = () => {
  const { hasAccess } = usePermissions();
  const { getAllExpiringDocuments } = useDocumentosContext();
  const { data: documentosTipo = [] } = useDocumentoTipos();
  const saveDocumentoTipo = useSaveDocumentoTipo();
  const deleteDocumentoTipo = useDeleteDocumentoTipo();
  const canEdit = hasAccess("rh", "editar");

  const [tab, setTab] = useState<Tab>("vencer");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formVencDias, setFormVencDias] = useState("365");
  const [formAvisoDias, setFormAvisoDias] = useState("7");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("todos");
  const [profileColabId, setProfileColabId] = useState<string | null>(null);

  const allDocs = useMemo(() => getAllExpiringDocuments(), [getAllExpiringDocuments]);

  const getDocStatus = (dataVencimento: string, docNome: string) => {
    const now = new Date();
    const dv = new Date(dataVencimento);
    const daysLeft = Math.ceil((dv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const docTipo = documentosTipo.find((dt) => dt.nome === docNome);
    const warningDays = docTipo ? docTipo.avisoDias : 7;
    if (dv <= now) return "vencido";
    if (daysLeft <= warningDays) return "avencer";
    return "ok";
  };

  const filteredDocs = useMemo(() => {
    return allDocs.filter((item) => {
      if (filterTipo !== "todos" && item.documento.nome !== filterTipo) return false;
      if (
        filterStatus !== "todos" &&
        getDocStatus(item.documento.dataVencimento, item.documento.nome) !== filterStatus
      )
        return false;
      return true;
    });
  }, [allDocs, filterTipo, filterStatus, documentosTipo]);

  const uniqueDocNames = useMemo(() => {
    const names = new Set(allDocs.map((d) => d.documento.nome));
    return Array.from(names).sort();
  }, [allDocs]);

  const openAdd = () => {
    setEditId(null);
    setFormNome("");
    setFormVencDias("365");
    setFormAvisoDias("7");
    setFormOpen(true);
  };

  const openEdit = (dt: DocumentoTipo) => {
    setEditId(dt.id);
    setFormNome(dt.nome);
    setFormVencDias(String(dt.vencimentoDias));
    setFormAvisoDias(String(dt.avisoDias));
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!formNome) return;
    const data = {
      nome: formNome,
      vencimentoDias: parseInt(formVencDias) || 365,
      avisoDias: parseInt(formAvisoDias) || 7,
    };
    if (editId) {
      saveDocumentoTipo.mutate({ id: editId, payload: data });
    } else {
      saveDocumentoTipo.mutate({ payload: data });
    }
    setFormOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Controle de Documentos
        </h2>
        {tab === "config" && canEdit && (
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {/* Switch tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("vencer")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "vencer"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Documentos a vencer
        </button>
        <button
          onClick={() => setTab("config")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "config"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-3.5 w-3.5" /> Configurações
        </button>
      </div>

      {tab === "vencer" && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Documento:</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {uniqueDocNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => setFilterStatus(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="avencer">A vencer</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div
            className="border border-border rounded-lg overflow-auto"
            style={{ maxHeight: "calc(100vh - 310px)" }}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0 z-10">
                  <TableHead className="w-[80px]">Matrícula</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="w-[140px]">Vencimento</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum documento encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {filteredDocs.map((item, i) => {
                  const status = getDocStatus(item.documento.dataVencimento, item.documento.nome);
                  const dv = new Date(item.documento.dataVencimento);
                  const now = new Date();
                  const daysLeft = Math.ceil(
                    (dv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                  );

                  return (
                    <TableRow
                      key={i}
                      className={`${canEdit ? "cursor-pointer" : ""} ${
                        status === "vencido"
                          ? "bg-destructive/5"
                          : status === "avencer"
                            ? "bg-warning/5"
                            : ""
                      }`}
                      onClick={() => canEdit && setProfileColabId(item.colaborador.id)}
                    >
                      <TableCell>
                        <div className="matricula-badge">
                          {item.colaborador.matricula.padStart(4, "0")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.colaborador.nome}</TableCell>
                      <TableCell>{item.documento.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDataLocal(dv)}
                      </TableCell>
                      <TableCell>
                        {status === "vencido" ? (
                          <span className="text-xs font-semibold text-destructive">Vencido</span>
                        ) : status === "avencer" ? (
                          <span className="text-xs font-semibold text-warning">
                            {daysLeft}d restantes
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div
          className="border border-border rounded-lg overflow-auto"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 sticky top-0 z-10">
                <TableHead>Documento</TableHead>
                <TableHead className="w-[180px]">Vencimento</TableHead>
                <TableHead className="w-[180px]">Aviso de Vencimento</TableHead>
                {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentosTipo.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 4 : 3}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum documento cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {documentosTipo.map((dt) => (
                <TableRow key={dt.id}>
                  <TableCell className="font-medium">{dt.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dt.vencimentoDias} {dt.vencimentoDias === 1 ? "dia" : "dias"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dt.avisoDias} {dt.avisoDias === 1 ? "dia" : "dias"} antes
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(dt)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setDeleteTarget({ id: dt.id, nome: dt.nome })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editId ? "Editar Documento" : "Adicionar Documento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Documento</Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="mt-1"
                placeholder="Ex: ASO, NR-10, CNH..."
              />
            </div>
            <div>
              <Label className="text-xs">Vencimento (dias)</Label>
              <Input
                type="number"
                value={formVencDias}
                onChange={(e) => setFormVencDias(e.target.value)}
                className="mt-1"
                min="1"
                placeholder="365"
              />
            </div>
            <div>
              <Label className="text-xs">Aviso de Vencimento (dias antes)</Label>
              <Input
                type="number"
                value={formAvisoDias}
                onChange={(e) => setFormAvisoDias(e.target.value)}
                className="mt-1"
                min="1"
                placeholder="7"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formNome}>
              {editId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteDocumentoTipo.mutate(deleteTarget.id)}
        title="Excluir Documento"
        description={`Deseja realmente excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
      />

      <EmployeeProfileDialog
        open={!!profileColabId}
        onClose={() => setProfileColabId(null)}
        colaboradorId={profileColabId}
        defaultTab="documentos"
      />
    </div>
  );
};

export default ControleDocumentos;
