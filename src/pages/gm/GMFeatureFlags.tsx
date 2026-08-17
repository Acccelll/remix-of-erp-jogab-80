import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Flag, Plus, Trash2 } from "lucide-react";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";
import { useObras } from "@/hooks/obras/useObras";
import { useAuth } from "@/contexts/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/common/QueryState";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/ui/confirm";

interface FeatureFlagRow {
  id: string;
  flag_key: string;
  obra_id: string | null;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

const GLOBAL_OBRA_VALUE = "__global__";

export default function GMFeatureFlags() {
  const { currentPlayer } = useAuth();
  const isGM = !!currentPlayer?.isGM;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    flag_key: "",
    obra_id: GLOBAL_OBRA_VALUE,
    enabled: false,
    description: "",
  });

  const flagsQuery = useQuery({
    queryKey: ["gm-feature-flags"],
    queryFn: async () => {
      return (await featureFlagsRepo.list()) as FeatureFlagRow[];
    },
  });

  const obrasQuery = useObras();

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await featureFlagsRepo.toggle(id, enabled, currentPlayer?.id ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gm-feature-flags"] }),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await featureFlagsRepo.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gm-feature-flags"] });
      toast.success("Flag removida");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.flag_key.trim()) throw new Error("Informe a chave da flag");
      await featureFlagsRepo.insert({
        flag_key: form.flag_key.trim(),
        obra_id: form.obra_id === GLOBAL_OBRA_VALUE ? null : form.obra_id,
        enabled: form.enabled,
        description: form.description || null,
        updated_by: currentPlayer?.id ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gm-feature-flags"] });
      toast.success("Flag criada");
      setForm({ flag_key: "", obra_id: GLOBAL_OBRA_VALUE, enabled: false, description: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (!isGM) {
    return <div className="p-6 text-sm text-muted-foreground">Acesso restrito ao GM.</div>;
  }

  const obraNome = (id: string | null) =>
    id ? (obrasQuery.data?.find((o) => o.id === id)?.nome ?? id.slice(0, 8)) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/gm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" /> Feature flags
          </h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova flag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova feature flag</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>
                  Chave (ex: <code>legacy.trello.enabled</code>)
                </Label>
                <Input
                  value={form.flag_key}
                  onChange={(e) => setForm({ ...form, flag_key: e.target.value })}
                  placeholder="modulo.feature.acao"
                />
              </div>
              <div>
                <Label>Obra (vazio = global)</Label>
                <Select
                  value={form.obra_id}
                  onValueChange={(v) => setForm({ ...form, obra_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL_OBRA_VALUE}>— Global —</SelectItem>
                    {obrasQuery.data?.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                />
                <Label>Ligada</Label>
              </div>
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className="w-full"
              >
                Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <QueryState
        isLoading={flagsQuery.isLoading}
        isError={flagsQuery.isError}
        error={flagsQuery.error}
        data={flagsQuery.data ?? []}
        isEmpty={(d) => d.length === 0}
        empty={
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma flag criada. Use o botão acima para criar a primeira.
          </p>
        }
      >
        {(rows) => (
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24">Estado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.flag_key}</TableCell>
                    <TableCell>
                      {f.obra_id ? (
                        <Badge variant="outline">{obraNome(f.obra_id)}</Badge>
                      ) : (
                        <Badge>Global</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.description}</TableCell>
                    <TableCell>
                      <Switch
                        checked={f.enabled}
                        onCheckedChange={(v) => toggleMut.mutate({ id: f.id, enabled: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        aria-label="Remover flag"
                        variant="ghost"
                        onClick={async () => {
                          if (await confirmDialog({ title: `Remover flag "${f.flag_key}"?` }))
                            deleteMut.mutate(f.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>
    </div>
  );
}
