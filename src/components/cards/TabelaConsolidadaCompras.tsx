/**
 * Tabela consolidada global de alertas de prazo + atribuição de grupo de negociação.
 * Reaproveitada por /suprimentos/compras (aba consolidado) e pela rota legada
 * /suprimentos/alertas.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { useAlertasPrazo } from "@/hooks/quadros/useAlertasPrazo";
import { useUpdateGrupoNegociacaoCards } from "@/hooks/quadros/useCards";
import { contarPorSeveridade, type Severidade } from "@/lib/recursos/alertas-prazo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CardRecursoDialog } from "@/components/cards/CardRecursoDialog";
import { GrupoNegociacaoSelect } from "@/components/cards/GrupoNegociacaoSelect";
import { cn } from "@/lib/utils";

const FILTROS: { key: Severidade | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "vencido", label: "Vencidos" },
  { key: "urgente", label: "Urgentes (≤3d)" },
  { key: "proximo", label: "Próximos (≤7d)" },
];

function corSev(sev: Severidade) {
  if (sev === "vencido" || sev === "urgente")
    return "bg-destructive/15 text-destructive border-destructive/40";
  if (sev === "proximo")
    return "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40";
  return "bg-muted text-muted-foreground";
}

const LABEL_SEV: Record<Severidade, string> = {
  vencido: "Vencido",
  urgente: "Urgente",
  proximo: "Próximo",
  ok: "OK",
};

export function TabelaConsolidadaCompras() {
  const { obras } = useCatalogos();
  const atribuirGrupoMut = useUpdateGrupoNegociacaoCards();
  const obraNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of obras) m.set(o.id, o.nome);
    return m;
  }, [obras]);
  const { data, isLoading } = useAlertasPrazo();
  const [filtro, setFiltro] = useState<Severidade | "todos">("todos");
  const [cardAberto, setCardAberto] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const cnt = data ? contarPorSeveridade(data) : { vencido: 0, urgente: 0, proximo: 0, ok: 0 };
  const lista = useMemo(() => {
    const base = data ?? [];
    if (filtro === "todos") return base.filter((a) => a.severidade !== "ok");
    return base.filter((a) => a.severidade === filtro);
  }, [data, filtro]);

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function atribuirGrupo(grupoId: string | null) {
    if (selecionados.size === 0) return;
    try {
      await atribuirGrupoMut.mutateAsync({ ids: [...selecionados], grupoId });
    } catch {
      return;
    }
    toast.success(
      grupoId
        ? `${selecionados.size} card(s) atribuído(s) ao grupo`
        : `${selecionados.size} card(s) removido(s) do grupo`,
    );
    setSelecionados(new Set());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const ativo = filtro === f.key;
          const count = f.key === "todos" ? cnt.vencido + cnt.urgente + cnt.proximo : cnt[f.key];
          return (
            <Button
              key={f.key}
              size="sm"
              variant={ativo ? "default" : "outline"}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {selecionados.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-md border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">{selecionados.size} card(s) selecionado(s)</span>
          <div className="min-w-[240px] flex-1 max-w-md">
            <GrupoNegociacaoSelect value={null} onChange={(id) => atribuirGrupo(id)} />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            <X className="h-4 w-4" /> Cancelar
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : lista.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum alerta nesta categoria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Trilho</TableHead>
                    <TableHead className="text-right">Prazo</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                    <TableHead>Severidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((a) => {
                    const sel = selecionados.has(a.card_id);
                    return (
                      <TableRow
                        key={`${a.card_id}-${a.trilho}`}
                        className={cn("cursor-pointer", sel && "bg-primary/5")}
                        onClick={() => setCardAberto(a.card_id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={sel} onCheckedChange={() => toggleSel(a.card_id)} />
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">#{a.numero}</div>
                          <div className="font-medium">{a.titulo}</div>
                        </TableCell>
                        <TableCell>
                          {a.obra_id ? (
                            <Link
                              to={`/obras/${a.obra_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {obraNome.get(a.obra_id) ?? "Obra"}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{a.tipo_recurso}</TableCell>
                        <TableCell className="text-xs">{a.trilho}</TableCell>
                        <TableCell className="text-right text-xs">{a.prazo}</TableCell>
                        <TableCell className="text-right font-medium">{a.dias}d</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", corSev(a.severidade))}
                          >
                            {LABEL_SEV[a.severidade]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {cardAberto && (
        <CardRecursoDialog
          cardId={cardAberto}
          open={!!cardAberto}
          onOpenChange={(o) => !o && setCardAberto(null)}
        />
      )}
    </div>
  );
}
