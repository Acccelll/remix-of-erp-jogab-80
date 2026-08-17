// Histórico de cargas de ponto (RHiD e CSV) que cobrem o período do hub.
//
// Antes só existia no instante da importação: quem sincronizou, quando e com quantos
// registros sumia junto com o diálogo. Sem isso, não dá para saber se os números da
// Visão Geral estão velhos.
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryState } from "@/components/common/QueryState";
import RecursoPendente from "@/components/dp/RecursoPendente";
import { usePontoImportacoes, type PontoImportacao } from "@/hooks/dp/usePonto";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { fmtData, fmtDataHora } from "@/lib/core/date";

/** A sincronização RHiD nomeia a carga `rhid_apuracao_<ini>_a_<fim>.json`. */
function origem(arquivo: string): "RHiD" | "CSV" {
  return arquivo.startsWith("rhid_apuracao_") ? "RHiD" : "CSV";
}

export default function PontoSincronizacoes() {
  const { inicio, fim } = usePontoFiltros();
  const query = usePontoImportacoes(inicio, fim);

  const linhas = useMemo(
    () =>
      [...(query.data ?? [])].sort((a: PontoImportacao, b: PontoImportacao) =>
        b.importado_em.localeCompare(a.importado_em),
      ),
    [query.data],
  );

  if (isRecursoIndisponivel(query.error)) {
    return (
      <RecursoPendente
        erro={query.error}
        descricao="Depois de publicado, esta aba lista todas as cargas de ponto do período — origem, período coberto, volume e responsável."
      />
    );
  }

  return (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={linhas}
      onRetry={() => query.refetch()}
      isEmpty={(xs) => xs.length === 0}
      empty={
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma carga de ponto registrada para este período.
        </Card>
      }
    >
      {(xs) => (
        <Card className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Período coberto</TableHead>
                <TableHead className="text-right">Registros</TableHead>
                <TableHead className="text-right">Colaboradores</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Arquivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {xs.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-xs tabular-nums">
                    {fmtDataHora(imp.importado_em)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={origem(imp.arquivo_nome) === "RHiD" ? "default" : "secondary"}>
                      {origem(imp.arquivo_nome)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {fmtData(imp.periodo_inicio)} — {fmtData(imp.periodo_fim)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{imp.total_registros}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {imp.total_colaboradores}
                  </TableCell>
                  <TableCell className="text-xs">{imp.importado_por ?? "—"}</TableCell>
                  <TableCell
                    className="text-xs font-mono text-muted-foreground max-w-[220px] truncate"
                    title={imp.arquivo_nome}
                  >
                    {imp.arquivo_nome}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Sincronizar o mesmo período novamente substitui a carga anterior — não há duplicidade.
          </p>
        </Card>
      )}
    </QueryState>
  );
}
