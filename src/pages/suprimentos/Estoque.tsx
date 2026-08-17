import { useEffect, useMemo, useState } from "react";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { useInsumosAtivosBasico } from "@/hooks/suprimentos/useInsumos";
import { useObras } from "@/hooks/obras/useObras";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Boxes, Loader2, ArrowDown, ArrowUp } from "lucide-react";
import TransferenciaDialog from "@/components/suprimentos/TransferenciaDialog";
import { fmtDataLocal } from "@/lib/core/date";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

type Saldo = {
  id: string;
  local: string;
  insumo_id: string;
  saldo: number;
  minimo: number | null;
};
type Mov = {
  id: string;
  local: string;
  insumo_id: string;
  tipo: string;
  quantidade: number;
  origem: string | null;
  observacao: string | null;
  created_at: string;
};
type Insumo = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
};
type Obra = { id: string; nome: string };

export default function Estoque() {
  const obrasQuery = useObras();
  const obras = useMemo<Obra[]>(
    () => (obrasQuery.data ?? []).map((o) => ({ id: o.id, nome: o.nome })),
    [obrasQuery.data],
  );
  const [loading, setLoading] = useState(true);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const { data: insumosData = [] } = useInsumosAtivosBasico();
  const insumos = insumosData as Insumo[];
  const [filtroObra, setFiltroObra] = useState("todas");
  const [filtroInsumo, setFiltroInsumo] = useState("todos");
  const [busca, setBusca] = useState("");

  const insumoById = useMemo(() => Object.fromEntries(insumos.map((i) => [i.id, i])), [insumos]);
  const obraById = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  async function load() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      suprimentosRepo.listEstoqueSaldos().then((data) => ({ data, error: null as any })),
      suprimentosRepo
        .listMovimentacoesRecentes(500)
        .then((data) => ({ data, error: null as any }))
        .catch((error) => ({ data: [] as any[], error })),
    ]);
    if (r1.error || r2.error) {
      toast.error("Falha ao carregar estoque");
      setLoading(false);
      return;
    }
    setSaldos((r1.data ?? []) as Saldo[]);
    setMovs((r2.data ?? []) as Mov[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);


  const saldosFiltrados = useMemo(() => {
    return saldos.filter((s) => {
      if (filtroObra !== "todas" && s.local !== filtroObra) return false;
      if (filtroInsumo !== "todos" && s.insumo_id !== filtroInsumo) return false;
      if (busca) {
        const i = insumoById[s.insumo_id];
        const txt = `${i?.codigo ?? ""} ${i?.descricao ?? ""}`.toLowerCase();
        if (!txt.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [saldos, filtroObra, filtroInsumo, busca, insumoById]);

  const movsFiltrados = useMemo(() => {
    return movs.filter((m) => {
      if (filtroObra !== "todas" && m.local !== filtroObra) return false;
      if (filtroInsumo !== "todos" && m.insumo_id !== filtroInsumo) return false;
      if (busca) {
        const i = insumoById[m.insumo_id];
        const txt = `${i?.codigo ?? ""} ${i?.descricao ?? ""}`.toLowerCase();
        if (!txt.includes(busca.toLowerCase())) return false;
      }
      return true;
    });
  }, [movs, filtroObra, filtroInsumo, busca, insumoById]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6" />
            Estoque
          </h1>
          <p className="text-sm text-muted-foreground">
            Saldos por obra/insumo e extrato de movimentações.
          </p>
        </div>
        <TransferenciaDialog insumos={insumos} obras={obras} onDone={load} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Buscar insumo</Label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código ou descrição"
          />
        </div>
        <div>
          <Label className="text-xs">Obra</Label>
          <Select value={filtroObra} onValueChange={setFiltroObra}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Insumo</Label>
          <Select value={filtroInsumo} onValueChange={setFiltroInsumo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {insumos.slice(0, 200).map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.codigo ? `${i.codigo} — ` : ""}
                  {i.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || obrasQuery.isLoading ? (
        <PageLoading />
      ) : (
        <Tabs defaultValue="saldos">
          <TabsList>
            <TabsTrigger value="saldos">Saldos ({saldosFiltrados.length})</TabsTrigger>
            <TabsTrigger value="extrato">Extrato ({movsFiltrados.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="saldos" className="mt-4">
            <DataTable
              columns={saldoColumns(insumoById, obraById)}
              data={saldosFiltrados}
              hideSearch
              pageSize={50}
              emptyState={<EmptyState title="Nenhum saldo encontrado." />}
            />
          </TabsContent>

          <TabsContent value="extrato" className="mt-4">
            <DataTable
              columns={movColumns(insumoById, obraById)}
              data={movsFiltrados}
              hideSearch
              pageSize={50}
              emptyState={<EmptyState title="Sem movimentações." />}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function saldoColumns(
  insumoById: Record<string, Insumo>,
  obraById: Record<string, string>,
): ColumnDef<Saldo, any>[] {
  return [
    {
      id: "obra",
      header: "Obra",
      cell: ({ row }) => obraById[row.original.local] ?? row.original.local,
    },
    {
      id: "codigo",
      header: "Código",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {insumoById[row.original.insumo_id]?.codigo ?? "—"}
        </span>
      ),
    },
    {
      id: "insumo",
      header: "Insumo",
      cell: ({ row }) => insumoById[row.original.insumo_id]?.descricao ?? "—",
    },
    {
      id: "unidade",
      header: "Un.",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {insumoById[row.original.insumo_id]?.unidade ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "saldo",
      header: "Saldo",
      cell: ({ row }) => (
        <div className="text-right font-medium">{Number(row.original.saldo).toFixed(2)}</div>
      ),
    },
    {
      accessorKey: "minimo",
      header: "Mínimo",
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {row.original.minimo != null ? Number(row.original.minimo).toFixed(2) : "—"}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original;
        const abaixo = s.minimo != null && Number(s.saldo) < Number(s.minimo);
        return (
          <div className="text-center">
            {abaixo ? (
              <Badge variant="destructive">Abaixo do mínimo</Badge>
            ) : Number(s.saldo) <= 0 ? (
              <Badge variant="secondary">Zerado</Badge>
            ) : (
              <Badge variant="outline">OK</Badge>
            )}
          </div>
        );
      },
    },
  ];
}

function movColumns(
  insumoById: Record<string, Insumo>,
  obraById: Record<string, string>,
): ColumnDef<Mov, any>[] {
  return [
    {
      accessorKey: "created_at",
      header: "Data",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{fmtDataLocal(row.original.created_at)}</span>
      ),
    },
    {
      id: "obra",
      header: "Obra",
      cell: ({ row }) => obraById[row.original.local] ?? row.original.local,
    },
    {
      id: "insumo",
      header: "Insumo",
      cell: ({ row }) => {
        const i = insumoById[row.original.insumo_id];
        return (
          <>
            <div className="font-medium">{i?.descricao ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{i?.codigo ?? ""}</div>
          </>
        );
      },
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => {
        const isEntrada = row.original.tipo === "entrada";
        return (
          <div className="text-center">
            <Badge variant={isEntrada ? "default" : "secondary"} className="gap-1">
              {isEntrada ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
              {row.original.tipo}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "quantidade",
      header: "Qtd",
      cell: ({ row }) => {
        const i = insumoById[row.original.insumo_id];
        return (
          <div className="text-right font-medium">
            {Number(row.original.quantidade).toFixed(2)} {i?.unidade ?? ""}
          </div>
        );
      },
    },
    {
      accessorKey: "origem",
      header: "Origem",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.origem ?? "—"}</span>
      ),
    },
    {
      accessorKey: "observacao",
      header: "Obs",
      cell: ({ row }) => <span className="text-xs">{row.original.observacao ?? "—"}</span>,
    },
  ];
}
