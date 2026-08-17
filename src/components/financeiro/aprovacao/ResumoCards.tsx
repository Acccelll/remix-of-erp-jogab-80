import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_OPTIONS, SETORES, type Solicitacao } from "./types";
import { formatBRL } from "@/lib/core/currency";

export function ResumoCards({
  filtered,
  statusSelecionados,
  setoresSelecionados,
  obrasSelecionadas,
  obrasCount,
}: {
  filtered: Solicitacao[];
  statusSelecionados: Set<string>;
  setoresSelecionados: Set<string>;
  obrasSelecionadas: Set<string>;
  obrasCount: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total de Solicitações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Valor Total</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatBRL(filtered.reduce((s, x) => s + (Number(x.valor) || 0), 0))}
          </p>

        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Filtros Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">
            {statusSelecionados.size >= STATUS_OPTIONS.length
              ? "Todos os status"
              : `${statusSelecionados.size} status`}
            {", "}
            {setoresSelecionados.size >= SETORES.length
              ? "todos os setores"
              : `${setoresSelecionados.size} setor${setoresSelecionados.size === 1 ? "" : "es"}`}
            {", "}
            {obrasSelecionadas.size >= obrasCount + 1
              ? "todas as obras"
              : `${obrasSelecionadas.size} obra(s)`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
