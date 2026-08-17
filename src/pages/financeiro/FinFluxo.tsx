import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { STORAGE_KEYS } from "@/lib/core/storage/keys";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter } from "lucide-react";
import { bmsPrevistasRepo } from "@/lib/repositories/obraDetalhe";
import { toast } from "sonner";
import { obrasRepo } from "@/lib/repositories/obras";
import { useClientesResumo } from "@/hooks/crm/useClientes";
import { notasFiscaisRepo, recebimentosRepo } from "@/lib/repositories/medicoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { brl } from "@/lib/billing";
import { addDays, addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "@/components/ui/chart";
import { ContasReceberSection } from "@/components/financeiro/receber/ContasReceberSection";
import { StatusChips } from "@/components/financeiro/common/StatusChips";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCarrinhoStore } from "@/hooks/financeiro/useCarrinhoStore";
import { ShoppingCart, Trash2 as TrashIcon } from "lucide-react";

const BMS_FECHADA = new Set(["fechada", "faturada", "paga", "cancelada"]);
const bmsAberta = (b: any) => !BMS_FECHADA.has(String(b.status));

/** Baldes de recebíveis — mesmo padrão dos chips de status da aba de dívidas. */
type RecBucket = "atrasado" | "hoje" | "d30" | "d60" | "d90" | "futuro";
const REC_BUCKETS: { value: RecBucket; label: string }[] = [
  { value: "atrasado", label: "Atrasado" },
  { value: "hoje", label: "Vence hoje" },
  { value: "d30", label: "Até 30 dias" },
  { value: "d60", label: "31-60 dias" },
  { value: "d90", label: "61-90 dias" },
  { value: "futuro", label: "Acima de 90 dias" },
];

function classificarRecebivel(dataIso: string | null | undefined, hoje: Date): RecBucket | null {
  if (!dataIso) return null;
  const d = parseISO(String(dataIso).slice(0, 10));
  if (!isFinite(d.getTime())) return null;
  const dias = Math.floor(
    (d.getTime() - new Date(format(hoje, "yyyy-MM-dd")).getTime()) / 86400000,
  );
  if (dias < 0) return "atrasado";
  if (dias === 0) return "hoje";
  if (dias <= 30) return "d30";
  if (dias <= 60) return "d60";
  if (dias <= 90) return "d90";
  return "futuro";
}

