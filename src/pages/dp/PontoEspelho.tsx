// Espelho de Ponto — o dia a dia de uma pessoa no período.
//
// É a tela que responde "por que o Fulano deu falta no dia 12?": além das
// colunas apuradas, mostra o JSON que a RHiD devolveu para aquele dia, que
// antes era descartado na importação.
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Kpi } from "@/components/common/Kpi";
import { QueryState } from "@/components/common/QueryState";
import RecursoPendente from "@/components/dp/RecursoPendente";
import { usePontoEspelho } from "@/hooks/dp/usePontoEspelho";
import { usePontoFiltros } from "@/hooks/dp/usePontoFiltros";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { isRecursoIndisponivel } from "@/lib/ponto/disponibilidade";
import { calcularKpis, heTotalMin } from "@/lib/ponto/analise";
import { formatMinutes } from "@/lib/ponto/formatMinutes";
import { fmtData } from "@/lib/core/date";
import type { PontoRegistroRow } from "@/lib/repositories/ponto";
import { Braces } from "lucide-react";

function marcadores(r: PontoRegistroRow) {
  const tags: Array<{ texto: string; tom: "destructive" | "secondary" | "outline" }> = [];
  if (r.falta) tags.push({ texto: "Falta", tom: "destructive" });
  if (r.atestado) tags.push({ texto: "Atestado", tom: "secondary" });
  if (r.marcacao_invalida) tags.push({ texto: "Marcação inválida", tom: "outline" });
  if (r.interjornada_min > 0) tags.push({ texto: "Interjornada", tom: "outline" });
  return tags;
}

export default function PontoEspelho() {
  const { colaboradores } = useCatalogos();
  const { inicio, fim, colaboradorId, setColaboradorId } = usePontoFiltros();
  const [diaAberto, setDiaAberto] = useState<PontoRegistroRow | null>(null);

  const query = usePontoEspelho({ inicio, fim, colaboradorId: colaboradorId || null });

  const nomePorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c.nome])),
    [colaboradores],
  );
  const dias = useMemo(() => query.data ?? [], [query.data]);
  const kpis = useMemo(() => calcularKpis(dias, nomePorId), [dias, nomePorId]);
  const bancoFinal = dias.length > 0 ? dias[dias.length - 1].banco_saldo_min : 0;

  if (isRecursoIndisponivel(query.error)) {
    return (
      <RecursoPendente
        erro={query.error}
        migracao="2026_08_03_ponto_ondas.sql"
        descricao="O espelho lista o dia a dia do colaborador; o painel com o retorno cru da RHiD depende da coluna `payload`."
      />
    );
  }

  if (!colaboradorId) {
    return (
      <Card className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Escolha um colaborador para ver o espelho do período.
        </p>
        <select
          value=""
          onChange={(e) => setColaboradorId(e.target.value)}
          className="h-10 rounded-md border px-2 bg-background min-w-[260px]"
        >
          <option value="">Selecione…</option>
          {[...colaboradores]
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={dias}
        onRetry={() => query.refetch()}
        isEmpty={(xs) => xs.length === 0}
        empty={
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhum dia apurado para {nomePorId.get(colaboradorId) ?? "este colaborador"} no período.
          </Card>
        }
      >
        {(xs) => (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi label="Dias apurados" value={xs.length} size="lg" />
              <Kpi
                label="Horas extras"
                value={formatMinutes(kpis.heTotalMin)}
                tone="warning"
                size="lg"
                tabularNums
              />
              <Kpi
                label="Absenteísmo"
                value={`${kpis.absenteismoPct.toFixed(1)}%`}
                tone="danger"
                size="lg"
              />
              <Kpi
                label="Banco no fim do período"
                value={formatMinutes(bancoFinal)}
                tone={bancoFinal < 0 ? "danger" : "success"}
                size="lg"
                tabularNums
              />
            </div>

            <Card className="p-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dia</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Trabalhado</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead className="text-right">HE</TableHead>
                    <TableHead className="text-right">Banco</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {xs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs tabular-nums">{fmtData(r.data)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMinutes(r.horas_previstas_min)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMinutes(r.horas_trabalhadas_min)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMinutes(r.horas_falta_min)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMinutes(heTotalMin(r))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMinutes(r.banco_saldo_min)}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {marcadores(r).map((t) => (
                          <Badge key={t.texto} variant={t.tom} className="text-[10px]">
                            {t.texto}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {r.observacao ?? "—"}
                      </TableCell>
                      <TableCell>
                        {r.payload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ver o retorno cru da RHiD para este dia"
                            onClick={() => setDiaAberto(r)}
                          >
                            <Braces className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {xs.every((r) => !r.payload) && (
                <p className="text-xs text-muted-foreground mt-3">
                  Os dias deste período foram importados antes da captura do retorno cru — o painel
                  de origem aparece nas próximas sincronizações.
                </p>
              )}
            </Card>
          </>
        )}
      </QueryState>

      <Sheet open={!!diaAberto} onOpenChange={(aberto) => !aberto && setDiaAberto(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Retorno da RHiD — {diaAberto ? fmtData(diaAberto.data) : ""}</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-2">
            Campos do motor ACJEF exatamente como vieram da API. Campo relevante que apareça aqui e
            não na tabela acima é caso de acrescentar um alias em <code>mapApuracao.ts</code>.
          </p>
          <pre className="text-[11px] bg-muted p-3 rounded mt-3 overflow-auto">
            {diaAberto?.payload ? formatarJson(diaAberto.payload) : "—"}
          </pre>
          {diaAberto?.rhid_id_person ? (
            <p className="text-xs text-muted-foreground mt-2">
              idPerson na RHiD: <span className="font-mono">{diaAberto.rhid_id_person}</span>
            </p>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** O payload é texto vindo do banco; se não for JSON válido, mostra como está. */
function formatarJson(bruto: string): string {
  try {
    return JSON.stringify(JSON.parse(bruto), null, 2);
  } catch {
    return bruto;
  }
}
