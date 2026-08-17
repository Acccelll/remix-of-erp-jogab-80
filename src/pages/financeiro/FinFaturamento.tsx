import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Wand2, Loader2, CalendarClock, Pencil } from "lucide-react";
import { EditarNfseDialog, type NfseEditavel } from "@/components/financeiro/EditarNfseDialog";

import { toast } from "sonner";
import { obrasRepo } from "@/lib/repositories/obras";
import { notasFiscaisRepo } from "@/lib/repositories/medicoes";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { brl } from "@/lib/billing";
import { fmtData } from "@/lib/utils";
import { extrairObraDaDiscriminacao } from "@/lib/faturamento/vincular-obra";
import { ImportFaturamentoXlsxDialog } from "@/components/financeiro/ImportFaturamentoXlsxDialog";
import { PaginationControls } from "@/components/common/PaginationControls";
import { ImportNfseXmlDialog } from "@/components/financeiro/ImportNfseXmlDialog";
import { SnapshotAgeAlert } from "@/components/financeiro/SnapshotAgeAlert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { derivarVencimento, type FonteVencimento } from "@/lib/antecipacao/vencimento";
import { useAntecipacaoNfseMap } from "@/hooks/useAntecipacaoNfse";
import { ColumnFilterHeader } from "@/components/ui/column-filter-header";
import { useTableSort } from "@/hooks/useTableSort";


type Nfse = {
  id: string;
  numero_nfse: string;
  data_emissao: string | null;
  competencia: string | null;
  tomador_razao: string | null;
  tomador_uf: string | null;
  obra_id: string | null;
  numero_bms: string | null;
  pedido: string | null;
  valor_servicos: number;
  valor_iss: number;
  valor_inss: number;
  valor_liquido: number;
  status: string | null;
  origem: string;
  discriminacao: string | null;
  data_vencimento: string | null;
  vencimento_origem: "calculado" | "manual" | "importado" | null;
};

type ObraCond = {
  id: string;
  nome: string | null;
  codigo: string | null;
  codigo_totvs: string | null;
  cliente_id: string | null;
  prazo_pagamento_dias: number | null;
  dias_fixos_pagamento: number[] | null;
  dia_fixo_pagamento: number | null;
};

type ClienteCond = {
  id: string;
  prazo_pagamento_dias: number | null;
  dias_fixos_pagamento: number[] | null;
  dia_fixo_pagamento: number | null;
};

type ColunaFaturamento =
  | "numero"
  | "emissao"
  | "vencimento"
  | "tomador"
  | "uf"
  | "obra"
  | "bms"
  | "servicos"
  | "iss"
  | "liquido"
  | "origem";

