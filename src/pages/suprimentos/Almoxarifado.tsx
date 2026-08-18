import { useMemo, useState } from "react";
import { useObras } from "@/hooks/obras/useObras";
import { useAtividadesObra } from "@/hooks/suprimentos/useOrcamento";
import { useInsumosAtivosBasico } from "@/hooks/suprimentos/useInsumos";
import {
  useSolicitacoesPendentes,
  useSolicitacaoItens,
  useCriarSolicitacaoCampo,
  useAtenderDoEstoque,
  useEncaminharParaCompras,
  useDepositosPorObra,
} from "@/hooks/suprimentos/useAlmoxarifado";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Warehouse, Loader2, PackageCheck, ShoppingCart, Trash2 } from "lucide-react";
import { PageLoading } from "@/components/common/PageLoading";
import { EmptyState } from "@/components/common/EmptyState";

type ObraMin = { id: string; nome: string };

type ItemForm = {
  insumoId: string;
  descricaoLivre: string;
  quantidade: string;
  unidade: string;
};

const novoItemVazio = (): ItemForm => ({ insumoId: "", descricaoLivre: "", quantidade: "", unidade: "" });

export default function Almoxarifado() {
  const obrasQuery = useObras();
  const obras = useMemo<ObraMin[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const { data: insumosData = [] } = useInsumosAtivosBasico();
  const insumoById = useMemo(
    () => Object.fromEntries(insumosData.map((i: any) => [i.id, i])),
    [insumosData],
  );
  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  const solicitacoesQuery = useSolicitacoesPendentes();
  const solicitacoes = useMemo(() => solicitacoesQuery.data ?? [], [solicitacoesQuery.data]);
  const solicitacaoIds = useMemo(() => solicitacoes.map((s) => s.id), [solicitacoes]);
  const itensQuery = useSolicitacaoItens(solicitacaoIds);
  const itensPorSolicitacao = useMemo(() => {
    const map = new Map<string, NonNullable<typeof itensQuery.data>>();
    for (const item of itensQuery.data ?? []) {
      const list = map.get(item.solicitacao_id) ?? [];
      list.push(item);
      map.set(item.solicitacao_id, list);
    }
    return map;
  }, [itensQuery.data]);

  const atenderMut = useAtenderDoEstoque();
  const encaminharMut = useEncaminharParaCompras();

  const [formOpen, setFormOpen] = useState(false);
  const [obraId, setObraId] = useState("");
  const [cronogramaItemId, setCronogramaItemId] = useState("");
  const [urgencia, setUrgencia] = useState<"normal" | "urgente">("normal");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([novoItemVazio()]);
  const atividadesQuery = useAtividadesObra(obraId);
  const criarMut = useCriarSolicitacaoCampo();

  function resetForm() {
    setObraId("");
    setCronogramaItemId("");
    setUrgencia("normal");
    setObservacao("");
    setItens([novoItemVazio()]);
  }

  async function handleCriar() {
    if (!obraId || !cronogramaItemId) {
      toast.error("Selecione a obra e a atividade do cronograma.");
      return;
    }
    const itensValidos = itens.filter(
      (i) => (i.insumoId || i.descricaoLivre.trim()) && Number(i.quantidade) > 0,
    );
    if (itensValidos.length === 0) {
      toast.error("Adicione ao menos um item com quantidade válida.");
      return;
    }
    try {
      await criarMut.mutateAsync({
        obraId,
        cronogramaItemId,
        urgencia,
        observacao,
        itens: itensValidos.map((i) => ({
          insumoId: i.insumoId || null,
          descricaoLivre: i.insumoId ? null : i.descricaoLivre.trim(),
          quantidade: Number(i.quantidade),
          unidade: i.unidade || null,
        })),
      });
    } catch {
      return;
    }
    toast.success("Solicitação registrada — aguardando triagem do almoxarifado.");
    resetForm();
    setFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <Warehouse className="h-6 w-6" /> Almoxarifado — Triagem
        </h2>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova solicitação
        </Button>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Toda solicitação (planejada pelo cronograma ou pedida em campo) passa por aqui antes de
        virar requisição de compra — atenda direto do estoque quando houver saldo, ou encaminhe
        para compras.
      </p>

      {solicitacoesQuery.isLoading ? (
        <PageLoading />
      ) : solicitacoes.length === 0 ? (
        <EmptyState title="Nenhuma solicitação pendente de triagem." />
      ) : (
        <div className="grid gap-3">
          {solicitacoes.map((s) => (
            <SolicitacaoCard
              key={s.id}
              solicitacao={s}
              itens={itensPorSolicitacao.get(s.id) ?? []}
              obraNome={obraById[s.obra_id] ?? s.obra_id}
              insumoById={insumoById}
              onAtender={(itemId, depositoId) =>
                atenderMut.mutate({ itemId, depositoId })
              }
              onEncaminhar={(itemId) => encaminharMut.mutate(itemId)}
              busy={atenderMut.isPending || encaminharMut.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(v) => !v && setFormOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Nova solicitação de almoxarifado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Obra *</Label>
                <Select
                  value={obraId}
                  onValueChange={(v) => {
                    setObraId(v);
                    setCronogramaItemId("");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgência</Label>
                <Select value={urgencia} onValueChange={(v) => setUrgencia(v as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Atividade do cronograma *</Label>
              <Select
                value={cronogramaItemId}
                onValueChange={setCronogramaItemId}
                disabled={!obraId || atividadesQuery.isLoading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={obraId ? "Selecione a atividade" : "Selecione a obra primeiro"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(atividadesQuery.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.descricao || "(sem descrição)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Toda solicitação precisa estar vinculada a uma atividade do cronograma.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Itens *</Label>
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start border rounded-md p-2">
                  <div className="flex-1 space-y-1">
                    <Select
                      value={item.insumoId}
                      onValueChange={(v) => {
                        const next = [...itens];
                        next[idx] = { ...next[idx], insumoId: v, descricaoLivre: "" };
                        setItens(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Insumo cadastrado (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(insumosData as any[]).slice(0, 300).map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.codigo ? `${i.codigo} — ` : ""}
                            {i.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!item.insumoId && (
                      <Input
                        placeholder="Ou descreva o item livremente"
                        value={item.descricaoLivre}
                        onChange={(e) => {
                          const next = [...itens];
                          next[idx] = { ...next[idx], descricaoLivre: e.target.value };
                          setItens(next);
                        }}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Quantidade"
                        value={item.quantidade}
                        onChange={(e) => {
                          const next = [...itens];
                          next[idx] = { ...next[idx], quantidade: e.target.value };
                          setItens(next);
                        }}
                      />
                      <Input
                        placeholder="Unidade"
                        value={item.unidade}
                        onChange={(e) => {
                          const next = [...itens];
                          next[idx] = { ...next[idx], unidade: e.target.value };
                          setItens(next);
                        }}
                      />
                    </div>
                  </div>
                  {itens.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItens(itens.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setItens([...itens, novoItemVazio()])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
              </Button>
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={criarMut.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={criarMut.isPending}>
              {criarMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SolicitacaoCard({
  solicitacao,
  itens,
  obraNome,
  insumoById,
  onAtender,
  onEncaminhar,
  busy,
}: {
  solicitacao: {
    id: string;
    obra_id: string;
    origem: string;
    urgencia: string;
    observacao: string | null;
    created_at: string;
  };
  itens: {
    id: string;
    insumo_id: string | null;
    descricao_livre: string | null;
    quantidade: number;
    unidade: string | null;
    atendido_estoque: boolean;
    requisicao_id: string | null;
  }[];
  obraNome: string;
  insumoById: Record<string, { descricao: string; unidade: string | null; codigo: string | null }>;
  onAtender: (itemId: string, depositoId: string) => void;
  onEncaminhar: (itemId: string) => void;
  busy: boolean;
}) {
  const depositosQuery = useDepositosPorObra(solicitacao.obra_id);
  const depositoPadraoId = depositosQuery.data?.[0]?.id;

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{obraNome}</span>
          <Badge variant={solicitacao.origem === "planejada" ? "outline" : "secondary"}>
            {solicitacao.origem === "planejada" ? "Planejada" : "Campo"}
          </Badge>
          {solicitacao.urgencia === "urgente" && <Badge variant="destructive">Urgente</Badge>}
        </div>
      </div>
      {solicitacao.observacao && (
        <p className="text-xs text-muted-foreground mb-2">{solicitacao.observacao}</p>
      )}
      <div className="space-y-2">
        {itens
          .filter((i) => !i.atendido_estoque && !i.requisicao_id)
          .map((item) => {
            const insumo = item.insumo_id ? insumoById[item.insumo_id] : undefined;
            const label = insumo
              ? `${insumo.codigo ? insumo.codigo + " — " : ""}${insumo.descricao}`
              : item.descricao_livre || "(sem descrição)";
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 text-sm border-t border-border pt-2"
              >
                <span>
                  {label} — {item.quantidade} {item.unidade ?? insumo?.unidade ?? ""}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!item.insumo_id || !depositoPadraoId || busy}
                    title={!item.insumo_id ? "Item sem insumo cadastrado — só encaminhar para compras" : undefined}
                    onClick={() => depositoPadraoId && onAtender(item.id, depositoPadraoId)}
                  >
                    <PackageCheck className="h-3.5 w-3.5 mr-1" /> Atender do estoque
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onEncaminhar(item.id)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Encaminhar p/ compras
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
