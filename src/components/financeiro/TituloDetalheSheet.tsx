import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Clock3, WalletCards } from "lucide-react";

import { RegistrarBaixaDialog } from "@/components/financeiro/RegistrarBaixaDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/billing";
import { fmtDataHora } from "@/lib/core/date";
import {
  financeiroTitulosKeys,
  listarBaixasTitulo,
  listarEventosTitulo,
  listarRateiosTitulo,
  type BaixaTituloRow,
  type EventoTituloRow,
  type RateioTituloRow,
  type TituloCanonicoResumo,
} from "@/lib/repositories/financeiro-titulos";
import {
  documentoTitulo,
  STATUS_TITULO_LABEL,
  statusVisualTitulo,
} from "@/lib/financeiro/titulos-ui";

interface TituloDetalheSheetProps {
  titulo: TituloCanonicoResumo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podeOperar: boolean;
}

const EVENTO_LABELS: Record<string, string> = {
  titulo_criado: "Título criado",
  titulo_alterado: "Título alterado",
  status_alterado: "Status alterado",
  rateio_criado: "Rateio criado",
  rateio_alterado: "Rateio alterado",
  rateio_removido: "Rateio removido",
  baixa_registrada: "Baixa registrada",
};

function formatarData(value: string | null | undefined): string {
  if (!value) return "—";
  const [ano, mes, dia] = value.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return value;
  return `${dia}/${mes}/${ano}`;
}

