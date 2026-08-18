import { useEffect, useMemo, useState } from "react";
import { useFornecedoresResumo } from "@/hooks/suprimentos/useFornecedores";
import { authRepo } from "@/lib/repositories/auth";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/common/DatePickerField";
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
import { Plus, PackageCheck, Loader2 } from "lucide-react";
import NotaFiscalEntradaDialog from "@/components/suprimentos/NotaFiscalEntradaDialog";
import { OnboardingHint } from "@/components/onboarding/OnboardingHint";
import { useObras } from "@/hooks/obras/useObras";
import { useObrasEditaveis } from "@/hooks/obras/useObrasEditaveis";
import { formatBRL } from "@/lib/core/currency";
import { fmtDataLocal } from "@/lib/core/date";
import { PageLoading } from "@/components/common/PageLoading";

type OC = {
  id: string;
  obra_id: string;
  fornecedor_id: string;
  numero: number;
  status: string;
  valor_total: number;
};
type OCItem = {
  id: string;
  ordem_compra_id: string;
  insumo_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};
type Recebimento = {
  id: string;
  ordem_compra_id: string;
  nota_fiscal: string | null;
  data_recebimento: string;
  observacao: string | null;
  created_at: string;
};
type RecItem = {
  id: string;
  recebimento_id: string;
  ordem_compra_item_id: string;
  quantidade_recebida: number;
};
type Obra = { id: string; nome: string };
type Fornecedor = { id: string; razao_social: string };

const fmtBRL = (v: number) => formatBRL(v);

