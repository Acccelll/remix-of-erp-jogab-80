import React, { useState, useMemo } from "react";
import { usePermissions } from "@/contexts/auth/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, CreditCard, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  useFormasPagamento,
  useSaveFormaPagamento,
  useToggleFormaPagamentoAtivo,
  type FormaPag,
  type TipoPagamento,
} from "@/hooks/financeiro/useFormasPagamento";

const tipoLabels: Record<TipoPagamento, string> = {
  cartao_credito: "Cartão de Crédito",
  pix: "Pix",
  boleto: "Boleto",
  pix_cartao_credito: "Pix/Cartão de Crédito",
};

const FormaPagamento = () => {
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("financeiro", "compras");
  const { data: formas = [] } = useFormasPagamento();
  const saveMutation = useSaveFormaPagamento();
  const toggleMutation = useToggleFormaPagamentoAtivo();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FormaPag | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoPagamento>("pix");
  const [nomeCartao, setNomeCartao] = useState("");


  const filtered = useMemo(() => {
    return formas
      .filter((f) => (showInactive ? !f.ativo : f.ativo))
      .filter(
        (f) =>
          !search ||
          f.nome.toLowerCase().includes(search.toLowerCase()) ||
          tipoLabels[f.tipo].toLowerCase().includes(search.toLowerCase()),
      );
  }, [formas, search, showInactive]);

  const openAdd = () => {
    setEditing(null);
    setNome("");
    setTipo("pix");
    setNomeCartao("");
    setFormOpen(true);
  };
  const openEdit = (f: FormaPag) => {
    setEditing(f);
    setNome(f.nome);
    setTipo(f.tipo);
    setNomeCartao(f.nome_cartao || "");
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!nome) return;
    const payload: Record<string, unknown> = {
      nome,
      tipo,
      detalhes: tipo === "cartao_credito" ? JSON.stringify({ nome_cartao: nomeCartao }) : null,
      ativo: true,
    };
    await saveMutation.mutateAsync({ id: editing?.id, payload });
    toast.success(editing ? "Forma de pagamento atualizada" : "Forma de pagamento adicionada");
    setFormOpen(false);
  };

  const toggleAtivo = async (f: FormaPag) => {
    await toggleMutation.mutateAsync(f);
  };


  if (!hasAccess("financeiro", "visualizar")) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito ao módulo Financeiro.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6" /> Formas de Pagamento
        </h2>
        {canEdit && (
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
          <Label htmlFor="show-inactive" className="text-sm">
            Inativos
          </Label>
        </div>
      </div>
      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nome do Cartão</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="w-20">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma forma de pagamento encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{tipoLabels[f.tipo]}</TableCell>
                  <TableCell>{f.tipo === "cartao_credito" ? f.nome_cartao || "—" : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.ativo ? "default" : "secondary"}>
                      {f.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleAtivo(f)}>
                          {f.ativo ? "Inativar" : "Ativar"}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar" : "Adicionar"} Forma de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1"
                placeholder="Ex: Visa Corporativo"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPagamento)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix_cartao_credito">Pix/Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipo === "cartao_credito" && (
              <div>
                <Label>Nome do Cartão</Label>
                <Input
                  value={nomeCartao}
                  onChange={(e) => setNomeCartao(e.target.value)}
                  className="mt-1"
                  placeholder="Ex: Final 1234"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!nome}>
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormaPagamento;
