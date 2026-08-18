import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FilePlus2, Search, X } from "lucide-react";

import { TituloDetalheSheet } from "@/components/financeiro/TituloDetalheSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import {
  calcularKpisTitulos,
  documentoTitulo,
  FILTROS_TITULOS_VAZIOS,
  filtrarTitulos,
  STATUS_TITULO_LABEL,
  statusVisualTitulo,
  temFiltrosTitulosAtivos,
  type FiltrosTitulos,
  type StatusFiltroTitulo,
  type TipoFiltroTitulo,
} from "@/lib/financeiro/titulos-ui";
import {
  financeiroTitulosKeys,
  listarTitulosCanonicos,
  type TituloCanonicoResumo,
} from "@/lib/repositories/financeiro-titulos";

interface TitulosOperacionaisPanelProps {
  onNovoTitulo: () => void;
  podeCriar: boolean;
  podeOperar: boolean;
}

function formatarData(value: string): string {
  const [ano, mes, dia] = value.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : value;
}

function statusVariant(status: ReturnType<typeof statusVisualTitulo>) {
  if (status === "vencido") return "destructive" as const;
  if (status === "parcial") return "secondary" as const;
  return "outline" as const;
}

function KpiCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}

function origemLabel(origem: string): string {
  if (origem === "manual") return "ERP manual";
  if (origem === "totvs") return "TOTVS";
  return origem || "ERP";
}

export function TitulosOperacionaisPanel({
  onNovoTitulo,
  podeCriar,
  podeOperar,
}: TitulosOperacionaisPanelProps) {
  const [filtros, setFiltros] = useState<FiltrosTitulos>(FILTROS_TITULOS_VAZIOS);
  const [tituloSelecionadoId, setTituloSelecionadoId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: financeiroTitulosKeys.list(),
    queryFn: listarTitulosCanonicos,
  });

  const filtrados = useMemo(
    () => filtrarTitulos(query.data ?? [], filtros),
    [query.data, filtros],
  );
  const kpis = useMemo(() => calcularKpisTitulos(filtrados), [filtrados]);
  const filtrosAtivos = temFiltrosTitulosAtivos(filtros);
  const tituloSelecionado = useMemo(
    () => (query.data ?? []).find((titulo) => titulo.id === tituloSelecionadoId) ?? null,
    [query.data, tituloSelecionadoId],
  );

  function patchFiltros(patch: Partial<FiltrosTitulos>) {
    setFiltros((atual) => ({ ...atual, ...patch }));
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6">
          <p className="font-medium text-destructive">Não foi possível carregar os títulos ERP.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(query.error as Error)?.message || "Falha ao consultar o núcleo financeiro canônico."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalTitulos = query.data?.length ?? 0;

  return (
    <div className="space-y-4">
      {totalTitulos > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="A pagar em aberto" value={brl(kpis.pagarAberto)} />
          <KpiCard label="A receber em aberto" value={brl(kpis.receberAberto)} />
          <KpiCard
            label="Vencidos"
            value={brl(kpis.vencidosValor)}
            helper={`${kpis.vencidosQuantidade} título(s)`}
          />
          <KpiCard
            label="Baixado no filtro"
            value={brl(kpis.valorBaixado)}
            helper={`${kpis.quantidade} título(s) no conjunto`}
          />
        </div>
      )}

      {totalTitulos > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_10rem_10rem_auto] xl:items-end">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Buscar títulos"
                  className="pl-9"
                  placeholder="Documento, contraparte, CNPJ/CPF, histórico…"
                  value={filtros.busca}
                  onChange={(event) => patchFiltros({ busca: event.target.value })}
                />
              </div>
              <Select
                value={filtros.tipo}
                onValueChange={(value) => patchFiltros({ tipo: value as TipoFiltroTitulo })}
              >
                <SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="pagar">A pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filtros.status}
                onValueChange={(value) => patchFiltros({ status: value as StatusFiltroTitulo })}
              >
                <SelectTrigger aria-label="Filtrar por status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="aberto">Em aberto</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="baixado">Baixado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                aria-label="Vencimento inicial"
                value={filtros.vencimentoInicial}
                onChange={(event) => patchFiltros({ vencimentoInicial: event.target.value })}
              />
              <Input
                type="date"
                aria-label="Vencimento final"
                value={filtros.vencimentoFinal}
                onChange={(event) => patchFiltros({ vencimentoFinal: event.target.value })}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={!filtrosAtivos}
                onClick={() => setFiltros(FILTROS_TITULOS_VAZIOS)}
              >
                <X className="mr-1 h-4 w-4" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {totalTitulos === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full bg-muted p-4">
              <FilePlus2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Nenhum título ERP lançado</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Esta área mostra apenas títulos operacionais do ERP. Importações e snapshots do TOTVS continuam separados na aba de análise.
            </p>
            {podeCriar && (
              <Button className="mt-5" onClick={onNovoTitulo}>
                <FilePlus2 className="mr-2 h-4 w-4" /> Lançar primeiro título
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/60" />
            <h2 className="mt-3 font-semibold">Nenhum título encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste ou limpe os filtros para ampliar a consulta.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setFiltros(FILTROS_TITULOS_VAZIOS)}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="font-medium">Títulos ERP</h2>
                <p className="text-xs text-muted-foreground">
                  {filtrados.length} de {totalTitulos} título(s)
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contraparte</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Origem</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Baixado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((titulo: TituloCanonicoResumo) => {
                    const status = statusVisualTitulo(titulo);
                    return (
                      <TableRow
                        key={titulo.id}
                        className="cursor-pointer"
                        onClick={() => setTituloSelecionadoId(titulo.id)}
                      >
                        <TableCell>
                          <Badge variant={titulo.tipo === "pagar" ? "secondary" : "outline"}>
                            {titulo.tipo === "pagar" ? "A pagar" : "A receber"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{documentoTitulo(titulo)}</div>
                          {titulo.parcela_numero && titulo.parcela_total && (
                            <div className="text-xs text-muted-foreground">Parcela {titulo.parcela_numero}/{titulo.parcela_total}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[18rem] truncate">{titulo.nome_fantasia || titulo.nome || "—"}</div>
                          {titulo.cnpj_cpf && <div className="text-xs text-muted-foreground">{titulo.cnpj_cpf}</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatarData(titulo.data_vencimento)}</TableCell>
                        <TableCell><Badge variant={statusVariant(status)}>{STATUS_TITULO_LABEL[status]}</Badge></TableCell>
                        <TableCell className="hidden lg:table-cell"><Badge variant="outline">{origemLabel(titulo.origem_tipo)}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{brl(titulo.valor_liquido)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">{brl(titulo.valor_baixado)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{brl(titulo.saldo_aberto)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ver detalhes de ${documentoTitulo(titulo)}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setTituloSelecionadoId(titulo.id);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <TituloDetalheSheet
        titulo={tituloSelecionado}
        open={!!tituloSelecionado}
        onOpenChange={(open) => !open && setTituloSelecionadoId(null)}
        podeOperar={podeOperar}
      />
    </div>
  );
}

export default TitulosOperacionaisPanel;
