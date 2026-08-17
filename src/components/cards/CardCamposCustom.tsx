/**
 * CardCamposCustom — editor de valores de campos personalizados do card.
 * Aparece quando há campos definidos para o board atual (passado por prop).
 */
import { useQuery } from "@tanstack/react-query";
import { boardsKeys, boardsQueryFns } from "@/hooks/quadros/useBoards";
import { cardsKeys, cardsQueryFns, useUpsertCardCampoValor } from "@/hooks/quadros/useCards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListTree } from "lucide-react";

type Tipo = "texto" | "numero" | "data" | "dropdown" | "checkbox";
interface Campo {
  id: string;
  nome: string;
  tipo: Tipo;
  opcoes: string[];
}

interface Props {
  cardId: string;
  boardId: string | null;
}

export default function CardCamposCustom({ cardId, boardId }: Props) {
  const upsertCampoValorMut = useUpsertCardCampoValor();

  const campos = useQuery({
    enabled: !!boardId,
    queryKey: boardsKeys.campos(boardId ?? ""),
    queryFn: async (): Promise<Campo[]> => {
      const data = await boardsQueryFns.listCamposByBoard(boardId!);
      return data.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        opcoes: Array.isArray(r.opcoes) ? r.opcoes : [],
      }));
    },
  });

  const valores = useQuery({
    enabled: !!cardId,
    queryKey: cardsKeys.camposValores(cardId),
    queryFn: async () => {
      const data = await cardsQueryFns.listCamposValoresByCard(cardId);
      const m = new Map<string, unknown>();
      for (const v of data) m.set(v.campo_id, v.valor);
      return m;
    },
  });

  async function salvar(campoId: string, valor: unknown) {
    await upsertCampoValorMut.mutateAsync({ cardId, campoId, valor });
  }

  const lista = campos.data ?? [];
  if (lista.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
        <ListTree className="h-4 w-4" /> Campos personalizados
      </h3>
      <div className="grid gap-2">
        {lista.map((c) => {
          const v = valores.data?.get(c.id);
          if (c.tipo === "checkbox") {
            return (
              <div key={c.id} className="flex items-center gap-2">
                <Checkbox
                  id={`cc-${c.id}`}
                  checked={!!v}
                  onCheckedChange={(checked) => salvar(c.id, !!checked)}
                />
                <Label htmlFor={`cc-${c.id}`} className="text-xs cursor-pointer">
                  {c.nome}
                </Label>
              </div>
            );
          }
          if (c.tipo === "dropdown") {
            return (
              <div key={c.id} className="space-y-1">
                <Label className="text-xs">{c.nome}</Label>
                <Select value={(v as string) ?? ""} onValueChange={(s) => salvar(c.id, s)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {c.opcoes.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
          return (
            <div key={c.id} className="space-y-1">
              <Label className="text-xs">{c.nome}</Label>
              <Input
                className="h-8 text-xs"
                type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                defaultValue={(v as string | number | undefined) ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value;
                  if (c.tipo === "numero") salvar(c.id, raw === "" ? null : Number(raw));
                  else salvar(c.id, raw === "" ? null : raw);
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
