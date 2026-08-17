import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Loader2, Trash2 } from "lucide-react";
import { useInsumosAtivosBasico } from "@/hooks/suprimentos/useInsumos";
import { useObrasContext } from "@/contexts/ObrasContext";
import { useAddItemEstoque, useRemoveItemEstoque } from "@/hooks/logisticaAtivos/useRomaneios";
import { useEstoqueProvider } from "@/lib/estoque/estoqueProviderFactory";
import type { RomaneioItemEstoque } from "@/hooks/logisticaAtivos/useRomaneioDetalhe";

interface Props {
  romaneioId: string;
  itens: RomaneioItemEstoque[];
  editavel: boolean;
}

export default function RomaneioItensEstoqueField({ romaneioId, itens, editavel }: Props) {
  const { data: insumos = [] } = useInsumosAtivosBasico();
  const { obras } = useObrasContext();
  const estoqueProvider = useEstoqueProvider();
  const addItem = useAddItemEstoque();
  const removeItem = useRemoveItemEstoque();

  const [insumoId, setInsumoId] = useState("");
  const [localOrigem, setLocalOrigem] = useState("");
  const [localDestino, setLocalDestino] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);

  const insumosById = Object.fromEntries(insumos.map((i) => [i.id, i]));
  const obrasById = Object.fromEntries(obras.map((o) => [o.id, o.nome]));

  useEffect(() => {
    let ativo = true;
    if (!insumoId || !localOrigem) {
      setSaldoDisponivel(null);
      return;
    }
    estoqueProvider.consultarSaldo(insumoId, localOrigem).then((saldo) => {
      if (ativo) setSaldoDisponivel(saldo);
    });
    return () => {
      ativo = false;
    };
  }, [insumoId, localOrigem, estoqueProvider]);

  async function adicionar() {
    const qtd = Number(quantidade);
    if (!insumoId || !localOrigem || !localDestino) {
      toast.error("Preencha insumo, origem e destino");
      return;
    }
    if (localOrigem === localDestino) {
      toast.error("Origem e destino devem ser diferentes");
      return;
    }
    if (!(qtd > 0)) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    await addItem.mutateAsync({
      romaneioId,
      item: { insumoId, quantidade: qtd, localOrigem, localDestino },
    });
    setInsumoId("");
    setLocalOrigem("");
    setLocalDestino("");
    setQuantidade("");
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Itens de estoque</Label>
      {itens.length > 0 && (
        <div className="rounded-md border divide-y">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {insumosById[item.insumo_id]?.descricao ?? item.insumo_id} — {item.quantidade}{" "}
                {insumosById[item.insumo_id]?.unidade ?? ""}
                <span className="text-muted-foreground">
                  {" "}
                  ({obrasById[item.local_origem] ?? item.local_origem} →{" "}
                  {obrasById[item.local_destino] ?? item.local_destino})
                </span>
                {item.baixado && <span className="ml-2 text-xs text-green-600">baixado</span>}
              </span>
              {editavel && !item.baixado && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem.mutate({ itemId: item.id, romaneioId })}
                  disabled={removeItem.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {editavel && (
        <div className="grid grid-cols-5 gap-2 items-end">
          <div className="col-span-2">
            <Label className="text-xs">Insumo</Label>
            <Select value={insumoId} onValueChange={setInsumoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {insumos.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo ? `${i.codigo} — ` : ""}
                    {i.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <Select value={localOrigem} onValueChange={setLocalOrigem}>
              <SelectTrigger>
                <SelectValue placeholder="Local" />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saldoDisponivel !== null && (
              <p className="text-xs text-muted-foreground mt-1">Saldo: {saldoDisponivel}</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Destino</Label>
            <Select value={localDestino} onValueChange={setLocalDestino}>
              <SelectTrigger>
                <SelectValue placeholder="Local" />
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
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Qtd"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <Button size="icon" onClick={adicionar} disabled={addItem.isPending}>
              {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "+"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
