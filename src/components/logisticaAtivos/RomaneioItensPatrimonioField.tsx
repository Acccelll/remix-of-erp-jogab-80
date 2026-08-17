import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { usePatrimoniosContext } from "@/contexts/PatrimoniosContext";
import {
  useAddItemPatrimonio,
  useRemoveItemPatrimonio,
} from "@/hooks/logisticaAtivos/useRomaneios";
import type { RomaneioItemPatrimonio } from "@/hooks/logisticaAtivos/useRomaneioDetalhe";

interface Props {
  romaneioId: string;
  itens: RomaneioItemPatrimonio[];
  obraOrigemId: string | null;
  editavel: boolean;
}

export default function RomaneioItensPatrimonioField({
  romaneioId,
  itens,
  obraOrigemId,
  editavel,
}: Props) {
  const { patrimonios } = usePatrimoniosContext();
  const addItem = useAddItemPatrimonio();
  const removeItem = useRemoveItemPatrimonio();
  const [patrimonioId, setPatrimonioId] = useState("");

  const jaIncluidos = new Set(itens.map((i) => i.patrimonio_id));
  const disponiveis = patrimonios.filter(
    (p) => p.ativo && !jaIncluidos.has(p.id) && (!obraOrigemId || p.obraAtualId === obraOrigemId),
  );

  async function adicionar() {
    if (!patrimonioId) {
      toast.error("Selecione um patrimônio");
      return;
    }
    const p = patrimonios.find((x) => x.id === patrimonioId);
    await addItem.mutateAsync({
      romaneioId,
      item: { patrimonioId, patrimonioCodigo: p?.codigo, patrimonioNome: p?.nome },
    });
    setPatrimonioId("");
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Patrimônios transportados</Label>
      {itens.length > 0 && (
        <div className="rounded-md border divide-y">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {item.patrimonio_codigo ? `${item.patrimonio_codigo} — ` : ""}
                {item.patrimonio_nome ?? item.patrimonio_id}
                {item.mobilizado && <span className="ml-2 text-xs text-green-600">mobilizado</span>}
                {item.mobilizacao_erro && (
                  <span className="ml-2 text-xs text-destructive">{item.mobilizacao_erro}</span>
                )}
              </span>
              {editavel && !item.mobilizado && (
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
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs">Patrimônio {obraOrigemId ? "(na obra origem)" : ""}</Label>
            <Select value={patrimonioId} onValueChange={setPatrimonioId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} — {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={adicionar} disabled={addItem.isPending} className="gap-2">
            {addItem.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
