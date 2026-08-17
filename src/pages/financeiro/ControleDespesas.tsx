import React, { useState, useEffect, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { useObrasContext } from "@/contexts/ObrasContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Receipt, Pencil, Eye, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useDespesas, useSaveDespesa, type Despesa } from "@/hooks/financeiro/useDespesas";
import { formatBRLInput, parseBRL, formatBRLFromNumber } from "@/lib/core/currency";
import ObrasFilter from "@/components/common/ObrasFilter";
import { PaginationControls } from "@/components/common/PaginationControls";
import { toast } from "sonner";
import { fmtDataLocal } from "@/lib/core/date";
import { formatBRL } from "@/lib/core/currency";

type SortField = "data" | "responsavel" | "descricao" | "fornecedor" | "valor" | "parcelas";
type SortDir = "asc" | "desc" | null;

const ControleDespesas = () => {
  const { hasAccess, currentPlayer } = usePermissions();
  const { obras } = useObrasContext();
  const canEdit = hasAccess("financeiro", "compras");
  const { data: despesas = [] } = useDespesas();
  const saveDespesa = useSaveDespesa();

  const [search, setSearch] = useState("");
  const [obrasSelecionadas, setObrasSelecionadas] = useState<Set<string>>(new Set());
  const [obrasFilterInit, setObrasFilterInit] = useState(false);
  const [dataFrom, setDataFrom] = useState("");
  const [dataTo, setDataTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Despesa | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Form
  const [dataCompra, setDataCompra] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [referencia, setReferencia] = useState("");
  const [obsLivre, setObsLivre] = useState("");

  // Inicializa seleção com todas as obras ativas + "sem obra"
  useEffect(() => {
    if (!obrasFilterInit && obras.length > 0) {
      setObrasSelecionadas(new Set([...obras.filter((o) => o.ativa).map((o) => o.id), "sem"]));
      setObrasFilterInit(true);
    }
  }, [obras, obrasFilterInit]);

  const filtered = useMemo(() => {
    let list = despesas;
    list = list.filter((d) => obrasSelecionadas.has(d.obra_id || "sem"));
    if (dataFrom) list = list.filter((d) => d.data && d.data >= dataFrom);
    if (dataTo) list = list.filter((d) => d.data && d.data <= dataTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.descricao.toLowerCase().includes(q) ||
          (d.responsavel || "").toLowerCase().includes(q) ||
          (d.fornecedor || "").toLowerCase().includes(q),
      );
    }
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va: any = (a as any)[sortField],
          vb: any = (b as any)[sortField];
        if (typeof va === "string") {
          va = va.toLowerCase();
          vb = (vb || "").toLowerCase();
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [despesas, search, obrasSelecionadas, dataFrom, dataTo, sortField, sortDir]);

  const totalValor = useMemo(() => filtered.reduce((s, d) => s + d.valor, 0), [filtered]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, obrasSelecionadas, dataFrom, dataTo, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"));
      if (sortDir === "desc") setSortField(null);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1" />
    );
  };

  const getObraNome = (id: string | null) =>
    id ? obras.find((o) => o.id === id)?.nome || id : "—";

  const openAdd = () => {
    setEditing(null);
    setViewOnly(false);
    setDataCompra(new Date().toISOString().slice(0, 10));
    setResponsavel("");
    setDescricao("");
    setCentroCustoId("");
    setFornecedor("");
    setValor("");
    setReferencia("");
    setObsLivre("");
    setFormOpen(true);
  };

  const openEdit = (d: Despesa, readOnly = false) => {
    setEditing(d);
    setViewOnly(readOnly);
    setDataCompra(d.data || "");
    setResponsavel(d.responsavel || "");
    setDescricao(d.descricao);
    setCentroCustoId(d.obra_id || "");
    setFornecedor(d.fornecedor || "");
    setValor(formatBRLFromNumber(d.valor));
    setReferencia(d.referencia || "");
    setObsLivre(d.observacao || "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!descricao || !valor || !responsavel) return;

    const payload = {
      descricao,
      valor: parseBRL(valor),
      data: dataCompra || new Date().toISOString().slice(0, 10),
      categoria: "Despesa Geral",
      forma_pagamento_id: null,
      obra_id: centroCustoId || null,
      colaborador_id: null,
      responsavel,
      fornecedor: fornecedor || null,
      referencia: referencia || null,
      observacao: obsLivre || null,
      status: "pendente",
    };

    if (editing) {
      await saveDespesa.mutateAsync({ id: editing.id, payload });
      toast.success("Despesa atualizada");
    } else {
      await saveDespesa.mutateAsync({ payload });
      toast.success("Despesa adicionada");
    }
    setFormOpen(false);
  };

  if (!hasAccess("financeiro", "visualizar")) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sem acesso ao módulo Financeiro.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" /> Controle de Despesas
        </h2>
        {canEdit && (
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova Despesa
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ObrasFilter
          obras={obras.filter((o) => o.ativa).map((o) => ({ id: o.id, nome: o.nome }))}
          selected={obrasSelecionadas}
          onChange={setObrasSelecionadas}
        />
        <div className="flex items-center gap-1 ml-auto">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Data de</Label>
          <DatePickerField
            value={dataFrom}
            onChange={(v) => setDataFrom(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">até</Label>
          <DatePickerField
            value={dataTo}
            onChange={(v) => setDataTo(v)}
            className="w-[140px]"
            inputClassName="h-9 text-xs"
          />
          {(dataFrom || dataTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDataFrom("");
                setDataTo("");
              }}
              className="h-9 px-2 text-xs"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(totalValor)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Filtro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {obrasSelecionadas.size >= obras.filter((o) => o.ativa).length + 1
                ? "Todas as Obras"
                : `${obrasSelecionadas.size} obra${obrasSelecionadas.size === 1 ? "" : "s"}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div
        className="border border-border rounded-lg overflow-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead className="cursor-pointer" onClick={() => toggleSort("data")}>
                Data <SortIcon field="data" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("responsavel")}>
                Responsável <SortIcon field="responsavel" />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("descricao")}>
                Descrição <SortIcon field="descricao" />
              </TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("fornecedor")}>
                Fornecedor <SortIcon field="fornecedor" />
              </TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("valor")}>
                Valor <SortIcon field="valor" />
              </TableHead>
              {canEdit && <TableHead className="w-16">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhuma despesa encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.data ? fmtDataLocal(d.data + "T12:00:00") : "—"}</TableCell>
                  <TableCell>{d.responsavel || "—"}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {d.descricao}
                  </TableCell>
                  <TableCell>{getObraNome(d.obra_id)}</TableCell>
                  <TableCell>{d.fornecedor || "—"}</TableCell>
                  <TableCell className="text-right">{formatBRL(d.valor)}</TableCell>
                  {canEdit && (
                    <TableCell>
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(d)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(d, true)}
                          title="Visualizar detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={currentPage}
        totalItems={filtered.length}
        pageSize={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
        className="mt-4"
      />

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {viewOnly ? "Visualizar" : editing ? "Editar" : "Nova"} Despesa
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data da Compra</Label>
                  <DatePickerField
                    value={dataCompra}
                    onChange={(v) => setDataCompra(v)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
                <div>
                  <Label>Responsável *</Label>
                  <Input
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
              </div>
              <div>
                <Label>Descrição *</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Centro de Custo (Obra)</Label>
                  <Select
                    value={centroCustoId}
                    onValueChange={setCentroCustoId}
                    disabled={viewOnly}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {obras
                        .filter((o) => o.ativa)
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Input
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="mt-1"
                    disabled={viewOnly}
                  />
                </div>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input
                  inputMode="numeric"
                  value={valor}
                  onChange={(e) => setValor(formatBRLInput(e.target.value))}
                  placeholder="R$ 0,00"
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div>
                <Label>Referência</Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ex: SC 855, Pedido #123..."
                  className="mt-1"
                  disabled={viewOnly}
                />
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea
                  value={obsLivre}
                  onChange={(e) => setObsLivre(e.target.value)}
                  placeholder="Notas adicionais..."
                  className="mt-1 min-h-[80px]"
                  disabled={viewOnly}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {viewOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!viewOnly && (
              <Button
                onClick={handleSave}
                disabled={!descricao || !valor || !responsavel || saveDespesa.isPending}
              >
                {editing ? "Salvar" : "Adicionar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ControleDespesas;
