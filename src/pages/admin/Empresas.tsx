import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Settings2, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { EmpresaParametrizacaoDialog } from "@/components/admin/EmpresaParametrizacaoDialog";
import { toast } from "sonner";
import { empresasRepo, userEmpresasRepo, profilesRepo } from "@/lib/repositories/admin";
import { useAuth } from "@/contexts/auth/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmDialog } from "@/lib/ui/confirm";

type Empresa = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  ativa: boolean;
  cor: string | null;
};

type UserEmpresa = {
  user_id: string;
  empresa_id: string;
  papel: string;
};

type Profile = { id: string; login: string | null; email: string | null; is_gm: boolean | null };

export default function AdminEmpresas() {
  const { currentPlayer } = useAuth();
  const isGm = !!currentPlayer?.isGM;
  if (!isGm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" /> Empresas
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os CNPJs/SPEs e atribua usuários a cada empresa.
        </p>
      </div>
      <CardEmpresas />
      <CardVinculos />
    </div>
  );
}

function CardEmpresas() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Empresa | null>(null);
  const [open, setOpen] = useState(false);
  const [paramAlvo, setParamAlvo] = useState<Empresa | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["admin-empresas"],
    queryFn: async () => (await empresasRepo.list()) as Empresa[],

  });

  const salvar = useMutation({
    mutationFn: async (e: Partial<Empresa>) => {
      if (e.id) {
        await empresasRepo.update(e.id, {
          razao_social: e.razao_social,
          nome_fantasia: e.nome_fantasia,
          cnpj: e.cnpj,
          ativa: e.ativa,
          cor: e.cor,
        });
      } else {
        await empresasRepo.insert({
          razao_social: e.razao_social ?? "",
          nome_fantasia: e.nome_fantasia ?? null,
          cnpj: e.cnpj ?? null,
          ativa: e.ativa ?? true,
          cor: e.cor ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Empresa salva");
      setOpen(false);
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-do-usuario"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      await empresasRepo.remove(id);
    },
    onSuccess: () => {
      toast.success("Empresa excluída");
      qc.invalidateQueries({ queryKey: ["admin-empresas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Empresas cadastradas
          <Badge variant="secondary">{empresas.length}</Badge>
        </CardTitle>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditando(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Nova empresa
            </Button>
          </DialogTrigger>
          <EmpresaForm
            empresa={editando}
            onSubmit={(e) => salvar.mutate(e)}
            saving={salvar.isPending}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razão social</TableHead>
              <TableHead>Nome fantasia</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {empresas.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {e.cor && (
                      <span className="h-3 w-3 rounded-full border" style={{ background: e.cor }} />
                    )}
                    {e.razao_social}
                  </div>
                </TableCell>
                <TableCell>{e.nome_fantasia ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{e.cnpj ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.ativa ? "default" : "secondary"}>
                    {e.ativa ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Parametrização (numerações, logo)"
                    onClick={() => setParamAlvo(e)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(e);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        await confirmDialog({
                          title: `Excluir ${e.razao_social}?`,
                          description: "Os vínculos serão removidos.",
                        })
                      ) {
                        excluir.mutate(e.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {empresas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <EmpresaParametrizacaoDialog
        empresaId={paramAlvo?.id ?? null}
        empresaNome={paramAlvo?.razao_social}
        open={!!paramAlvo}
        onOpenChange={(v) => !v && setParamAlvo(null)}
      />
    </Card>
  );
}

function EmpresaForm({
  empresa,
  onSubmit,
  saving,
}: {
  empresa: Empresa | null;
  onSubmit: (e: Partial<Empresa>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Empresa>>({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    ativa: true,
    cor: "#3B82F6",
  });

  // Reset quando muda alvo.
  useState(() => {
    if (empresa) setForm(empresa);
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{empresa ? "Editar empresa" : "Nova empresa"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Razão social *</Label>
          <Input
            value={form.razao_social ?? ""}
            onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
          />
        </div>
        <div>
          <Label>Nome fantasia</Label>
          <Input
            value={form.nome_fantasia ?? ""}
            onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
          />
        </div>
        <div>
          <Label>CNPJ</Label>
          <Input
            value={form.cnpj ?? ""}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm">Cor</Label>
          <Input
            type="color"
            className="w-16 h-8 p-1"
            value={form.cor ?? "#3B82F6"}
            onChange={(e) => setForm({ ...form, cor: e.target.value })}
          />
          <div className="flex items-center gap-2 ml-4">
            <Switch
              checked={form.ativa ?? true}
              onCheckedChange={(v) => setForm({ ...form, ativa: v })}
            />
            <Label className="text-sm">Ativa</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!form.razao_social?.trim()) {
              toast.error("Razão social é obrigatória");
              return;
            }
            onSubmit({ ...form, id: empresa?.id });
          }}
          disabled={saving}
        >
          {empresa ? "Salvar" : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CardVinculos() {
  const qc = useQueryClient();
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("");
  const [novoUserId, setNovoUserId] = useState<string>("");
  const [novoPapel, setNovoPapel] = useState<string>("operador");

  const { data: empresas = [] } = useQuery({
    queryKey: ["admin-empresas"],
    queryFn: async () => (await empresasRepo.list()) as Empresa[],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await profilesRepo.listAdmin()) as Profile[],
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: ["admin-user-empresas", empresaFiltro],
    queryFn: async () => (await userEmpresasRepo.list(empresaFiltro || null)) as UserEmpresa[],
  });

  const empresaSel = empresas.find((e) => e.id === empresaFiltro) ?? null;

  const vincular = useMutation({
    mutationFn: async () => {
      if (!empresaFiltro || !novoUserId) throw new Error("Selecione empresa e usuário");
      await userEmpresasRepo.upsert({
        empresa_id: empresaFiltro,
        user_id: novoUserId,
        papel: novoPapel,
      });
    },
    onSuccess: () => {
      toast.success("Vínculo salvo");
      setNovoUserId("");
      qc.invalidateQueries({ queryKey: ["admin-user-empresas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async ({ user_id, empresa_id }: { user_id: string; empresa_id: string }) => {
      await userEmpresasRepo.remove(user_id, empresa_id);
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["admin-user-empresas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atualizarPapel = useMutation({
    mutationFn: async ({
      user_id,
      empresa_id,
      papel,
    }: {
      user_id: string;
      empresa_id: string;
      papel: string;
    }) => {
      await userEmpresasRepo.updatePapel(user_id, empresa_id, papel);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-user-empresas"] }),
  });

  const nomePor = new Map(profiles.map((p) => [p.id, p.login ?? p.email ?? p.id.slice(0, 8)]));
  const vinculadosIds = new Set(vinculos.map((v) => v.user_id));
  const usuariosDisponiveis = profiles.filter((p) => !vinculadosIds.has(p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Vínculos usuário ↔ empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Empresa</Label>
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="w-[240px] h-9">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {empresaSel && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Adicionar usuário</Label>
                <Select value={novoUserId} onValueChange={setNovoUserId}>
                  <SelectTrigger className="w-[240px] h-9">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosDisponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.login ?? p.email ?? p.id} {p.is_gm ? " · GM" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Papel</Label>
                <Select value={novoPapel} onValueChange={setNovoPapel}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => vincular.mutate()} className="gap-1">
                <UserPlus className="h-4 w-4" /> Vincular
              </Button>
            </>
          )}
        </div>

        {empresaSel ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vinculos.map((v) => (
                <TableRow key={v.user_id + v.empresa_id}>
                  <TableCell>{nomePor.get(v.user_id) ?? v.user_id}</TableCell>
                  <TableCell>
                    <Select
                      value={v.papel}
                      onValueChange={(p) =>
                        atualizarPapel.mutate({
                          user_id: v.user_id,
                          empresa_id: v.empresa_id,
                          papel: p,
                        })
                      }
                    >
                      <SelectTrigger className="w-[130px] h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        remover.mutate({ user_id: v.user_id, empresa_id: v.empresa_id })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {vinculos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
                    Nenhum vínculo nesta empresa.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" /> Selecione uma empresa para gerenciar vínculos.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
