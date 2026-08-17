/**
 * Cadastro de alçadas de aprovação de OC.
 * Visível para todos os autenticados; apenas GM pode editar (RLS).
 */
import { useEffect, useMemo, useState } from "react";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, ShieldCheck } from "lucide-react";
import { PageLoading } from "@/components/common/PageLoading";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/common/EmptyState";
import type { ColumnDef } from "@tanstack/react-table";

type Alcada = {
  id: string;
  valor_min: number;
  valor_max: number | null;
  papel_aprovador: string;
  ordem: number;
};

export default function Alcadas() {
  const [rows, setRows] = useState<Alcada[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    valor_min: "0",
    valor_max: "",
    papel_aprovador: "",
    ordem: "1",
  });

  const columns = useMemo<ColumnDef<Alcada, any>[]>(
    () => [
      {
        accessorKey: "valor_min",
        header: "valor_min",
        cell: ({ row }) => (
          <div className="text-right">{Number(row.original.valor_min).toFixed(2)}</div>
        ),
      },
      {
        accessorKey: "valor_max",
        header: "valor_max",
        cell: ({ row }) => (
          <div className="text-right">
            {row.original.valor_max != null ? Number(row.original.valor_max).toFixed(2) : "—"}
          </div>
        ),
      },
      { accessorKey: "papel_aprovador", header: "Papel" },
      {
        accessorKey: "ordem",
        header: "Ordem",
        cell: ({ row }) => <div className="text-center">{row.original.ordem}</div>,
      },
      {
        id: "acoes",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <Button size="icon" variant="ghost" aria-label="Remover alçada" onClick={() => remove(row.original.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  async function load() {
    setLoading(true);
    let data: any[] = [];
    try {
      data = await suprimentosRepo.listAlcadas();
    } catch (e) {
      setLoading(false);
      toast.error((e as Error).message);
      return;
    }
    setLoading(false);
    setRows((data ?? []) as Alcada[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    const valor_min = Number(form.valor_min);
    const valor_max = form.valor_max === "" ? null : Number(form.valor_max);
    const ordem = Number(form.ordem) || 1;
    if (!form.papel_aprovador.trim()) {
      toast.error("Informe o papel aprovador");
      return;
    }
    if (!(valor_min >= 0)) {
      toast.error("valor_min inválido");
      return;
    }
    try {
      await suprimentosRepo.createAlcada({
        valor_min,
        valor_max,
        papel_aprovador: form.papel_aprovador.trim(),
        ordem,
      });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setForm({ valor_min: "0", valor_max: "", papel_aprovador: "", ordem: "1" });
    load();
  }

  async function remove(id: string) {
    try {
      await suprimentosRepo.deleteAlcada(id);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Alçadas de aprovação
        </h1>
        <p className="text-sm text-muted-foreground">
          Faixas de valor → papel obrigatório para aprovar uma OC. Use a coluna ordem para exigir
          múltiplas alçadas (ex.: Gerência + Diretoria).
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label className="text-xs">valor_min</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor_min}
              onChange={(e) => setForm({ ...form, valor_min: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">valor_max (vazio = sem teto)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor_max}
              onChange={(e) => setForm({ ...form, valor_max: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Papel aprovador</Label>
            <Input
              value={form.papel_aprovador}
              onChange={(e) => setForm({ ...form, papel_aprovador: e.target.value })}
              placeholder="Compras, Gerencia, Diretoria…"
            />
          </div>
          <div>
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              min="1"
              value={form.ordem}
              onChange={(e) => setForm({ ...form, ordem: e.target.value })}
            />
          </div>
          <Button onClick={add} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </Card>

      {loading ? (
        <PageLoading />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          pageSize={25}
          searchPlaceholder="Buscar por papel…"
          emptyState={<EmptyState title="Nenhuma alçada cadastrada." />}
        />
      )}
    </div>
  );
}
