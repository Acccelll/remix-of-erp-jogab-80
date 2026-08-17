/**
 * ETAPA 2 · Busca reutilizável de entidades do ERP + criação de vínculo.
 * A validação definitiva é server-side (RPC `card_entity_link_criar`).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuscaEntidades, useCriarVinculo } from "@/hooks/quadros/useExtensoes";
import { getAdapter } from "@/lib/quadros/extensoes/adapters";
import { getExtensao, listExtensoes } from "@/lib/quadros/extensoes/registry";
import { validarNovoVinculo } from "@/lib/quadros/extensoes/vinculos";
import type { CardVinculo } from "@/lib/quadros/extensoes/tipos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardId: string;
  extensoesAtivas: string[];
  vinculosAtuais: CardVinculo[];
  cardTipoCodigo?: string | null;
  podeEditar: boolean;
}

export default function VincularEntidadeDialog({
  open,
  onOpenChange,
  cardId,
  extensoesAtivas,
  vinculosAtuais,
  cardTipoCodigo,
  podeEditar,
}: Props) {
  const disponiveis = useMemo(
    () => listExtensoes().filter((e) => extensoesAtivas.includes(e.codigo)),
    [extensoesAtivas],
  );
  const [extensao, setExtensao] = useState(disponiveis[0]?.codigo ?? "");
  const def = getExtensao(extensao);
  const [entityType, setEntityType] = useState(def?.entityTypes[0] ?? "");
  const [termo, setTermo] = useState("");
  const tipoEfetivo = entityType || def?.entityTypes[0] || "";

  const { data: resultados = [], isLoading } = useBuscaEntidades(tipoEfetivo, termo, open);
  const criar = useCriarVinculo(cardId);

  async function vincular(entityId: string) {
    const check = validarNovoVinculo(
      { extensao_codigo: extensao, entity_type: tipoEfetivo, entity_id: entityId },
      { vinculosAtuais, extensoesAtivas, cardTipoCodigo, podeEditar },
    );
    if (!check.ok) {
      toast.error(check.motivo ?? "Vínculo inválido.");
      return;
    }
    try {
      await criar.mutateAsync({ extensao, entityType: tipoEfetivo, entityId });
      toast.success("Vínculo criado.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Falha ao criar vínculo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular entidade do ERP</DialogTitle>
        </DialogHeader>

        {disponiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma extensão ativa neste quadro. Ative extensões na configuração do quadro.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={extensao}
                onValueChange={(v) => {
                  setExtensao(v);
                  setEntityType(getExtensao(v)?.entityTypes[0] ?? "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Extensão" />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.map((e) => (
                    <SelectItem key={e.codigo} value={e.codigo}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoEfetivo} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de entidade" />
                </SelectTrigger>
                <SelectContent>
                  {(def?.entityTypes ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {getAdapter(t)?.rotulo ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar entidade…"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>

            <div className="max-h-72 space-y-1 overflow-auto rounded-md border p-1">
              {isLoading && (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              )}
              {!isLoading && resultados.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhuma entidade encontrada.</p>
              )}
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={!podeEditar || criar.isPending}
                  onClick={() => vincular(r.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                >
                  <span className="truncate">
                    {getAdapter(r.entityType)?.getEntityDisplayName(r) ?? r.nome}
                  </span>
                  {r.arquivada && <Badge variant="outline">arquivada</Badge>}
                </button>
              ))}
            </div>
            {!podeEditar && (
              <p className="text-xs text-muted-foreground">
                Você não tem permissão para criar vínculos neste card.
              </p>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