const vazio = (valor: unknown) => String(valor ?? "").trim();
const opcoesDistintas = (valores: unknown[]) =>
  Array.from(new Set(valores.map(vazio))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
const passaSelecao = (selecionados: Set<string>, valor: unknown) =>
  selecionados.size === 0 || selecionados.has(vazio(valor));

const FONTE_LABEL: Record<FonteVencimento, string> = {
  manual: "manual",
  obra: "obra",
  cliente: "cliente",
  indisponivel: "indisponível",
};

function badgeVariant(f: FonteVencimento | null): "default" | "secondary" | "outline" | "destructive" {
  if (f === "manual") return "default";
  if (f === "obra") return "secondary";
  if (f === "cliente") return "outline";
  return "destructive";
}

export default function FinFaturamento() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [ano, setAno] = useState<string>("todos");
  const [uf, setUf] = useState<string>("todos");
  const [aba, setAba] = useState<"todas" | "orfas" | "sem_venc">("todas");
  const [sugerindo, setSugerindo] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [editId, setEditId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [editandoNfse, setEditandoNfse] = useState<NfseEditavel | null>(null);
  const [filtros, setFiltros] = useState<Record<ColunaFaturamento, Set<string>>>(() => ({
    numero: new Set(), emissao: new Set(), vencimento: new Set(), tomador: new Set(),
    uf: new Set(), obra: new Set(), bms: new Set(), servicos: new Set(), iss: new Set(),
    liquido: new Set(), origem: new Set(),
  }));



  const { data: nfse = [], isLoading } = useQuery({
    queryKey: ["faturamento_nfse"],
    queryFn: async () => {
      const data = await notasFiscaisRepo.listFaturamentoNfse();
      return (data ?? []) as unknown as Nfse[];
    },
  });

  const { data: antecipMap } = useAntecipacaoNfseMap();

  const { data: obras = [] } = useQuery({
    queryKey: ["obras_min_cond"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select(
          "id, nome, codigo, codigo_totvs, cliente_id, prazo_pagamento_dias, dias_fixos_pagamento, dia_fixo_pagamento",
        )
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ObraCond[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_min_cond"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, prazo_pagamento_dias, dias_fixos_pagamento, dia_fixo_pagamento");
      if (error) throw error;
      return (data ?? []) as ClienteCond[];
    },
  });

  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const clienteMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  // Índice código → obra (cobre codigo e codigo_totvs, com e sem zero-padding)
  const obraByCodigo = useMemo(() => {
    const m = new Map<string, ObraCond>();
    for (const o of obras) {
      const candidatos = [o.codigo, o.codigo_totvs].filter(Boolean).map(String);
      for (const c of candidatos) {
        m.set(c, o);
        m.set(c.replace(/^0+/, ""), o);
        m.set(c.padStart(4, "0"), o);
      }
    }
    return m;
  }, [obras]);

  function derivarParaNfse(n: Nfse) {
    const obra = n.obra_id ? obraMap.get(n.obra_id) : undefined;
    const cliente = obra?.cliente_id ? clienteMap.get(obra.cliente_id) : undefined;
    return derivarVencimento({
      dataEmissao: n.data_emissao,
      dataVencimentoManual:
        n.vencimento_origem === "manual" || n.vencimento_origem === "importado"
          ? n.data_vencimento
          : null,
      obra: obra
        ? {
            prazo_pagamento_dias: obra.prazo_pagamento_dias,
            dias_fixos_pagamento: obra.dias_fixos_pagamento,
            dia_fixo_pagamento: obra.dia_fixo_pagamento,
          }
        : null,
      cliente: cliente
        ? {
            prazo_pagamento_dias: cliente.prazo_pagamento_dias,
            dias_fixos_pagamento: cliente.dias_fixos_pagamento,
            dia_fixo_pagamento: cliente.dia_fixo_pagamento,
          }
        : null,
    });
  }

  function vencimentoResolvido(n: Nfse) {
    // Precedência de exibição: valor gravado (com origem) > derivação em memória
    if (n.data_vencimento && n.vencimento_origem) {
      return {
        data: n.data_vencimento,
        fonte: (n.vencimento_origem === "importado"
          ? "manual"
          : n.vencimento_origem === "manual"
            ? "manual"
            : "obra") as FonteVencimento,
        origem: n.vencimento_origem,
      };
    }
    const der = derivarParaNfse(n);
    return { data: der.data, fonte: der.fonte, origem: null as null | "calculado" };
  }

  async function vincularUma(nfseId: string, obraId: string) {
    try {
      await notasFiscaisRepo.setFaturamentoNfseObra(nfseId, obraId);
    } catch (err: any) {
      return toast.error(err?.message ?? "Falha ao vincular");
    }
    toast.success("NFS-e vinculada");
    qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
  }

  async function sugerirVinculosAutomaticos() {
    setSugerindo(true);
    try {
      const orfas = nfse.filter((n) => !n.obra_id);
      const pares: { id: string; obra_id: string }[] = [];
      for (const n of orfas) {
        const cod = extrairObraDaDiscriminacao(n.discriminacao ?? "");
        if (!cod) continue;
        const obra =
          obraByCodigo.get(cod) ??
          obraByCodigo.get(cod.replace(/^0+/, "")) ??
          obraByCodigo.get(cod.padStart(4, "0"));
        if (obra) pares.push({ id: n.id, obra_id: obra.id });
      }
      if (pares.length === 0) {
        toast.info("Nenhuma sugestão encontrada na discriminação.");
        return;
      }
      let ok = 0;
      for (const p of pares) {
        try {
          await notasFiscaisRepo.setFaturamentoNfseObra(p.id, p.obra_id);
          ok++;
        } catch {
          /* ignora falhas individuais */
        }
      }
      toast.success(`${ok} NFS-e vinculadas automaticamente (de ${pares.length} sugestões).`);
      qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
    } finally {
      setSugerindo(false);
    }
  }

  // ─── Pré-visualização do "Calcular vencimentos" ─────────────────────────
  const previewCalculo = useMemo(() => {
    const alvos = nfse.filter(
      (n) => !n.data_vencimento && n.vencimento_origem !== "manual",
    );
    const buckets: Record<FonteVencimento, number> = {
      manual: 0,
      obra: 0,
      cliente: 0,
      indisponivel: 0,
    };
    const gravaveis: { id: string; data: string }[] = [];
    for (const n of alvos) {
      const d = derivarParaNfse(n);
      buckets[d.fonte]++;
      if ((d.fonte === "obra" || d.fonte === "cliente") && d.data) {
        gravaveis.push({ id: n.id, data: d.data });
      }
    }
    return { total: alvos.length, buckets, gravaveis };
  }, [nfse, obras, clientes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function aplicarCalculoLote() {
    setCalculando(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const g of previewCalculo.gravaveis) {
        try {
          await notasFiscaisRepo.setFaturamentoNfseVencimento(g.id, g.data, "calculado");
          ok++;
        } catch {
          fail++;
        }
      }
      toast.success(
        `${ok} vencimentos calculados${fail ? ` · ${fail} falharam` : ""}.`,
        { description: "Registros com origem 'manual' foram preservados." },
      );
      qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
      setPreviewOpen(false);
    } finally {
      setCalculando(false);
    }
  }

  async function salvarVencimentoManual(id: string, iso: string) {
    if (!iso) return;
    try {
      await notasFiscaisRepo.setFaturamentoNfseVencimento(id, iso, "manual");
      toast.success("Vencimento atualizado.");
      qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao salvar vencimento.");
    } finally {
      setEditId(null);
      setEditValor("");
    }
  }

  const anos = useMemo(() => {
    const s = new Set<string>();
    nfse.forEach((n) => n.data_emissao && s.add(n.data_emissao.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [nfse]);

  const ufs = useMemo(() => {
    const s = new Set<string>();
    nfse.forEach((n) => n.tomador_uf && s.add(n.tomador_uf));
    return Array.from(s).sort();
  }, [nfse]);

  const semVencimento = useMemo(
    () => nfse.filter((n) => !vencimentoResolvido(n).data),
    [nfse, obras, clientes], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const obraLabel = (n: Nfse) => {
    const o = n.obra_id ? obraMap.get(n.obra_id) : null;
    return o ? `${o.codigo ? `${o.codigo} — ` : ""}${o.nome ?? ""}`.trim() : "";
  };

  const valorColuna = useCallback((n: Nfse, coluna: ColunaFaturamento): string | number => {
    if (coluna === "numero") return n.numero_nfse;
    if (coluna === "emissao") return n.data_emissao ?? "";
    if (coluna === "vencimento") return vencimentoResolvido(n).data ?? "";
    if (coluna === "tomador") return n.tomador_razao ?? "";
    if (coluna === "uf") return n.tomador_uf ?? "";
    if (coluna === "obra") return obraLabel(n);
    if (coluna === "bms") return n.numero_bms ?? "";
    if (coluna === "servicos") return Number(n.valor_servicos ?? 0);
    if (coluna === "iss") return Number(n.valor_iss ?? 0);
    if (coluna === "liquido") return Number(n.valor_liquido ?? 0);
    return n.origem ?? "";
  }, [obraMap, clienteMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const opcoesColunas = useMemo(() => {
    const out = {} as Record<ColunaFaturamento, string[]>;
    const colunas: ColunaFaturamento[] = [
      "numero", "emissao", "vencimento", "tomador", "uf", "obra", "bms",
      "servicos", "iss", "liquido", "origem",
    ];
    for (const coluna of colunas) out[coluna] = opcoesDistintas(nfse.map((n) => valorColuna(n, coluna)));
    return out;
  }, [nfse, valorColuna]);

  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return nfse.filter((n) => {
      if (aba === "orfas" && n.obra_id) return false;
      if (aba === "sem_venc" && vencimentoResolvido(n).data) return false;
      if (ano !== "todos" && (!n.data_emissao || !n.data_emissao.startsWith(ano))) return false;
      if (uf !== "todos" && n.tomador_uf !== uf) return false;
      for (const coluna of Object.keys(filtros) as ColunaFaturamento[]) {
        if (!passaSelecao(filtros[coluna], valorColuna(n, coluna))) return false;
      }
      if (!b) return true;
      return (
        n.numero_nfse.includes(b) ||
        (n.tomador_razao ?? "").toLowerCase().includes(b) ||
        (n.numero_bms ?? "").includes(b) ||
        (n.pedido ?? "").toLowerCase().includes(b)
      );
    });
  }, [nfse, busca, ano, uf, aba, obras, clientes, filtros, valorColuna]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sorted: ordenadas, sortKey, sortDir, toggle: alternarOrdenacao } = useTableSort(
    filtradas,
    valorColuna,
    "emissao" as ColunaFaturamento,
    "desc",
  );

  const cabecalho = (coluna: ColunaFaturamento, label: string, align: "left" | "right" = "left") => (
    <ColumnFilterHeader
      sortKey={coluna}
      currentKey={sortKey}
      dir={sortDir}
      onToggleSort={alternarOrdenacao}
      align={align}
      options={opcoesColunas[coluna]}
      selected={filtros[coluna]}
      onChangeSelected={(next) => setFiltros((atual) => ({ ...atual, [coluna]: next }))}
    >
      {label}
    </ColumnFilterHeader>
  );


  useMemo(() => setPage(1), [busca, ano, uf, aba]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageRows = useMemo(
    () => ordenadas.slice(pageStart, pageStart + PAGE_SIZE),
    [ordenadas, pageStart],
  );

  const totalOrfas = useMemo(() => nfse.filter((n) => !n.obra_id).length, [nfse]);

  const kpis = useMemo(() => {
    const total = filtradas.reduce((a, n) => a + (n.valor_servicos || 0), 0);
    const liquido = filtradas.reduce((a, n) => a + (n.valor_liquido || 0), 0);
    const semObra = filtradas.filter((n) => !n.obra_id).length;
    return { total, liquido, qtd: filtradas.length, semObra };
  }, [filtradas]);

  // Agrupamento por obra para a aba "Sem vencimento"
  const semVencAgrupado = useMemo(() => {
    if (aba !== "sem_venc") return [];
    const g = new Map<string, { obra: ObraCond | null; itens: Nfse[] }>();
    for (const n of semVencimento) {
      const key = n.obra_id ?? "__sem_obra__";
      const cur = g.get(key) ?? { obra: n.obra_id ? obraMap.get(n.obra_id) ?? null : null, itens: [] };
      cur.itens.push(n);
      g.set(key, cur);
    }
    return Array.from(g.values()).sort((a, b) => b.itens.length - a.itens.length);
  }, [aba, semVencimento, obraMap]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SnapshotAgeAlert />
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/financeiro/dashboard"
            className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Financeiro
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Faturamento</h1>
          <p className="text-sm text-muted-foreground">
            NFS-e emitidas. A planilha base é a fonte primária; XMLs individuais atualizam sem
            duplicar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={previewCalculo.total === 0}
            title="Calcular vencimentos ausentes a partir das condições de pagamento da obra/cliente"
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            Calcular vencimentos ({previewCalculo.total})
          </Button>
          <ImportFaturamentoXlsxDialog />
          <ImportNfseXmlDialog />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Notas" value={kpis.qtd.toLocaleString("pt-BR")} />
        <Kpi label="Valor dos serviços" value={brl(kpis.total)} />
        <Kpi label="Valor líquido" value={brl(kpis.liquido)} />
        <Kpi label="Sem obra vinculada" value={kpis.semObra.toLocaleString("pt-BR")} />
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="orfas">Órfãs ({totalOrfas.toLocaleString("pt-BR")})</TabsTrigger>
          <TabsTrigger value="sem_venc">
            Sem vencimento ({semVencimento.length.toLocaleString("pt-BR")})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {aba === "sem_venc" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NFS-e sem vencimento derivável</CardTitle>
            <p className="text-xs text-muted-foreground">
              A obra ou o cliente destas notas não tem condição de pagamento cadastrada. Corrija o
              cadastro ou informe manualmente na aba "Todas".
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {semVencAgrupado.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma NFS-e sem vencimento — carteira em dia.
              </p>
            )}
            {semVencAgrupado.map((g) => (
              <div key={g.obra?.id ?? "sem"} className="border rounded-md p-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm">
                    {g.obra ? (
                      <Link
                        to={`/obras/${g.obra.id}`}
                        className="font-medium hover:underline"
                      >
                        {g.obra.codigo ? `${g.obra.codigo} — ` : ""}
                        {g.obra.nome}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sem obra vinculada</span>
                    )}
                  </div>
                  <Badge variant="outline">{g.itens.length} NFS-e</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                  {g.itens.slice(0, 6).map((n) => (
                    <span key={n.id} className="font-mono">
                      {n.numero_nfse}
                    </span>
                  ))}
                  {g.itens.length > 6 && <span>+{g.itens.length - 6}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              {aba === "orfas" ? "NFS-e sem obra vinculada" : "Notas emitidas"}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              {aba === "orfas" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sugerirVinculosAutomaticos}
                  disabled={sugerindo}
                >
                  {sugerindo ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sugerir vínculos
                </Button>
              )}
              <Input
                placeholder="Buscar nº, tomador, BMS, pedido…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-64"
              />
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos anos</SelectItem>
                  {anos.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas UFs</SelectItem>
                  {ufs.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="scroll-xy-always rounded-md border max-h-[70vh]">
              <Table className="min-w-[1400px]" containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {cabecalho("numero", "Nº")}
                    {cabecalho("emissao", "Emissão")}
                    {cabecalho("vencimento", "Vencimento")}
                    {cabecalho("tomador", "Tomador")}
                    {cabecalho("uf", "UF")}
                    {cabecalho("obra", "Obra")}
                    {cabecalho("bms", "BMS")}
                    {cabecalho("servicos", "Serviços", "right")}
                    {cabecalho("iss", "ISS", "right")}
                    {cabecalho("liquido", "Líquido", "right")}
                    {cabecalho("origem", "Origem")}

                    {aba === "orfas" && <TableHead>Vincular</TableHead>}
                    <TableHead className="w-10"></TableHead>

                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-6">
                        Carregando…
                      </TableCell>
                    </TableRow>
                  ) : filtradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-6">
                        Nenhuma NFS-e encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((n) => {
                      const obra = n.obra_id ? obraMap.get(n.obra_id) : null;
                      const venc = vencimentoResolvido(n);
                      return (
                        <TableRow key={n.id}>
                          <TableCell className="font-mono text-xs">{n.numero_nfse}</TableCell>
                          <TableCell className="text-xs">
                            {n.data_emissao ? fmtData(n.data_emissao) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {editId === n.id ? (
                              <div className="flex gap-1 items-center">
                                <Input
                                  type="date"
                                  value={editValor}
                                  onChange={(e) => setEditValor(e.target.value)}
                                  className="h-7 w-36 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => salvarVencimentoManual(n.id, editValor)}
                                >
                                  ok
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setEditId(null);
                                    setEditValor("");
                                  }}
                                >
                                  ×
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 hover:underline"
                                onClick={() => {
                                  setEditId(n.id);
                                  setEditValor(venc.data ?? "");
                                }}
                                title="Editar vencimento manualmente"
                              >
                                <span>{venc.data ? fmtData(venc.data) : "—"}</span>
                                <Badge
                                  variant={badgeVariant(venc.fonte)}
                                  className="text-[10px] px-1 py-0"
                                >
                                  {FONTE_LABEL[venc.fonte]}
                                </Badge>
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{n.tomador_razao ?? "—"}</TableCell>
                          <TableCell className="text-xs">{n.tomador_uf ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {obra ? (
                              <Link to={`/obras/${obra.id}`} className="hover:underline">
                                {obra.nome ?? obra.codigo}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">sem vínculo</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{n.numero_bms ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {brl(n.valor_servicos)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {brl(n.valor_iss)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {brl(n.valor_liquido)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant={n.origem === "xml" ? "default" : "secondary"}>
                                {n.origem}
                              </Badge>
                              {antecipMap?.get(n.id) && (
                                <Link
                                  to="/financeiro/antecipacao"
                                  className="inline-block"
                                  title={`Operação ${antecipMap.get(n.id)!.numero ?? ""} · ${antecipMap.get(n.id)!.operador ?? ""} · ${fmtData(antecipMap.get(n.id)!.dataOperacao)}`}
                                >
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 border-amber-500 text-amber-700 dark:text-amber-400"
                                  >
                                    antecipada
                                  </Badge>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          {aba === "orfas" && (
                            <TableCell>
                              <Select value="" onValueChange={(v) => vincularUma(n.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-[200px]">
                                  <SelectValue placeholder="Selecionar obra…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-80">
                                  {obras.map((o) => (
                                    <SelectItem key={o.id} value={o.id} className="text-xs">
                                      {o.codigo ? `${o.codigo} — ` : ""}
                                      {o.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title="Editar lançamento"
                              onClick={() => setEditandoNfse(n as any)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>

                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationControls
              page={page}
              totalItems={filtradas.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              className="mt-3"
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calcular vencimentos</DialogTitle>
            <DialogDescription>
              Deriva a data de vencimento das NFS-e sem essa informação usando as condições de
              pagamento cadastradas na obra (prioridade) ou no cliente. Registros com origem
              "manual" nunca são sobrescritos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>NFS-e sem vencimento</span>
              <span className="font-medium">{previewCalculo.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Serão calculadas pela obra</span>
              <span className="font-medium text-primary">{previewCalculo.buckets.obra}</span>
            </div>
            <div className="flex justify-between">
              <span>Serão calculadas pelo cliente</span>
              <span className="font-medium">{previewCalculo.buckets.cliente}</span>
            </div>
            <div className="flex justify-between">
              <span>Sem cadastro de condição</span>
              <span className="font-medium text-destructive">
                {previewCalculo.buckets.indisponivel}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)} disabled={calculando}>
              Cancelar
            </Button>
            <Button
              onClick={aplicarCalculoLote}
              disabled={calculando || previewCalculo.gravaveis.length === 0}
            >
              {calculando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando…
                </>
              ) : (
                `Aplicar (${previewCalculo.gravaveis.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditarNfseDialog
        nfse={editandoNfse}
        obras={obras as any}
        onClose={() => setEditandoNfse(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["faturamento_nfse"] });
          qc.invalidateQueries({ queryKey: ["faturamento_nfse_obra"] });
        }}
      />
    </div>

  );
}

import { Kpi as KpiBase } from "@/components/common/Kpi";
function Kpi({ label, value }: { label: string; value: string }) {
  return <KpiBase label={label} value={value} labelUppercase />;
}
