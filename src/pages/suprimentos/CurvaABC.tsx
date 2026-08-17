import { useEffect, useMemo, useState } from "react";
import { useCatalogos } from "@/contexts/catalogos/useCatalogos";
import { useInsumosResumoPrecos } from "@/hooks/suprimentos/useInsumos";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, Search } from "lucide-react";
import { curvaABC, type InsumoABC } from "@/lib/orcamento/orcamento";
import { formatBRL } from "@/lib/core/currency";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

type OrcItem = {
  id: string;
  obra_id: string;
  composicao_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number | null;
};

type CompItem = { composicao_id: string; insumo_id: string; coeficiente: number };
type Insumo = { id: string; descricao: string; unidade: string; preco_unitario: number };

const fmtBRL = (n: number) => formatBRL(n, { minDigits: 2 });
const fmtPct = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";

const classeBadge = (c: "A" | "B" | "C") => {
  const variants: Record<string, string> = {
    A: "bg-destructive/15 text-destructive border-destructive/40 dark:text-destructive",
    B: "bg-warning/15 text-warning border-warning/40 dark:text-warning",
    C: "bg-success/15 text-success border-success/40 dark:text-success",
  };
  return variants[c];
};

const CurvaABC = () => {
  const { obras } = useCatalogos();
  const [obraId, setObraId] = useState<string>("todas");
  const [itens, setItens] = useState<OrcItem[]>([]);
  const [compItens, setCompItens] = useState<CompItem[]>([]);
  const { data: insumosData = [] } = useInsumosResumoPrecos();
  const insumos = insumosData as Insumo[];
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClasse, setFilterClasse] = useState<string>("todas");

  const obrasOrd = useMemo(
    () => [...obras].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [obras],
  );

  const load = async () => {
    setLoading(true);
    const [or, cir] = await Promise.all([
      suprimentosRepo
        .listOrcamentoItens(
          "id,obra_id,composicao_id,descricao,quantidade,preco_unitario,valor_total",
        )
        .then((data) => ({ data, error: null as any })),
      suprimentosRepo.listComposicaoItens().then((data) => ({ data, error: null as any })),
    ]);
    if (or.error) toast.error("Erro orçamento", { description: or.error.message });
    if (cir.error) toast.error("Erro composições", { description: cir.error.message });
    setItens((or.data || []) as OrcItem[]);
    setCompItens((cir.data || []) as CompItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);


  const insumoById = useMemo(() => {
    const m = new Map<string, Insumo>();
    insumos.forEach((i) => m.set(i.id, i));
    return m;
  }, [insumos]);

  const compItensPor = useMemo(() => {
    const m = new Map<string, CompItem[]>();
    compItens.forEach((c) => {
      const arr = m.get(c.composicao_id) || [];
      arr.push(c);
      m.set(c.composicao_id, arr);
    });
    return m;
  }, [compItens]);

  /**
   * Agregação: para cada `orcamento_itens` com `composicao_id`, distribui
   * `valor_total` proporcionalmente entre os insumos da composição usando
   * (coeficiente × preço do insumo) como peso. Assim, mesmo que o preço
   * congelado do orçamento difira do recalc atual da composição, a soma por
   * insumo bate com o total orçado.
   */
  const agregados = useMemo(() => {
    const acc = new Map<string, { insumo_id: string; descricao: string; valor: number }>();
    const itensFiltrados = obraId === "todas" ? itens : itens.filter((i) => i.obra_id === obraId);
    for (const it of itensFiltrados) {
      if (!it.composicao_id) continue;
      const comp = compItensPor.get(it.composicao_id) || [];
      const valor = Number(it.valor_total ?? Number(it.quantidade) * Number(it.preco_unitario));
      if (!comp.length || valor <= 0) continue;
      const pesos = comp.map((c) => ({
        c,
        peso: Number(c.coeficiente) * Number(insumoById.get(c.insumo_id)?.preco_unitario ?? 0),
      }));
      const totalPeso = pesos.reduce((a, p) => a + p.peso, 0);
      if (totalPeso <= 0) continue;
      for (const { c, peso } of pesos) {
        const ins = insumoById.get(c.insumo_id);
        if (!ins) continue;
        const parcela = (peso / totalPeso) * valor;
        const cur = acc.get(c.insumo_id);
        if (cur) cur.valor += parcela;
        else
          acc.set(c.insumo_id, {
            insumo_id: c.insumo_id,
            descricao: ins.descricao,
            valor: parcela,
          });
      }
    }
    return Array.from(acc.values());
  }, [itens, compItensPor, insumoById, obraId]);

  const curva: InsumoABC[] = useMemo(() => curvaABC(agregados), [agregados]);

  const totalValor = useMemo(() => curva.reduce((a, i) => a + i.valor, 0), [curva]);

  const filtradas = useMemo(() => {
    const s = search.trim().toLowerCase();
    return curva.filter((i) => {
      if (filterClasse !== "todas" && i.classe !== filterClasse) return false;
      if (s && !i.descricao.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [curva, search, filterClasse]);

  const contagem = useMemo(() => {
    return curva.reduce(
      (acc, i) => {
        acc[i.classe]++;
        return acc;
      },
      { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>,
    );
  }, [curva]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Curva ABC de Insumos
        </h2>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as obras</SelectItem>
            {obrasOrd.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Total orçado (insumos)</p>
              <p className="text-lg font-bold tabular-nums">{fmtBRL(totalValor)}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Classe A (80%)</p>
              <p className="text-lg font-bold">{contagem.A}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Classe B (15%)</p>
              <p className="text-lg font-bold">{contagem.B}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-xs text-muted-foreground">Classe C (5%)</p>
              <p className="text-lg font-bold">{contagem.C}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3 flex-wrap">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar insumo..."
                className="pl-9"
              />
            </div>
            <Select value={filterClasse} onValueChange={setFilterClasse}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as classes</SelectItem>
                <SelectItem value="A">Classe A</SelectItem>
                <SelectItem value="B">Classe B</SelectItem>
                <SelectItem value="C">Classe C</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {curva.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-lg">
              Nenhum insumo rastreado. Lance orçamentos usando composições para alimentar a curva
              ABC.
            </p>
          ) : (
            <DataTable
              columns={curvaColumns}
              data={filtradas}
              hideSearch
              pageSize={50}
              emptyState={<EmptyState title="Nenhum insumo no filtro." />}
            />
          )}
        </>
      )}
    </div>
  );
};

const curvaColumns: ColumnDef<InsumoABC & { idx?: number }, any>[] = [
  {
    id: "idx",
    header: "#",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>
    ),
  },
  {
    accessorKey: "classe",
    header: "Classe",
    cell: ({ row }) => (
      <Badge variant="outline" className={`text-xs ${classeBadge(row.original.classe)}`}>
        {row.original.classe}
      </Badge>
    ),
  },
  { accessorKey: "descricao", header: "Insumo" },
  {
    accessorKey: "valor",
    header: "Valor",
    cell: ({ row }) => (
      <div className="text-right tabular-nums font-medium">{fmtBRL(row.original.valor)}</div>
    ),
  },
  {
    accessorKey: "pct",
    header: "%",
    cell: ({ row }) => <div className="text-right tabular-nums">{fmtPct(row.original.pct)}</div>,
  },
  {
    accessorKey: "acumulado",
    header: "Acum.",
    cell: ({ row }) => (
      <div className="text-right tabular-nums text-muted-foreground">
        {fmtPct(row.original.acumulado)}
      </div>
    ),
  },
];

export default CurvaABC;
