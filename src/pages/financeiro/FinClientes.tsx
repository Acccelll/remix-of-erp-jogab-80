// @ts-nocheck
import { Link, useNavigate, useSearchParams, useParams, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { fetchCnpj } from "@/lib/core/cnpj";
import { fetchCep } from "@/lib/core/cep";
import {
  useClientes,
  useCreateCliente,
  useUpdateCliente,
  useDeleteCliente,
  fetchClienteObrasVinculadas,
} from "@/hooks/crm/useClientes";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ChipsNumberInput } from "@/components/ui/chips-number-input";
import { CnpjInput, onlyDigits } from "@/components/ui/cnpj-input";
import { PercentInput } from "@/components/ui/percent-input";
import { DataTable, RowActions } from "@/components/ui/data-table";
import { validateCliente, type ClienteFormErrors } from "@/lib/schemas/cliente";
import type { ColumnDef, SortingState } from "@tanstack/react-table";

const clientesSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  new: z.coerce.number().int().optional().catch(undefined),
});

function ClientesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const [searchParams] = useSearchParams();
  const search = {
    q: searchParams.get("q") ?? undefined,
    new: searchParams.get("new") ? Number(searchParams.get("new")) : undefined,
  };
  const { data: clientes } = useClientes();
  const createMut = useCreateCliente();
  const updateMut = useUpdateCliente();
  const deleteMut = useDeleteCliente();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const [loadingCnpjNew, setLoadingCnpjNew] = useState(false);
  const [loadingCnpjEdit, setLoadingCnpjEdit] = useState(false);
  const [loadingCepNew, setLoadingCepNew] = useState(false);
  const [loadingCepEdit, setLoadingCepEdit] = useState(false);

  const buscarCnpj = async (
    cnpj: string,
    setLoading: (b: boolean) => void,
    apply: (data: NonNullable<Awaited<ReturnType<typeof fetchCnpj>>>) => void,
  ) => {
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetchCnpj(cnpj);
      if (!r) {
        toast.error("CNPJ não encontrado na BrasilAPI.");
        return;
      }
      apply(r);
      toast.success("Dados do CNPJ preenchidos.");
    } finally {
      setLoading(false);
    }
  };

  const buscarCep = async (
    cep: string,
    setLoading: (b: boolean) => void,
    apply: (data: NonNullable<Awaited<ReturnType<typeof fetchCep>>>) => void,
  ) => {
    if (!cep || cep.replace(/\D/g, "").length !== 8) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetchCep(cep);
      if (!r) {
        toast.error("CEP não encontrado.");
        return;
      }
      apply(r);
      toast.success("Endereço preenchido pelo CEP.");
    } finally {
      setLoading(false);
    }
  };

  const applyCnpjToForm = (cur: any, r: NonNullable<Awaited<ReturnType<typeof fetchCnpj>>>) => ({
    ...cur,
    nome: cur.nome || r.razao_social || r.nome_fantasia || "",
    nome_fantasia: cur.nome_fantasia || r.nome_fantasia || "",
    email: cur.email || r.email || "",
    telefone: cur.telefone || (r.ddd_telefone_1 ?? ""),
    cep: cur.cep || r.cep || "",
    logradouro: cur.logradouro || r.logradouro || "",
    numero: cur.numero || r.numero || "",
    bairro: cur.bairro || r.bairro || "",
    municipio: cur.municipio || r.municipio || "",
    uf: cur.uf || r.uf || "",
  });

  const applyCepToForm = (cur: any, r: NonNullable<Awaited<ReturnType<typeof fetchCep>>>) => ({
    ...cur,
    cep: r.cep || cur.cep,
    logradouro: r.logradouro || cur.logradouro,
    bairro: r.bairro || cur.bairro,
    municipio: r.localidade || cur.municipio,
    uf: r.uf || cur.uf,
    complemento: cur.complemento || r.complemento || "",
  });

  const [fErrors, setFErrors] = useState<ClienteFormErrors>({});
  const [editingCliente, setEditingCliente] = useState<any>(null);
  const [ef, setEf] = useState<any>({});
  const [efErrors, setEfErrors] = useState<ClienteFormErrors>({});
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.new && !open) {
      setOpen(true);
      navigate("/financeiro/clientes", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.new]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const v = validateCliente(f);
    if (!v.ok) {
      setFErrors(v.errors);
      toast.error("Verifique os campos destacados");
      return;
    }
    setFErrors({});
    setSaving(true);
    try {
      // TODO(auth): rever ao decidir Supabase Auth + RLS — owner_id é nullable hoje
      // e vem da identidade do AppContext (mesmo padrão de FinObras).
      const ownerId = currentPlayer?.id ?? null;
      try {
        await createMut.mutateAsync({
          owner_id: ownerId,
          nome: f.nome,
          nome_fantasia: f.nome_fantasia || null,
          cnpj: f.cnpj ? onlyDigits(f.cnpj) : null,
          email: f.email || null,
          telefone: f.telefone || null,
          cep: f.cep ? onlyDigits(f.cep) : null,
          logradouro: f.logradouro || null,
          numero: f.numero || null,
          complemento: f.complemento || null,
          bairro: f.bairro || null,
          municipio: f.municipio || null,
          uf: f.uf ? String(f.uf).toUpperCase().slice(0, 2) : null,
          prazo_pagamento_dias: f.prazo_pagamento_dias ? Number(f.prazo_pagamento_dias) : null,
          dia_fixo_pagamento: f.dia_fixo_pagamento
            ? Number(f.dia_fixo_pagamento)
            : Array.isArray(f.dias_fixos_pagamento) && f.dias_fixos_pagamento.length
              ? f.dias_fixos_pagamento[0]
              : null,
          dias_fixos_pagamento: Array.isArray(f.dias_fixos_pagamento) ? f.dias_fixos_pagamento : [],
          prazo_emitir_nf_dias: f.prazo_emitir_nf_dias ? Number(f.prazo_emitir_nf_dias) : null,
          percentual_material:
            f.percentual_material !== "" && f.percentual_material != null
              ? Number(f.percentual_material)
              : 70,
          aliquota_iss:
            f.aliquota_iss !== "" && f.aliquota_iss != null ? Number(f.aliquota_iss) : 5,
          aliquota_inss:
            f.aliquota_inss !== "" && f.aliquota_inss != null ? Number(f.aliquota_inss) : 11,
          aliquota_cbs:
            f.aliquota_cbs !== "" && f.aliquota_cbs != null ? Number(f.aliquota_cbs) : 0,
          aliquota_ibs:
            f.aliquota_ibs !== "" && f.aliquota_ibs != null ? Number(f.aliquota_ibs) : 0,
          observacoes: f.observacoes || null,
        });
        toast.success("Cliente criado");
        setOpen(false);
        setF({});
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao criar cliente");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: any) {
    setEditingCliente(c);
    setEf({
      nome: c.nome ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      cnpj: c.cnpj ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
      cep: c.cep ?? "",
      logradouro: c.logradouro ?? "",
      numero: c.numero ?? "",
      complemento: c.complemento ?? "",
      bairro: c.bairro ?? "",
      municipio: c.municipio ?? "",
      uf: c.uf ?? "",
      prazo_pagamento_dias: c.prazo_pagamento_dias ?? "",
      dias_fixos_pagamento: Array.isArray(c.dias_fixos_pagamento) ? c.dias_fixos_pagamento : [],
      prazo_emitir_nf_dias: c.prazo_emitir_nf_dias ?? "",
      percentual_material: c.percentual_material ?? "",
      aliquota_iss: c.aliquota_iss ?? "",
      aliquota_inss: c.aliquota_inss ?? "",
      aliquota_cbs: c.aliquota_cbs ?? "",
      aliquota_ibs: c.aliquota_ibs ?? "",
      observacoes: c.observacoes ?? "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCliente) return;
    const v = validateCliente(ef);
    if (!v.ok) {
      setEfErrors(v.errors);
      toast.error("Verifique os campos destacados");
      return;
    }
    setEfErrors({});
    try {
      await updateMut.mutateAsync({
        id: editingCliente.id,
        patch: {
        nome: ef.nome,
        nome_fantasia: ef.nome_fantasia || null,
        cnpj: ef.cnpj ? onlyDigits(ef.cnpj) : null,
        email: ef.email || null,
        telefone: ef.telefone || null,
        cep: ef.cep ? onlyDigits(ef.cep) : null,
        logradouro: ef.logradouro || null,
        numero: ef.numero || null,
        complemento: ef.complemento || null,
        bairro: ef.bairro || null,
        municipio: ef.municipio || null,
        uf: ef.uf ? String(ef.uf).toUpperCase().slice(0, 2) : null,
        prazo_pagamento_dias: ef.prazo_pagamento_dias ? Number(ef.prazo_pagamento_dias) : null,
        dia_fixo_pagamento: ef.dia_fixo_pagamento
          ? Number(ef.dia_fixo_pagamento)
          : Array.isArray(ef.dias_fixos_pagamento) && ef.dias_fixos_pagamento.length
            ? ef.dias_fixos_pagamento[0]
            : null,
        dias_fixos_pagamento: Array.isArray(ef.dias_fixos_pagamento) ? ef.dias_fixos_pagamento : [],
        prazo_emitir_nf_dias: ef.prazo_emitir_nf_dias ? Number(ef.prazo_emitir_nf_dias) : null,
        percentual_material:
          ef.percentual_material !== "" && ef.percentual_material != null
            ? Number(ef.percentual_material)
            : 70,
        aliquota_iss:
          ef.aliquota_iss !== "" && ef.aliquota_iss != null ? Number(ef.aliquota_iss) : 5,
        aliquota_inss:
          ef.aliquota_inss !== "" && ef.aliquota_inss != null ? Number(ef.aliquota_inss) : 11,
        aliquota_cbs:
          ef.aliquota_cbs !== "" && ef.aliquota_cbs != null ? Number(ef.aliquota_cbs) : 0,
        aliquota_ibs:
          ef.aliquota_ibs !== "" && ef.aliquota_ibs != null ? Number(ef.aliquota_ibs) : 0,
        observacoes: ef.observacoes || null,
        },
      });
      toast.success("Cliente atualizado");
      setEditingCliente(null);
      
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar cliente");
    }
  }

  async function doDelete() {
    if (!confirmDel) return;
    try {
      const vinculadas = await fetchClienteObrasVinculadas(qc, confirmDel.id);
      if (vinculadas > 0) {
        toast.error("Cliente possui obras vinculadas e não pode ser excluído");
        setConfirmDel(null);
        return;
      }
      await deleteMut.mutateAsync(confirmDel.id);
      toast.success("Cliente excluído");
      setConfirmDel(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir cliente");
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Empresas contratantes e prazos padrão.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={save}
              className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1"
            >
              <div className="col-span-2 space-y-1.5">
                <Label>Razão social *</Label>
                <Input
                  required
                  value={f.nome ?? ""}
                  onChange={(e) => setF({ ...f, nome: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nome fantasia</Label>
                <Input
                  value={f.nome_fantasia ?? ""}
                  onChange={(e) => setF({ ...f, nome_fantasia: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    value={f.cnpj ?? ""}
                    onChange={(e) => setF({ ...f, cnpj: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={loadingCnpjNew}
                    onClick={() =>
                      buscarCnpj(f.cnpj ?? "", setLoadingCnpjNew, (r) =>
                        setF((cur: any) => applyCnpjToForm(cur, r)),
                      )
                    }
                    aria-label="Buscar dados pelo CNPJ"
                    title="Buscar dados pelo CNPJ"
                  >
                    {loadingCnpjNew ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={f.telefone ?? ""}
                  onChange={(e) => setF({ ...f, telefone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={f.email ?? ""}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                />
              </div>

              <div className="col-span-2 pt-2 mt-2 border-t">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Endereço
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input
                    value={f.cep ?? ""}
                    onChange={(e) => setF({ ...f, cep: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={loadingCepNew}
                    onClick={() =>
                      buscarCep(f.cep ?? "", setLoadingCepNew, (r) =>
                        setF((cur: any) => applyCepToForm(cur, r)),
                      )
                    }
                    aria-label="Buscar endereço pelo CEP"
                    title="Buscar endereço pelo CEP"
                  >
                    {loadingCepNew ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Número</Label>
                <Input
                  value={f.numero ?? ""}
                  onChange={(e) => setF({ ...f, numero: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Logradouro</Label>
                <Input
                  value={f.logradouro ?? ""}
                  onChange={(e) => setF({ ...f, logradouro: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Complemento</Label>
                <Input
                  value={f.complemento ?? ""}
                  onChange={(e) => setF({ ...f, complemento: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input
                  value={f.bairro ?? ""}
                  onChange={(e) => setF({ ...f, bairro: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Município</Label>
                <Input
                  value={f.municipio ?? ""}
                  onChange={(e) => setF({ ...f, municipio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input
                  maxLength={2}
                  value={f.uf ?? ""}
                  onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="col-span-2 pt-2 mt-2 border-t">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Prazos comerciais
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Prazo padrão (DDL)</Label>
                <Input
                  type="number"
                  value={f.prazo_pagamento_dias ?? ""}
                  onChange={(e) => setF({ ...f, prazo_pagamento_dias: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo emitir NF (dias)</Label>
                <Input
                  type="number"
                  value={f.prazo_emitir_nf_dias ?? ""}
                  onChange={(e) => setF({ ...f, prazo_emitir_nf_dias: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Dias fixos de pagamento</Label>
                <ChipsNumberInput
                  value={f.dias_fixos_pagamento ?? []}
                  onChange={(v) => setF({ ...f, dias_fixos_pagamento: v })}
                  placeholder="Ex.: 1, 15"
                />
              </div>
              <div className="col-span-2 pt-2 mt-2 border-t">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Retenções padrão (aplicadas a novas obras deste cliente)
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>% Material</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="70"
                  value={f.percentual_material ?? ""}
                  onChange={(e) => setF({ ...f, percentual_material: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ISS %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="5"
                  value={f.aliquota_iss ?? ""}
                  onChange={(e) => setF({ ...f, aliquota_iss: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>INSS %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="11"
                  value={f.aliquota_inss ?? ""}
                  onChange={(e) => setF({ ...f, aliquota_inss: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CBS %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={f.aliquota_cbs ?? ""}
                  onChange={(e) => setF({ ...f, aliquota_cbs: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>IBS %</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={f.aliquota_ibs ?? ""}
                  onChange={(e) => setF({ ...f, aliquota_ibs: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={f.observacoes ?? ""}
                  onChange={(e) => setF({ ...f, observacoes: e.target.value })}
                />
              </div>

              <DialogFooter className="col-span-2">
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardContent className="pt-6">
          <ClientesTable data={clientes ?? []} onEdit={startEdit} onDelete={setConfirmDel} />
        </CardContent>
      </Card>

      <Dialog open={!!editingCliente} onOpenChange={(o) => !o && setEditingCliente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={saveEdit}
            className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1"
          >
            <div className="col-span-2 space-y-1.5">
              <Label>Razão social *</Label>
              <Input
                required
                value={ef.nome ?? ""}
                onChange={(e) => setEf({ ...ef, nome: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input
                value={ef.nome_fantasia ?? ""}
                onChange={(e) => setEf({ ...ef, nome_fantasia: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <div className="flex gap-2">
                <Input
                  value={ef.cnpj ?? ""}
                  onChange={(e) => setEf({ ...ef, cnpj: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={loadingCnpjEdit}
                  onClick={() =>
                    buscarCnpj(ef.cnpj ?? "", setLoadingCnpjEdit, (r) =>
                      setEf((cur: any) => applyCnpjToForm(cur, r)),
                    )
                  }
                  aria-label="Buscar dados pelo CNPJ"
                  title="Buscar dados pelo CNPJ"
                >
                  {loadingCnpjEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={ef.telefone ?? ""}
                onChange={(e) => setEf({ ...ef, telefone: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={ef.email ?? ""}
                onChange={(e) => setEf({ ...ef, email: e.target.value })}
              />
            </div>

            <div className="col-span-2 pt-2 mt-2 border-t">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Endereço
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={ef.cep ?? ""}
                  onChange={(e) => setEf({ ...ef, cep: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={loadingCepEdit}
                  onClick={() =>
                    buscarCep(ef.cep ?? "", setLoadingCepEdit, (r) =>
                      setEf((cur: any) => applyCepToForm(cur, r)),
                    )
                  }
                  aria-label="Buscar endereço pelo CEP"
                  title="Buscar endereço pelo CEP"
                >
                  {loadingCepEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input
                value={ef.numero ?? ""}
                onChange={(e) => setEf({ ...ef, numero: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Logradouro</Label>
              <Input
                value={ef.logradouro ?? ""}
                onChange={(e) => setEf({ ...ef, logradouro: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Complemento</Label>
              <Input
                value={ef.complemento ?? ""}
                onChange={(e) => setEf({ ...ef, complemento: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input
                value={ef.bairro ?? ""}
                onChange={(e) => setEf({ ...ef, bairro: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Município</Label>
              <Input
                value={ef.municipio ?? ""}
                onChange={(e) => setEf({ ...ef, municipio: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={ef.uf ?? ""}
                onChange={(e) => setEf({ ...ef, uf: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="col-span-2 pt-2 mt-2 border-t">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prazos comerciais
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo padrão (DDL)</Label>
              <Input
                type="number"
                value={ef.prazo_pagamento_dias ?? ""}
                onChange={(e) => setEf({ ...ef, prazo_pagamento_dias: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo emitir NF (dias)</Label>
              <Input
                type="number"
                value={ef.prazo_emitir_nf_dias ?? ""}
                onChange={(e) => setEf({ ...ef, prazo_emitir_nf_dias: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Dias fixos de pagamento</Label>
              <ChipsNumberInput
                value={ef.dias_fixos_pagamento ?? []}
                onChange={(v) => setEf({ ...ef, dias_fixos_pagamento: v })}
                placeholder="Ex.: 1, 15"
              />
            </div>
            <div className="col-span-2 pt-2 mt-2 border-t">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Retenções padrão (aplicadas a novas obras deste cliente)
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>% Material</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="70"
                value={ef.percentual_material ?? ""}
                onChange={(e) => setEf({ ...ef, percentual_material: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ISS %</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="5"
                value={ef.aliquota_iss ?? ""}
                onChange={(e) => setEf({ ...ef, aliquota_iss: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>INSS %</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="11"
                value={ef.aliquota_inss ?? ""}
                onChange={(e) => setEf({ ...ef, aliquota_inss: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CBS %</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={ef.aliquota_cbs ?? ""}
                onChange={(e) => setEf({ ...ef, aliquota_cbs: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IBS %</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={ef.aliquota_ibs ?? ""}
                onChange={(e) => setEf({ ...ef, aliquota_ibs: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={ef.observacoes ?? ""}
                onChange={(e) => setEf({ ...ef, observacoes: e.target.value })}
              />
            </div>

            <DialogFooter className="col-span-2">
              <Button type="submit">Salvar alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.nome
                ? `O cliente "${confirmDel.nome}" será excluído permanentemente. `
                : ""}
              Esta ação não pode ser desfeita. Clientes com obras vinculadas não podem ser
              excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientesTable({
  data,
  onEdit,
  onDelete,
}: {
  data: any[];
  onEdit: (c: any) => void;
  onDelete: (c: any) => void;
}) {
  const columns: ColumnDef<any>[] = [
    { accessorKey: "nome", header: "Razão social" },
    {
      accessorKey: "nome_fantasia",
      header: "Nome fantasia",
      cell: (info) => info.getValue() || "—",
    },
    { accessorKey: "cnpj", header: "CNPJ", cell: (info) => info.getValue() ?? "—" },
    {
      id: "cidade_uf",
      header: "Município/UF",
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original.municipio;
        const u = row.original.uf;
        return m || u ? [m, u].filter(Boolean).join("/") : "—";
      },
    },
    { accessorKey: "telefone", header: "Telefone", cell: (info) => info.getValue() || "—" },
    {
      accessorKey: "prazo_pagamento_dias",
      header: "Prazo",
      cell: (info) => (info.getValue() ? `${info.getValue()} DDL` : "—"),
    },
    {
      accessorKey: "dias_fixos_pagamento",
      header: "Dias fixos",
      enableSorting: false,
      cell: (info) => {
        const v = info.getValue() as any[];
        return Array.isArray(v) && v.length ? v.join(" ou ") : "—";
      },
    },
    {
      id: "acoes",
      header: () => <div className="text-right w-full">Ações</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions>
          <Button size="sm" variant="ghost" onClick={() => onEdit(row.original)}>
            <Pencil className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(row.original)}>
            <Trash2 className="h-3 w-3 mr-1" />
            Excluir
          </Button>
        </RowActions>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar por nome ou CNPJ…"
      countLabel={(f, t) =>
        `${f} ${f === 1 ? "cliente" : "clientes"}${f !== t ? ` (de ${t})` : ""}`
      }
      initialSorting={[{ id: "nome", desc: false }]}
    />
  );
}

export default ClientesPage;
