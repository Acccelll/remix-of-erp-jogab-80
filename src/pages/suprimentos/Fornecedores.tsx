import { useMemo, useState } from "react";
import {
  useFornecedoresCompleto,
  useCreateFornecedor,
  useUpdateFornecedor,
  useFornecedorHistorico,
} from "@/hooks/suprimentos/useFornecedores";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Eye, EyeOff, Truck, Pencil, Loader2, X, BarChart3 } from "lucide-react";
import { PageLoading } from "@/components/common/PageLoading";

type Fornecedor = {
  id: string;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  categorias: string[];
  ativo: boolean;
  updated_at: string;
  banco_codigo: string | null;
  agencia: string | null;
  agencia_dv: string | null;
  conta: string | null;
  conta_dv: string | null;
  tipo_conta: string | null;
  chave_pix: string | null;
};

const CATEGORIAS = ["material", "servico", "equipamento"] as const;
const CAT_LABEL: Record<string, string> = {
  material: "Material",
  servico: "Serviço",
  equipamento: "Equipamento",
};

const Fornecedores = () => {
  const fornecedoresQuery = useFornecedoresCompleto();
  const items = useMemo<Fornecedor[]>(
    () => (fornecedoresQuery.data ?? []) as Fornecedor[],
    [fornecedoresQuery.data],
  );
  const loading = fornecedoresQuery.isLoading;
  const createMut = useCreateFornecedor();
  const updateMut = useUpdateFornecedor();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);

  const historicoQuery = useFornecedorHistorico();
  const [historicoFornecedorId, setHistoricoFornecedorId] = useState<string | null>(null);
  const historicoSelecionado = useMemo(
    () => (historicoQuery.data ?? []).find((h) => h.fornecedor_id === historicoFornecedorId),
    [historicoQuery.data, historicoFornecedorId],
  );

  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);
  const [bancoCodigo, setBancoCodigo] = useState("");
  const [agencia, setAgencia] = useState("");
  const [agenciaDv, setAgenciaDv] = useState("");
  const [conta, setConta] = useState("");
  const [contaDv, setContaDv] = useState("");
  const [tipoConta, setTipoConta] = useState<"corrente" | "poupanca" | "">("");
  const [chavePix, setChavePix] = useState("");
  const saving = createMut.isPending || updateMut.isPending;

  const openForm = (f?: Fornecedor) => {
    if (f) {
      setEditing(f);
      setRazao(f.razao_social);
      setFantasia(f.nome_fantasia ?? "");
      setCnpj(f.cnpj ?? "");
      setContato(f.contato ?? "");
      setEmail(f.email ?? "");
      setTelefone(f.telefone ?? "");
      setCategorias(f.categorias ?? []);
      setAtivo(f.ativo);
      setBancoCodigo(f.banco_codigo ?? "");
      setAgencia(f.agencia ?? "");
      setAgenciaDv(f.agencia_dv ?? "");
      setConta(f.conta ?? "");
      setContaDv(f.conta_dv ?? "");
      setTipoConta((f.tipo_conta as "corrente" | "poupanca" | null) ?? "");
      setChavePix(f.chave_pix ?? "");
    } else {
      setEditing(null);
      setRazao("");
      setFantasia("");
      setCnpj("");
      setContato("");
      setEmail("");
      setTelefone("");
      setCategorias([]);
      setAtivo(true);
      setBancoCodigo("");
      setAgencia("");
      setAgenciaDv("");
      setConta("");
      setContaDv("");
      setTipoConta("");
      setChavePix("");
    }
    setFormOpen(true);
  };

  const toggleCategoria = (c: string) => {
    setCategorias((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSave = async () => {
    if (!razao.trim()) {
      toast.error("Razão social é obrigatória.");
      return;
    }
    const payload = {
      razao_social: razao.trim(),
      nome_fantasia: fantasia.trim() || null,
      cnpj: cnpj.trim() || null,
      contato: contato.trim() || null,
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      categorias,
      ativo,
      banco_codigo: bancoCodigo.trim() || null,
      agencia: agencia.trim() || null,
      agencia_dv: agenciaDv.trim() || null,
      conta: conta.trim() || null,
      conta_dv: contaDv.trim() || null,
      tipo_conta: tipoConta || null,
      chave_pix: chavePix.trim() || null,
    };
    try {
      if (editing) await updateMut.mutateAsync({ id: editing.id, patch: payload });
      else await createMut.mutateAsync(payload);
    } catch {
      // erro já notificado pela mutação
      return;
    }
    toast.success(editing ? "Fornecedor atualizado." : "Fornecedor criado.");
    setFormOpen(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((f) => {
      if (!showInactive && !f.ativo) return false;
      if (showInactive && f.ativo) return false;
      if (!q) return true;
      return (
        f.razao_social.toLowerCase().includes(q) ||
        (f.nome_fantasia ?? "").toLowerCase().includes(q) ||
        (f.cnpj ?? "").toLowerCase().includes(q) ||
        (f.contato ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, showInactive]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6" /> Fornecedores
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="inativos-forn" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="inativos-forn" className="text-sm">
              {showInactive ? (
                <EyeOff className="h-4 w-4 inline" />
              ) : (
                <Eye className="h-4 w-4 inline" />
              )}{" "}
              Inativos
            </Label>
          </div>
          <Button size="sm" onClick={() => openForm()}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por razão social, fantasia, CNPJ ou contato..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum fornecedor encontrado.
        </p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="bg-card border border-border rounded-lg p-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{f.razao_social}</p>
                {(f.nome_fantasia || f.cnpj) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {f.nome_fantasia}
                    {f.nome_fantasia && f.cnpj ? " · " : ""}
                    {f.cnpj}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {f.categorias.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sem categorias</span>
                  ) : (
                    f.categorias.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {CAT_LABEL[c] ?? c}
                      </Badge>
                    ))
                  )}
                </div>
                {(f.contato || f.email || f.telefone) && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {[f.contato, f.email, f.telefone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHistoricoFornecedorId(f.id)}
                title="Ver histórico de cotações e compras"
              >
                <BarChart3 className="h-4 w-4 mr-1" /> Histórico
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openForm(f)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Razão Social *</Label>
              <Input value={razao} onChange={(e) => setRazao(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome Fantasia</Label>
                <Input
                  value={fantasia}
                  onChange={(e) => setFantasia(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Categorias</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {CATEGORIAS.map((c) => {
                  const on = categorias.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleCategoria(c)}
                    >
                      {CAT_LABEL[c]}
                      {on && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Contato</Label>
              <Input
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="forn-ativo" checked={ativo} onCheckedChange={setAtivo} />
              <Label htmlFor="forn-ativo">Ativo</Label>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Dados bancários (pagamento via CNAB)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Banco</Label>
                  <Input
                    value={bancoCodigo}
                    onChange={(e) => setBancoCodigo(e.target.value)}
                    placeholder="Código"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>DV Agência</Label>
                  <Input value={agenciaDv} onChange={(e) => setAgenciaDv(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={conta} onChange={(e) => setConta(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>DV Conta</Label>
                  <Input value={contaDv} onChange={(e) => setContaDv(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <div className="flex gap-2 mt-1.5">
                    {(["corrente", "poupanca"] as const).map((t) => (
                      <Badge
                        key={t}
                        variant={tipoConta === t ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => setTipoConta(tipoConta === t ? "" : t)}
                      >
                        {t === "corrente" ? "Corrente" : "Poupança"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Label>Chave PIX</Label>
                <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !razao.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!historicoFornecedorId}
        onOpenChange={(v) => !v && setHistoricoFornecedorId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Histórico de cotações e compras
            </DialogTitle>
          </DialogHeader>
          {historicoQuery.isLoading ? (
            <PageLoading />
          ) : !historicoSelecionado || historicoSelecionado.total_cotacoes === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma cotação registrada para este fornecedor ainda.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div>
                <p className="text-xs text-muted-foreground">Cotações participadas</p>
                <p className="text-lg font-semibold">{historicoSelecionado.total_cotacoes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de vitória</p>
                <p className="text-lg font-semibold">
                  {historicoSelecionado.taxa_vitoria_pct ?? "—"}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço médio (propostas vencedoras)</p>
                <p className="text-lg font-semibold">
                  {historicoSelecionado.preco_medio_vencedor != null
                    ? historicoSelecionado.preco_medio_vencedor.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prazo médio prometido</p>
                <p className="text-lg font-semibold">
                  {historicoSelecionado.prazo_medio_prometido_dias != null
                    ? `${historicoSelecionado.prazo_medio_prometido_dias} dias`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Prazo médio real de entrega</p>
                <p className="text-lg font-semibold">
                  {historicoSelecionado.prazo_medio_real_dias != null
                    ? `${historicoSelecionado.prazo_medio_real_dias} dias`
                    : "—"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoricoFornecedorId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Fornecedores;
