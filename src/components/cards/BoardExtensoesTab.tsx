/**
 * ETAPA 2 · Aba de extensões na configuração do quadro.
 * Ativar/desativar por quadro, mostrar resumo na frente do card e ordem do painel.
 */
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAtivarExtensao,
  useBoardExtensoes,
  useConfigurarExtensao,
} from "@/hooks/quadros/useExtensoes";
import { listExtensoes } from "@/lib/quadros/extensoes/registry";

export default function BoardExtensoesTab({ boardId }: { boardId: string }) {
  const { data: cfgs = [], isLoading } = useBoardExtensoes(boardId);
  const ativar = useAtivarExtensao(boardId);
  const configurar = useConfigurarExtensao(boardId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const byCodigo = new Map(cfgs.map((c) => [c.extensao_codigo, c]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Extensões conectam cards deste quadro a entidades do ERP. Desativar não apaga vínculos —
        apenas oculta o painel.
      </p>
      {listExtensoes().map((ext) => {
        const cfg = byCodigo.get(ext.codigo);
        const ativo = !!cfg?.ativo;
        return (
          <div key={ext.codigo} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{ext.nome}</div>
                <p className="text-xs text-muted-foreground">{ext.descricao}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  módulo {ext.modulo} · v{ext.versao}
                </p>
              </div>
              <Switch
                checked={ativo}
                onCheckedChange={async (v) => {
                  try {
                    await ativar.mutateAsync({ codigo: ext.codigo, ativo: v });
                  } catch (e) {
                    toast.error((e as Error)?.message ?? "Falha ao alterar extensão.");
                  }
                }}
              />
            </div>

            {ativo && (
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t pt-3">
                {ext.suportaResumo && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`resumo-${ext.codigo}`}
                      checked={cfg?.mostrar_resumo ?? true}
                      onCheckedChange={(v) =>
                        configurar.mutate({ codigo: ext.codigo, patch: { mostrar_resumo: v } })
                      }
                    />
                    <Label htmlFor={`resumo-${ext.codigo}`} className="text-xs">
                      Mostrar resumo na frente do card
                    </Label>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ordem-${ext.codigo}`} className="text-xs">
                    Ordem do painel
                  </Label>
                  <Input
                    id={`ordem-${ext.codigo}`}
                    type="number"
                    className="h-8 w-20"
                    defaultValue={cfg?.ordem ?? ext.painelOrdem}
                    onBlur={(e) =>
                      configurar.mutate({
                        codigo: ext.codigo,
                        patch: { ordem: Number(e.target.value) || ext.painelOrdem },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