function statusVariant(status: ReturnType<typeof statusVisualTitulo>) {
  if (status === "vencido") return "destructive" as const;
  if (status === "parcial") return "secondary" as const;
  return "outline" as const;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function QueryError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

export function TituloDetalheSheet({
  titulo,
  open,
  onOpenChange,
  podeOperar,
}: TituloDetalheSheetProps) {
  const queryClient = useQueryClient();
  const [baixaOpen, setBaixaOpen] = useState(false);
  const tituloId = titulo?.id ?? "";

  const rateiosQuery = useQuery({
    queryKey: financeiroTitulosKeys.rateios(tituloId),
    queryFn: () => listarRateiosTitulo(tituloId),
    enabled: open && !!tituloId,
  });
  const baixasQuery = useQuery({
    queryKey: financeiroTitulosKeys.baixas(tituloId),
    queryFn: () => listarBaixasTitulo(tituloId),
    enabled: open && !!tituloId,
  });
  const eventosQuery = useQuery({
    queryKey: financeiroTitulosKeys.eventos(tituloId),
    queryFn: () => listarEventosTitulo(tituloId),
    enabled: open && !!tituloId,
  });

  const totalRateios = useMemo(
    () => (rateiosQuery.data ?? []).reduce((acc, rateio) => acc + Number(rateio.valor ?? 0), 0),
    [rateiosQuery.data],
  );

  if (!titulo) return null;

  const status = statusVisualTitulo(titulo);
  const podeBaixar =
    podeOperar && titulo.saldo_aberto > 0 && status !== "cancelado" && status !== "baixado";

  async function atualizarAposBaixa() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeiroTitulosKeys.list() }),
      queryClient.invalidateQueries({ queryKey: financeiroTitulosKeys.baixas(titulo.id) }),
      queryClient.invalidateQueries({ queryKey: financeiroTitulosKeys.eventos(titulo.id) }),
    ]);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-4xl">
          <SheetHeader className="space-y-3 border-b pb-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={titulo.tipo === "pagar" ? "secondary" : "outline"}>
                {titulo.tipo === "pagar" ? "A pagar" : "A receber"}
              </Badge>
              <Badge variant={statusVariant(status)}>{STATUS_TITULO_LABEL[status]}</Badge>
              <Badge variant="outline">
                {titulo.origem_tipo === "manual" ? "ERP manual" : titulo.origem_tipo}
              </Badge>
            </div>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <SheetTitle className="text-xl">{documentoTitulo(titulo)}</SheetTitle>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {titulo.nome_fantasia || titulo.nome || "Contraparte não informada"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground">Saldo em aberto</p>
                <p className="text-2xl font-semibold tabular-nums">{brl(titulo.saldo_aberto)}</p>
                {podeBaixar && (
                  <Button className="mt-2" size="sm" onClick={() => setBaixaOpen(true)}>
                    <CircleDollarSign className="mr-2 h-4 w-4" /> Registrar baixa
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="resumo" className="mt-5">
            <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="rateios">Rateios</TabsTrigger>
              <TabsTrigger value="baixas">Baixas</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="mt-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor original</p><p className="mt-1 text-lg font-semibold tabular-nums">{brl(titulo.valor_original)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor líquido</p><p className="mt-1 text-lg font-semibold tabular-nums">{brl(titulo.valor_liquido)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Baixado</p><p className="mt-1 text-lg font-semibold tabular-nums">{brl(titulo.valor_baixado)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Baixas</p><p className="mt-1 text-lg font-semibold tabular-nums">{titulo.qtd_baixas}</p></CardContent></Card>
              </div>

              <dl className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Emissão" value={formatarData(titulo.data_emissao)} />
                <InfoItem label="Competência" value={formatarData(titulo.data_competencia)} />
                <InfoItem label="Vencimento" value={formatarData(titulo.data_vencimento)} />
                <InfoItem label="Previsão de baixa" value={formatarData(titulo.data_previsao_baixa)} />
                <InfoItem label="Tipo de documento" value={titulo.tipo_documento || "—"} />
                <InfoItem label="Número" value={titulo.numero_documento || "—"} />
                <InfoItem label="Série" value={titulo.serie_documento || "—"} />
                <InfoItem label="Parcela" value={titulo.parcela_numero && titulo.parcela_total ? `${titulo.parcela_numero}/${titulo.parcela_total}` : "—"} />
                <InfoItem label="CNPJ/CPF" value={titulo.cnpj_cpf || "—"} />
                <InfoItem label="Centro de custo principal" value={titulo.centro_custo || "Rateado"} />
                <InfoItem label="Origem" value={titulo.origem_tipo === "manual" ? "ERP manual" : titulo.origem_tipo} />
                <InfoItem label="Referência da origem" value={titulo.origem_ref || "—"} />
              </dl>

              {(titulo.historico || titulo.observacao) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4"><p className="text-xs font-medium text-muted-foreground">Histórico</p><p className="mt-2 whitespace-pre-wrap text-sm">{titulo.historico || "—"}</p></div>
                  <div className="rounded-lg border p-4"><p className="text-xs font-medium text-muted-foreground">Observação</p><p className="mt-2 whitespace-pre-wrap text-sm">{titulo.observacao || "—"}</p></div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rateios" className="mt-5 space-y-3">
              {rateiosQuery.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
              ) : rateiosQuery.isError ? (
                <QueryError message="Não foi possível carregar os rateios deste título." />
              ) : (rateiosQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum rateio registrado.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Natureza</TableHead><TableHead>Centro de custo</TableHead><TableHead>Obra</TableHead><TableHead className="text-right">Percentual</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(rateiosQuery.data as RateioTituloRow[]).map((rateio) => (
                        <TableRow key={rateio.id}>
                          <TableCell><div className="font-mono text-xs">{rateio.cod_natureza}</div><div className="max-w-[24rem] text-xs text-muted-foreground">{rateio.desc_natureza || "Sem descrição"}</div></TableCell>
                          <TableCell><div className="text-sm">{rateio.centro_custo}</div><div className="text-xs text-muted-foreground">{rateio.desc_centro_custo || "—"}</div></TableCell>
                          <TableCell>{rateio.obra_codigo || rateio.obra_nome ? <><div className="text-sm">{rateio.obra_codigo || "—"}</div><div className="text-xs text-muted-foreground">{rateio.obra_nome || ""}</div></> : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{rateio.percentual == null ? "—" : `${rateio.percentual.toFixed(2)}%`}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{rateio.valor == null ? "—" : brl(rateio.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Total rateado</span><span className="font-semibold tabular-nums">{brl(totalRateios)}</span></div>
              {rateiosQuery.data?.length && Math.abs(totalRateios - titulo.valor_liquido) > 0.01 ? <p className="text-xs text-destructive">O total dos rateios difere do valor líquido. O banco mantém a validação de integridade como autoridade final.</p> : null}
            </TabsContent>

            <TabsContent value="baixas" className="mt-5 space-y-3">
              {baixasQuery.isLoading ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
              ) : baixasQuery.isError ? (
                <QueryError message="Não foi possível carregar as baixas deste título." />
              ) : (baixasQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center"><WalletCards className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-2 text-sm font-medium">Nenhuma baixa registrada</p><p className="mt-1 text-xs text-muted-foreground">O ledger deste título ainda não possui movimentações.</p></div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead className="text-right">Principal</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Juros</TableHead><TableHead className="text-right">Multa</TableHead><TableHead>Forma / Referência</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(baixasQuery.data as BaixaTituloRow[]).map((baixa) => (
                        <TableRow key={baixa.id}>
                          <TableCell>{formatarData(baixa.data_baixa)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{brl(baixa.valor_principal)}</TableCell>
                          <TableCell className="text-right tabular-nums">{brl(baixa.valor_desconto)}</TableCell>
                          <TableCell className="text-right tabular-nums">{brl(baixa.valor_juros)}</TableCell>
                          <TableCell className="text-right tabular-nums">{brl(baixa.valor_multa)}</TableCell>
                          <TableCell><div className="text-sm">{baixa.forma_pagamento || "—"}</div><div className="text-xs text-muted-foreground">{baixa.referencia || baixa.observacao || ""}</div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-5">
              {eventosQuery.isLoading ? (
                <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : eventosQuery.isError ? (
                <QueryError message="Não foi possível carregar o histórico auditável deste título." />
              ) : (eventosQuery.data?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum evento auditável registrado.</div>
              ) : (
                <ol className="space-y-0">
                  {(eventosQuery.data as EventoTituloRow[]).map((evento, index, todos) => (
                    <li key={evento.id} className="relative flex gap-3 pb-5">
                      {index < todos.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-border" />}
                      <span className="relative mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 border-primary bg-background" />
                      <div className="min-w-0 flex-1 rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div><p className="text-sm font-medium">{EVENTO_LABELS[evento.evento] || evento.evento}</p><p className="mt-0.5 text-xs text-muted-foreground">{evento.ator_login || "Sistema"} · {evento.origem}</p></div>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" /> {fmtDataHora(evento.criado_em)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <RegistrarBaixaDialog titulo={titulo} open={baixaOpen} onOpenChange={setBaixaOpen} onSuccess={atualizarAposBaixa} />
    </>
  );
}

export default TituloDetalheSheet;