export default function Recebimento() {
  const { canEditObra } = useObrasEditaveis();
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recebimento[]>([]);
  const [recItens, setRecItens] = useState<RecItem[]>([]);
  const [ocs, setOcs] = useState<OC[]>([]);
  const [ocItens, setOcItens] = useState<OCItem[]>([]);
  const fornecedoresQuery = useFornecedoresResumo();
  const forns = useMemo<Fornecedor[]>(
    () => (fornecedoresQuery.data ?? []).map((f) => ({ id: f.id, razao_social: f.razao_social })),
    [fornecedoresQuery.data],
  );

  const [openNew, setOpenNew] = useState(false);
  const [ocId, setOcId] = useState("");
  const [nf, setNf] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [qtds, setQtds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filtroObra, setFiltroObra] = useState<string>("todas");

  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornById = useMemo(
    () => Object.fromEntries(forns.map((f) => [f.id, f.razao_social])),
    [forns],
  );
  const ocById = useMemo(() => Object.fromEntries(ocs.map((o) => [o.id, o])), [ocs]);

  async function load() {
    setLoading(true);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        suprimentosRepo.listRecebimentoMateriais(),
        suprimentosRepo.listRecebimentoItens(),
        suprimentosRepo.listOcsRecebiveis(),
        suprimentosRepo.listOcItens(),
      ]);
      setRecs((r1 ?? []) as Recebimento[]);
      setRecItens((r2 ?? []) as RecItem[]);
      setOcs((r3 ?? []) as OC[]);
      setOcItens((r4 ?? []) as OCItem[]);
    } catch {
      toast.error("Falha ao carregar recebimentos");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // OCs elegíveis: emitida ou recebida_parcial
  const ocsElegiveis = useMemo(
    () =>
      ocs.filter(
        (o) =>
          (o.status === "emitida" || o.status === "recebida_parcial") && canEditObra(o.obra_id),
      ),
    [ocs, canEditObra],
  );

  // Itens da OC selecionada, com quantidade já recebida
  const itensOcSel = useMemo(() => {
    if (!ocId) return [];
    const items = ocItens.filter((i) => i.ordem_compra_id === ocId);
    return items.map((i) => {
      const recebido = recItens
        .filter((ri) => ri.ordem_compra_item_id === i.id)
        .reduce((s, ri) => s + Number(ri.quantidade_recebida || 0), 0);
      return { ...i, recebido, saldo: Number(i.quantidade) - recebido };
    });
  }, [ocId, ocItens, recItens]);

  function openNewDialog() {
    setOcId("");
    setNf("");
    setData(new Date().toISOString().slice(0, 10));
    setObs("");
    setQtds({});
    setOpenNew(true);
  }

  async function salvarRecebimento() {
    if (!ocId) return toast.error("Selecione a OC");
    const oc = ocById[ocId];
    if (!oc) return;
    if (!canEditObra(oc.obra_id)) {
      return toast.error("Você não tem permissão para receber materiais desta obra.");
    }
    const entradas = itensOcSel
      .map((i) => ({ item: i, q: Number(qtds[i.id] || 0) }))
      .filter((x) => x.q > 0);
    if (entradas.length === 0) return toast.error("Informe ao menos uma quantidade > 0");
    for (const e of entradas) {
      if (e.q > e.item.saldo + 1e-9)
        return toast.error(`Quantidade excede o saldo do item "${e.item.descricao}"`);
    }

    setSaving(true);
    const owner_id = await authRepo.getUserId();
    if (!owner_id) {
      setSaving(false);
      return toast.error("Sessão expirada");
    }

    try {
      await suprimentosRepo.registrarRecebimento({
        ocId,
        notaFiscal: nf || null,
        data,
        observacao: obs || null,
        itens: entradas.map((e) => ({ ordem_compra_item_id: e.item.id, quantidade: e.q })),
        ownerId: owner_id,
      });
    } catch (e: any) {
      setSaving(false);
      return toast.error("Falha no recebimento: " + (e?.message ?? ""));
    }

    toast.success("Recebimento registrado");
    setSaving(false);
    setOpenNew(false);
    await load();
  }

  const recsFiltrados = useMemo(() => {
    if (filtroObra === "todas") return recs;
    return recs.filter((r) => ocById[r.ordem_compra_id]?.obra_id === filtroObra);
  }, [recs, filtroObra, ocById]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="h-6 w-6" />
            Recebimento de Materiais
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre entrega da OC (parcial ou total) — atualiza estoque e status.
          </p>
        </div>
        <Button onClick={openNewDialog} className="h-11 w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Recebimento
        </Button>
      </div>

      <OnboardingHint storageKey="recebimento.v1" title="Como funciona">
        Selecione a OC, confira as quantidades item-a-item e anexe foto da NF. O estoque é
        atualizado automaticamente quando você confirma o recebimento.
      </OnboardingHint>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Obra:</Label>
        <Select value={filtroObra} onValueChange={setFiltroObra}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {obras.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : recsFiltrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border rounded-lg">
          Nenhum recebimento registrado.
        </div>
      ) : (
        <div className="space-y-3">
          {recsFiltrados.map((r) => {
            const oc = ocById[r.ordem_compra_id];
            const itens = recItens.filter((ri) => ri.recebimento_id === r.id);
            return (
              <div key={r.id} className="border rounded-lg p-4 hover:bg-accent/30 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">OC #{oc?.numero ?? "—"}</span>
                      <Badge variant="outline">{obraById[oc?.obra_id ?? ""] ?? "—"}</Badge>
                      <Badge variant="secondary">{fornById[oc?.fornecedor_id ?? ""] ?? "—"}</Badge>
                      {r.nota_fiscal && <Badge variant="outline">NF {r.nota_fiscal}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Recebido em {fmtDataLocal(r.data_recebimento)} • {itens.length} item(ns)
                    </div>
                    {r.observacao && <div className="text-sm mt-1">{r.observacao}</div>}
                  </div>
                  {oc?.fornecedor_id && (
                    <NotaFiscalEntradaDialog
                      ordemCompraId={r.ordem_compra_id}
                      recebimentoId={r.id}
                      fornecedorId={oc.fornecedor_id}
                      onDone={load}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Novo Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem de Compra</Label>
                <Select value={ocId} onValueChange={setOcId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ocsElegiveis.length === 0 && (
                      <div className="p-2 text-sm text-muted-foreground">Nenhuma OC pendente</div>
                    )}
                    {ocsElegiveis.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        OC #{o.numero} — {obraById[o.obra_id] ?? "—"} —{" "}
                        {fornById[o.fornecedor_id] ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <DatePickerField value={data} onChange={(v) => setData(v)} />
                </div>
                <div>
                  <Label>Nota Fiscal</Label>
                  <Input value={nf} onChange={(e) => setNf(e.target.value)} placeholder="NF…" />
                </div>
              </div>
            </div>

            {ocId && itensOcSel.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="text-left p-2">Item</th>
                      <th className="text-right p-2">Pedido</th>
                      <th className="text-right p-2">Já recebido</th>
                      <th className="text-right p-2">Saldo</th>
                      <th className="text-right p-2 w-32">Receber agora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensOcSel.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-2">{i.descricao}</td>
                        <td className="p-2 text-right">{Number(i.quantidade)}</td>
                        <td className="p-2 text-right">{i.recebido}</td>
                        <td className="p-2 text-right font-medium">{i.saldo.toFixed(2)}</td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            max={i.saldo}
                            step="0.01"
                            disabled={i.saldo <= 0}
                            value={qtds[i.id] ?? ""}
                            onChange={(e) => setQtds({ ...qtds, [i.id]: e.target.value })}
                            className="h-8 text-right"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30">
                      <td className="p-2 text-xs text-muted-foreground" colSpan={5}>
                        Total da OC: {fmtBRL(Number(ocById[ocId]?.valor_total ?? 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <Label>Observação</Label>
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Opcional…"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarRecebimento} disabled={saving || !ocId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