function FluxoPage() {
  // Recorte do fluxo é lembrado entre sessões — o usuário volta ao mesmo corte.
  const [obraId, setObraId] = useLocalStorageState<string>(
    `${STORAGE_KEYS.filtrosFinFluxo}:obra`,
    "all",
  );
  const [clienteId, setClienteId] = useLocalStorageState<string>(
    `${STORAGE_KEYS.filtrosFinFluxo}:cliente`,
    "all",
  );
  const [mesesQtd, setMesesQtd] = useLocalStorageState<number>(
    `${STORAGE_KEYS.filtrosFinFluxo}:meses`,
    12,
  );
  const [recebSel, setRecebSel] = useState<Set<RecBucket>>(
    () => new Set(REC_BUCKETS.map((b) => b.value)),
  );
  const [kpiSel, setKpiSel] = useState<null | {
    tipo: "j30" | "j60" | "j90" | "atrasado";
    titulo: string;
  }>(null);
  const [inicio, setInicio] = useState<string>(
    format(startOfMonth(addMonths(new Date(), -2)), "yyyy-MM-dd"),
  );
  const {
    itens: carrinho,
    clear: clearCarrinho,
    removeItem: removeFromCarrinho,
  } = useCarrinhoStore();

  const { data: clientesResumo = [] } = useClientesResumo();
  const { data } = useQuery({
    queryKey: ["fluxo"],
    queryFn: async () => {
      const wrap = <T,>(p: Promise<T>) =>
        p
          .then((data) => ({ data, error: null as any }))
          .catch((error) => ({ data: [] as any, error }));
      const [r, n, o, b, f] = await Promise.all([
        wrap(recebimentosRepo.listComObras()),
        wrap(notasFiscaisRepo.listComObras()),
        wrap(obrasRepo.listComClienteId()),
        wrap(bmsPrevistasRepo.listComObras()),
        wrap(notasFiscaisRepo.listFaturamentoNfse()),
      ]);
      return {
        receb: r.data ?? [],
        nfs: n.data ?? [],
        obras: o.data ?? [],
        bms: b.data ?? [],
        nfse: f.data ?? [],
      };
    },
  });

  if (!data) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  // aplicar filtros
  const obrasFiltradas = data.obras.filter(
    (o: any) =>
      (clienteId === "all" || o.cliente_id === clienteId) && (obraId === "all" || o.id === obraId),
  );
  const obraIds = new Set(obrasFiltradas.map((o: any) => o.id));
  const receb = data.receb.filter((r: any) => obraIds.has(r.obra_id));
  const nfs = data.nfs.filter((n: any) => obraIds.has(n.obra_id));
  const bms = data.bms.filter((b: any) => obraIds.has(b.obra_id));
  const obrasComBms = new Set(bms.map((b: any) => b.obra_id));

  // NFS-e do módulo Faturamento — hoje é a fonte real de lançamentos
  // (notas_fiscais/recebimentos legados podem estar vazios). Sem filtro de
  // obra/cliente as órfãs também entram, senão o fluxo aparece zerado.
  const semFiltroObra = obraId === "all" && clienteId === "all";
  const nfsNumeros = new Set(data.nfs.map((n: any) => String(n.numero ?? "").trim()));
  const nfseFat = (data.nfse as any[]).filter(
    (n) =>
      !nfsNumeros.has(String(n.numero_nfse ?? "").trim()) &&
      (semFiltroObra ? true : n.obra_id && obraIds.has(n.obra_id)),
  );
  const obraById = new Map(data.obras.map((o: any) => [o.id, o]));
  const nfseValor = (n: any) => Number(n.valor_liquido || n.valor_servicos || 0);
  /**
   * Data de referência da NFS-e para aging. Muitas notas importadas não têm
   * `data_vencimento` preenchida — nesses casos usamos emissão/competência,
   * senão os KPIs de aging ficam todos zerados.
   */
  const nfseDataRef = (n: any): string | null => {
    const v =
      n.data_vencimento ||
      n.data_emissao ||
      (n.competencia ? `${String(n.competencia).slice(0, 7)}-01` : null);
    return v ? String(v).slice(0, 10) : null;
  };

  // BMS futuras/abertas (previsto futuro)
  const bmsAbertas = bms.filter((b: any) => bmsAberta(b) && b.data_pagamento_prevista);

  const meses = Array.from({ length: mesesQtd }, (_, i) => addMonths(parseISO(inicio), i));
  const chart = meses.map((m) => {
    const k = format(m, "yyyy-MM");
    // Previsto: BMS abertas + fallback (recebimentos previstos de obras SEM BMS)
    const previstoBms = bmsAbertas
      .filter((b: any) => String(b.data_pagamento_prevista).startsWith(k))
      .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0);
    const previstoLegado = receb
      .filter(
        (r: any) =>
          !obrasComBms.has(r.obra_id) &&
          r.data_prevista?.startsWith(k) &&
          !r.data_recebimento &&
          !r.congelado,
      )
      .reduce((a: number, r: any) => a + Number(r.valor_previsto || 0), 0);
    // Recebimentos congelados (NF emitida) aguardando pagamento contam como previsto da NF
    const previstoCongelado = receb
      .filter((r: any) => r.congelado && r.data_prevista?.startsWith(k) && !r.data_recebimento)
      .reduce((a: number, r: any) => a + Number(r.valor_previsto || 0), 0);
    const previstoNfse = nfseFat
      .filter((n: any) => String(n.data_vencimento ?? "").startsWith(k))
      .reduce((a: number, n: any) => a + nfseValor(n), 0);
    const previsto = previstoBms + previstoLegado + previstoCongelado + previstoNfse;
    const recebido = receb
      .filter((r: any) => r.data_recebimento?.startsWith(k))
      .reduce((a: number, r: any) => a + Number(r.valor_recebido || r.valor_previsto), 0);
    const faturado =
      nfs
        .filter((n: any) => n.data_emissao?.startsWith(k))
        .reduce((a: number, n: any) => a + Number(n.valor), 0) +
      nfseFat
        .filter((n: any) => String(n.data_emissao ?? "").startsWith(k))
        .reduce((a: number, n: any) => a + Number(n.valor_servicos || 0), 0);
    return { mes: format(m, "MMM/yy", { locale: ptBR }), key: k, previsto, recebido, faturado };
  });

  // KPIs janelas — unificam BMS (não fechadas) + recebimentos congelados + legado
  const hoje = new Date();
  const futurosAbertos = [
    ...bmsAbertas.map((b: any) => ({
      obra_id: b.obra_id,
      data: b.data_pagamento_prevista,
      valor: Number(b.valor_previsto_dinamico || 0),
    })),
    ...receb
      .filter((r: any) => r.congelado && !r.data_recebimento)
      .map((r: any) => ({
        obra_id: r.obra_id,
        data: r.data_prevista,
        valor: Number(r.valor_previsto || 0),
      })),
    ...receb
      .filter((r: any) => !r.congelado && !obrasComBms.has(r.obra_id) && !r.data_recebimento)
      .map((r: any) => ({
        obra_id: r.obra_id,
        data: r.data_prevista,
        valor: Number(r.valor_previsto || 0),
      })),
    ...nfseFat
      .filter((n: any) => nfseDataRef(n))
      .map((n: any) => ({
        obra_id: n.obra_id,
        data: nfseDataRef(n) as string,
        valor: nfseValor(n),
      })),
  ];

  const naJanela = (dias: number) =>
    futurosAbertos
      .filter((x) => x.data && parseISO(x.data) >= hoje && parseISO(x.data) <= addDays(hoje, dias))
      .reduce((a, x) => a + x.valor, 0);
  const j30 = naJanela(30);
  const j60 = naJanela(60);
  const j90 = naJanela(90);
  const atrasado = futurosAbertos
    .filter((x) => x.data && parseISO(x.data) < hoje)
    .reduce((a, x) => a + x.valor, 0);

  // Pivot por obra × mês
  const pivot = obrasFiltradas.map((o: any) => {
    const temBms = obrasComBms.has(o.id);
    const cols = meses.map((m) => {
      const k = format(m, "yyyy-MM");
      const prevBms = temBms
        ? bmsAbertas
            .filter(
              (b: any) => b.obra_id === o.id && String(b.data_pagamento_prevista).startsWith(k),
            )
            .reduce((a: number, b: any) => a + Number(b.valor_previsto_dinamico || 0), 0)
        : 0;
      const prevCong = receb
        .filter(
          (r: any) =>
            r.obra_id === o.id &&
            r.congelado &&
            r.data_prevista?.startsWith(k) &&
            !r.data_recebimento,
        )
        .reduce((a: number, r: any) => a + Number(r.valor_previsto || 0), 0);
      const prevLegado = temBms
        ? 0
        : receb
            .filter(
              (r: any) =>
                r.obra_id === o.id &&
                !r.congelado &&
                r.data_prevista?.startsWith(k) &&
                !r.data_recebimento,
            )
            .reduce((a: number, r: any) => a + Number(r.valor_previsto || 0), 0);
      const prev = prevBms + prevCong + prevLegado;
      const rec = receb
        .filter((r: any) => r.obra_id === o.id && r.data_recebimento?.startsWith(k))
        .reduce((a: number, r: any) => a + Number(r.valor_recebido || r.valor_previsto), 0);
      return { k, prev, rec };
    });
    const total = cols.reduce((a, c) => a + c.prev + c.rec, 0);
    return { obra: o, cols, total };
  });

  const totalGeral = pivot.reduce((a: number, p: any) => a + p.total, 0);

  // Próximos recebimentos (lista) — combina fontes
  const proximos = [
    ...bmsAbertas.map((b: any) => ({
      id: `bms-${b.id}`,
      obra_id: b.obra_id,
      obras: b.obras,
      data: b.data_pagamento_prevista as string,
      valor: Number(b.valor_previsto_dinamico || 0),
      origem: `BMS #${b.numero}`,
      status: b.status,
    })),
    ...receb
      .filter((r: any) => !r.data_recebimento && (r.congelado || !obrasComBms.has(r.obra_id)))
      .map((r: any) => ({
        id: `r-${r.id}`,
        obra_id: r.obra_id,
        obras: r.obras,
        data: r.data_prevista as string,
        valor: Number(r.valor_previsto || 0),
        origem: r.congelado ? "NF emitida" : (r.origem ?? "manual"),
        status: r.status,
      })),
    ...nfseFat
      .filter((n: any) => nfseDataRef(n))
      .map((n: any) => ({
        id: `nfse-${n.id}`,
        obra_id: n.obra_id,
        obras: n.obra_id ? obraById.get(n.obra_id) : null,
        data: nfseDataRef(n) as string,
        valor: nfseValor(n),
        origem: `NFS-e ${n.numero_nfse}${n.data_vencimento ? "" : " (venc. estimado)"}`,
        status: n.status ?? null,
      })),
  ]

    .filter((x) => x.data)
    .map((x) => ({ ...x, bucket: classificarRecebivel(x.data, hoje) }))
    .sort((a, b) => a.data.localeCompare(b.data));

  // Chips de "valores a receber": contagem e total por balde.
  const recebResumo = REC_BUCKETS.map((b) => {
    const itens = proximos.filter((p: any) => p.bucket === b.value);
    return {
      ...b,
      titulos: itens.length,
      total: itens.reduce((a: number, p: any) => a + Number(p.valor || 0), 0),
    };
  });
  const proximosFiltrados = proximos.filter(
    (p: any) => p.bucket && recebSel.has(p.bucket as RecBucket),
  );
  const totalReceberSel = proximosFiltrados.reduce(
    (a: number, p: any) => a + Number(p.valor || 0),
    0,
  );

  // Discriminação dos KPIs de janela (mesmo padrão dos títulos de dívidas).
  const kpiItens = (() => {
    if (!kpiSel) return [] as any[];
    if (kpiSel.tipo === "atrasado")
      return proximos.filter((x: any) => x.data && parseISO(x.data) < hoje);
    const dias = kpiSel.tipo === "j30" ? 30 : kpiSel.tipo === "j60" ? 60 : 90;
    return proximos.filter(
      (x: any) => x.data && parseISO(x.data) >= hoje && parseISO(x.data) <= addDays(hoje, dias),
    );
  })();
  const kpiTotal = kpiItens.reduce((a: number, x: any) => a + Number(x.valor || 0), 0);

  function exportCsv() {
    const head = ["Obra", ...meses.map((m) => format(m, "MMM/yy", { locale: ptBR })), "Total"].join(
      ";",
    );
    const rows = pivot.map((p: any) =>
      [
        `${p.obra.codigo} ${p.obra.nome}`,
        ...p.cols.map((c: any) => (c.prev + c.rec).toFixed(2).replace(".", ",")),
        p.total.toFixed(2).replace(".", ","),
      ].join(";"),
    );
    const csv = [head, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Faturamento × recebimentos previstos (BMS) × realizados.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </header>

      {carrinho.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrinho de Títulos ({carrinho.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearCarrinho} className="h-8 text-xs">
              Limpar tudo
            </Button>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="max-h-40 overflow-y-auto space-y-1">
              {carrinho.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs p-2 bg-background rounded border"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="font-medium truncate">{item.descricao}</p>
                    <p className="text-muted-foreground">
                      Venc: {item.vencimento} · {brl(item.valor)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeFromCarrinho(item.id)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() =>
                  toast.info("Funcionalidade de processamento em lote será implementada na Onda 3.")
                }
              >
                Processar Selecionados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                setObraId("all");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clientesResumo.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Obra</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {data.obras
                  .filter((o: any) => clienteId === "all" || o.cliente_id === clienteId)
                  .map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.codigo} · {o.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input
              type="month"
              value={inicio.slice(0, 7)}
              onChange={(e) => setInicio(e.target.value + "-01")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meses</Label>
            <Select value={String(mesesQtd)} onValueChange={(v) => setMesesQtd(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 6, 12, 18, 24].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        {(
          [
            { tipo: "j30", label: "A receber 30 dias", valor: j30, danger: false },
            { tipo: "j60", label: "A receber 60 dias", valor: j60, danger: false },
            { tipo: "j90", label: "A receber 90 dias", valor: j90, danger: false },
            { tipo: "atrasado", label: "Atrasado", valor: atrasado, danger: true },
          ] as const
        ).map((k) => (
          <Card
            key={k.tipo}
            role="button"
            tabIndex={0}
            className="cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setKpiSel({ tipo: k.tipo, titulo: k.label })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setKpiSel({ tipo: k.tipo, titulo: k.label });
              }
            }}
          >
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-lg font-semibold mt-1 ${k.danger ? "text-destructive" : ""}`}>
                {brl(k.valor)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">Clique para discriminar</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!kpiSel} onOpenChange={(o) => !o && setKpiSel(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {kpiSel?.titulo} · {kpiItens.length} título(s) · {brl(kpiTotal)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiItens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhum título nesta faixa.
                    </TableCell>
                  </TableRow>
                ) : (
                  kpiItens.map((x: any) => (
                    <TableRow key={x.id}>
                      <TableCell>{format(parseISO(x.data), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{x.obras?.nome ?? x.obras?.codigo ?? "—"}</TableCell>
                      <TableCell>{x.origem}</TableCell>
                      <TableCell className="text-right font-medium">{brl(x.valor)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-base">Valores a receber</CardTitle>
            <span className="text-sm font-semibold tabular-nums">{brl(totalReceberSel)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Combine os prazos abaixo para discriminar os títulos. Arraste a faixa para ver todos.
          </p>
          <StatusChips
            ariaLabel="Prazos dos recebíveis"
            options={recebResumo.map((b) => ({
              value: b.value,
              label: b.label,
              count: b.titulos,
            }))}
            selected={recebSel}
            onChange={setRecebSel}
          />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recebResumo
            .filter((b) => recebSel.has(b.value))
            .map((b) => (
              <div key={b.value} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{b.label}</div>
                <div
                  className={`text-base font-semibold tabular-nums mt-0.5 ${
                    b.value === "atrasado" ? "text-destructive" : ""
                  }`}
                >
                  {brl(b.total)}
                </div>
                <div className="text-[11px] text-muted-foreground">{b.titulos} título(s)</div>
              </div>
            ))}
        </CardContent>
      </Card>

      <ContasReceberSection obraId={obraId} />

      <Tabs defaultValue="grafico">
        <TabsList>
          <TabsTrigger value="grafico">Gráfico mensal</TabsTrigger>
          <TabsTrigger value="pivot">Pivot por obra</TabsTrigger>
          <TabsTrigger value="lista">Próximos recebimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="grafico">
          <Card>
            <CardHeader>
              <CardTitle>Faturamento × Recebimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                    />
                    <Tooltip formatter={(v: any) => brl(v)} />
                    <Legend />
                    <Bar dataKey="faturado" fill="hsl(var(--primary))" name="Faturado (NFs)" />
                    <Bar
                      dataKey="previsto"
                      fill="hsl(var(--muted-foreground))"
                      name="A receber (BMS)"
                    />
                    <Bar dataKey="recebido" fill="hsl(142 71% 45%)" name="Recebido" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pivot">
          <Card>
            <CardHeader>
              <CardTitle>Recebimentos por obra × mês</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Obra</TableHead>
                    {meses.map((m) => (
                      <TableHead key={m.toISOString()} className="text-right whitespace-nowrap">
                        {format(m, "MMM/yy", { locale: ptBR })}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivot.map((p: any) => (
                    <TableRow key={p.obra.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                        <Link to={`/financeiro/obras/${p.obra.id}`} className="hover:underline">
                          {p.obra.codigo} · {p.obra.nome}
                        </Link>
                      </TableCell>
                      {p.cols.map((c: any) => {
                        const v = c.prev + c.rec;
                        return (
                          <TableCell key={c.k} className="text-right text-sm whitespace-nowrap">
                            {v === 0 ? (
                              <span className="text-muted-foreground/50">—</span>
                            ) : (
                              <span className={c.rec > 0 ? "text-success" : ""}>{brl(v)}</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold">{brl(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 z-10">Total</TableCell>
                    {meses.map((m) => {
                      const k = format(m, "yyyy-MM");
                      const v = pivot.reduce((a: number, p: any) => {
                        const c = p.cols.find((x: any) => x.k === k);
                        return a + (c ? c.prev + c.rec : 0);
                      }, 0);
                      return (
                        <TableCell key={k} className="text-right whitespace-nowrap">
                          {v === 0 ? "—" : brl(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">{brl(totalGeral)}</TableCell>
                  </TableRow>
                  {pivot.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={meses.length + 2}
                        className="text-center text-muted-foreground py-8"
                      >
                        Sem obras no filtro
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lista">
          <Card>
            <CardHeader>
              <CardTitle>Próximos recebimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data prevista</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proximosFiltrados.slice(0, 50).map((r: any) => {
                    const atras = parseISO(r.data) < hoje;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className={atras ? "text-destructive font-medium" : ""}>
                          {format(parseISO(r.data), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Link to={`/financeiro/obras/${r.obra_id}`} className="hover:underline">
                            {r.obras?.codigo} · {r.obras?.nome}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.origem}</TableCell>
                        <TableCell className="text-right">{brl(r.valor)}</TableCell>
                        <TableCell>
                          <Badge variant={atras ? "destructive" : "secondary"}>
                            {atras ? "atrasado" : r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {proximosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum recebimento previsto
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FluxoPage;
