/**
 * ETAPA 2 · Painel de vínculos do card.
 *
 * Isolamento: cada painel de extensão é renderizado dentro de um limite de erro
 * — falha de uma extensão não derruba o card. Nenhuma regra de domínio aqui.
 */
import { Component, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import VincularEntidadeDialog from "./VincularEntidadeDialog";
import {
  useBoardExtensoes,
  useCardVinculos,
  useDefinirVinculoPrincipal,
  useExecutarAcaoExtensao,
  useRemoverVinculo,
} from "@/hooks/quadros/useExtensoes";
import { getAdapter } from "@/lib/quadros/extensoes/adapters";
import { acoesDaExtensao, getExtensao } from "@/lib/quadros/extensoes/registry";
import {
  extensoesEfetivas,
  nomeExibivel,
  ordenarVinculos,
  painesDoCard,
  rotuloSituacao,
} from "@/lib/quadros/extensoes/vinculos";
import type { CardVinculo } from "@/lib/quadros/extensoes/tipos";

class PainelErrorBoundary extends Component<
  { nome: string; children: ReactNode },
  { erro: boolean }
> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    if (this.state.erro) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          Extensão “{this.props.nome}” indisponível no momento.
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

interface Props {
  cardId: string;
  boardId: string | null | undefined;
  podeEditar: boolean;
  cardTipoCodigo?: string | null;
  extensoesPadraoDoTipo?: string[];
}

export default function CardVinculosSection({
  cardId,
  boardId,
  podeEditar,
  cardTipoCodigo,
  extensoesPadraoDoTipo = [],
}: Props) {
  const { data: boardExts = [] } = useBoardExtensoes(boardId);
  const { data: vinculos = [], isLoading, isError } = useCardVinculos(cardId);
  const remover = useRemoverVinculo(cardId);
  const principal = useDefinirVinculoPrincipal(cardId);
  const acao = useExecutarAcaoExtensao(cardId);
  const [abrirVincular, setAbrirVincular] = useState(false);

  const paineis = useMemo(
    () => painesDoCard(boardExts, cardTipoCodigo),
    [boardExts, cardTipoCodigo],
  );
  const ativas = useMemo(
    () => extensoesEfetivas(boardExts, extensoesPadraoDoTipo),
    [boardExts, extensoesPadraoDoTipo],
  );
  const porExtensao = useMemo(() => {
    const m = new Map<string, CardVinculo[]>();
    for (const v of ordenarVinculos(vinculos)) {
      const arr = m.get(v.extensao_codigo) ?? [];
      arr.push(v);
      m.set(v.extensao_codigo, arr);
    }
    return m;
  }, [vinculos]);

  if (!boardId) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Vínculos com o ERP</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={!podeEditar || paineis.length === 0}
          onClick={() => setAbrirVincular(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Vincular
        </Button>
      </div>

      {isLoading && <Skeleton className="h-20 w-full" />}
      {isError && (
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os vínculos. O restante do card segue funcionando.
        </p>
      )}

      {!isLoading && paineis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma extensão ativa neste quadro.
        </p>
      )}

      {paineis.map((codigo) => {
        const def = getExtensao(codigo)!;
        const lista = porExtensao.get(codigo) ?? [];
        return (
          <PainelErrorBoundary key={codigo} nome={def.nome}>
            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{def.nome}</span>
                <div className="flex gap-1">
                  {acoesDaExtensao(codigo).map((a) => (
                    <Button
                      key={a.codigo}
                      size="sm"
                      variant="ghost"
                      disabled={a.exigeEdicao && !podeEditar}
                      onClick={async () => {
                        try {
                          await acao.mutateAsync({ extensao: codigo, acao: a.codigo });
                          toast.success(`${a.rotulo}: registrado.`);
                        } catch (e) {
                          toast.error((e as Error)?.message ?? "Falha na ação.");
                        }
                      }}
                    >
                      {a.rotulo}
                    </Button>
                  ))}
                </div>
              </div>

              {lista.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem vínculos.</p>
              ) : (
                <ul className="space-y-1">
                  {lista.map((v) => {
                    const st = rotuloSituacao(v);
                    const rota = v.acesso_permitido
                      ? (getAdapter(v.entity_type)?.getEntityRoute(v.entity_id) ?? null)
                      : null;
                    return (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-accent/50"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {v.is_primary && <Star className="h-3.5 w-3.5 text-amber-500" />}
                          <span className="truncate">{nomeExibivel(v)}</span>
                          {st.tom !== "ok" && (
                            <Badge variant={st.tom === "erro" ? "destructive" : "outline"}>
                              {st.rotulo}
                            </Badge>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {rota && (
                            <Button asChild size="icon" variant="ghost" title="Abrir no ERP">
                              <Link to={rota}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {!v.archived_at && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Definir como principal"
                                disabled={!podeEditar || v.is_primary}
                                onClick={() => principal.mutate(v.id)}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Remover vínculo"
                                disabled={!podeEditar}
                                onClick={() => remover.mutate({ linkId: v.id })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </PainelErrorBoundary>
        );
      })}

      <VincularEntidadeDialog
        open={abrirVincular}
        onOpenChange={setAbrirVincular}
        cardId={cardId}
        extensoesAtivas={ativas}
        vinculosAtuais={vinculos}
        cardTipoCodigo={cardTipoCodigo}
        podeEditar={podeEditar}
      />
    </section>
  );
}
